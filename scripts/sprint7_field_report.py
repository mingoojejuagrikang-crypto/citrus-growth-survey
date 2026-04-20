"""
sprint7_field_report.py — Sprint 7 필드 테스트 분석

목적:
  Sprint 7 배포(v1.0.1) 이후 수집된 voice-logs-*.zip을 분석해 다음을 측정합니다:
    - 도메인 용어별 1차 인식 성공률 (F021 phrases biasing 효과)
    - Chrome 버전별 분리 집계 (Chrome 142+ 여부로 나누어 비교)
    - alternatives fallback 사용 빈도
    - status warn/error 원인 분포

  이전 Sprint 6 로그(v6.x)가 shared/voice-logs/ 에 있으면 baseline 으로 함께 비교.

사용법:
  python scripts/sprint7_field_report.py <zip_or_dir_or_json>

  - zip/dir/json 어느 쪽이든 입력 가능
  - 자동으로 v1.0.1+ vs 그 이전으로 분리

출력:
  shared/sprint7-field-report-YYYYMMDD.md
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SHARED_DIR = PROJECT_ROOT.parent.parent / 'shared'
EXISTING_LOGS_DIR = SHARED_DIR / 'voice-logs'

# ─────────────────────────────────────────────
# 도메인 용어 (F021 phrases biasing 등록 단어)
# ─────────────────────────────────────────────

DOMAIN_TERMS = [
    '횡경',
    '종경',
    '조사나무',
    '조사과실',
    '과피두께',
    '당도',
    '산함량',
    '과중',
    '과피중',
    '착색',
    '비파괴',
    '비고',
    '적정산도',
]

# 파서는 로그에 한글 필드명을 기록하므로, 영문 키 <-> 한글을 양방향 매핑해 표시한다.
FIELD_EN_TO_KO = {
    'width': '횡경',
    'height': '종경',
    'treeNo': '조사나무',
    'fruitNo': '조사과실',
    'pericarpThickness': '과피두께',
    'brix': '당도',
    'acidContent': '산함량',
    'fruitWeight': '과중',
    'pericarpWeight': '과피중',
    'coloring': '착색',
    'nonDestructive': '비파괴',
    'remark': '비고',
    'titratableAcidity': '적정산도',
}
FIELD_KO_TO_EN = {v: k for k, v in FIELD_EN_TO_KO.items()}


def field_display(name: str) -> tuple[str, str]:
    """로그의 필드명이 영문이든 한글이든 (영문, 한글) 튜플로 정규화."""
    if name in FIELD_EN_TO_KO:
        return name, FIELD_EN_TO_KO[name]
    if name in FIELD_KO_TO_EN:
        return FIELD_KO_TO_EN[name], name
    return name, '-'


# ─────────────────────────────────────────────
# 버전 파싱
# ─────────────────────────────────────────────

SEMVER_RE = re.compile(r'v?(\d+)\.(\d+)\.(\d+)')


def parse_version(v: str) -> tuple[int, int, int] | None:
    if not v:
        return None
    m = SEMVER_RE.match(v)
    if not m:
        return None
    return (int(m.group(1)), int(m.group(2)), int(m.group(3)))


def is_sprint7(v: str) -> bool:
    """v1.0.1 이상을 Sprint 7 배포로 간주.

    주의: 기존 Sprint 3~6 로그는 'v6.3.0' 등 major=6 형태였고, Sprint 7부터
    package.json 기준으로 버전 체계가 '1.0.1'로 재정의됨. major=1 이면서
    (1,0,1) 이상인 경우만 Sprint 7 이후 배포로 판정한다.
    """
    parsed = parse_version(v)
    if not parsed:
        return False
    major = parsed[0]
    if major != 1:
        return False
    return parsed >= (1, 0, 1)


CHROME_VER_RE = re.compile(r'Chrome/(\d+)')


def chrome_major(user_agent: str) -> int | None:
    if not user_agent:
        return None
    m = CHROME_VER_RE.search(user_agent)
    return int(m.group(1)) if m else None


# ─────────────────────────────────────────────
# 데이터 로드
# ─────────────────────────────────────────────


def load_any(source: Path) -> list[dict[str, Any]]:
    """zip/dir/json 중 어느 쪽이든 로드하여 로그 리스트 반환."""
    if source.is_file() and source.suffix == '.zip':
        tmp = Path(tempfile.mkdtemp(prefix='voice-logs-'))
        with zipfile.ZipFile(source, 'r') as zf:
            zf.extractall(tmp)
        return _read_logs_json(tmp)
    if source.is_dir():
        return _read_logs_json(source)
    if source.is_file() and source.suffix == '.json':
        data = json.loads(source.read_text(encoding='utf-8'))
        return data if isinstance(data, list) else data.get('logs', [])
    raise FileNotFoundError(f'지원하지 않는 입력: {source}')


def _read_logs_json(work_dir: Path) -> list[dict[str, Any]]:
    files = list(work_dir.rglob('voice-logs.json'))
    if not files:
        raise FileNotFoundError(f'voice-logs.json 없음: {work_dir}')
    data = json.loads(files[0].read_text(encoding='utf-8'))
    return data if isinstance(data, list) else data.get('logs', [])


def load_baseline() -> list[dict[str, Any]]:
    """shared/voice-logs/ 의 기존 JSON 파일을 모두 합쳐 baseline 반환."""
    out: list[dict[str, Any]] = []
    if not EXISTING_LOGS_DIR.exists():
        return out
    for f in EXISTING_LOGS_DIR.glob('*.json'):
        try:
            d = json.loads(f.read_text(encoding='utf-8'))
            if isinstance(d, list):
                out.extend(d)
            elif isinstance(d, dict):
                out.extend(d.get('logs', []))
        except json.JSONDecodeError:
            continue
    return out


# ─────────────────────────────────────────────
# 집계
# ─────────────────────────────────────────────


@dataclass
class Metrics:
    total: int = 0
    parser_field_matched: int = 0  # parse.field != None (값 유무 무관)
    parser_value_matched: int = 0  # parse.field != None AND parse.value != None
    status_ok: int = 0  # 최종 수용된 입력 (가장 엄격한 성공 지표)
    status_warn: int = 0
    status_error: int = 0
    alternatives_used: int = 0  # rawText != alternatives[0] 일 가능성
    multi_alternatives: int = 0  # alternatives.length > 1
    by_field: dict[str, int] = None  # noqa: RUF013
    by_field_fail: dict[str, int] = None  # noqa: RUF013
    devices: dict[str, int] = None  # noqa: RUF013
    chrome_majors: dict[int, int] = None  # noqa: RUF013

    def __post_init__(self):
        if self.by_field is None:
            self.by_field = defaultdict(int)
        if self.by_field_fail is None:
            self.by_field_fail = defaultdict(int)
        if self.devices is None:
            self.devices = defaultdict(int)
        if self.chrome_majors is None:
            self.chrome_majors = defaultdict(int)


def compute(recognitions: Iterable[dict[str, Any]]) -> Metrics:
    m = Metrics()
    for e in recognitions:
        m.total += 1
        parse = e.get('parse') or {}
        field = parse.get('field')
        value = parse.get('value')
        status = e.get('status', '')
        if field:
            m.parser_field_matched += 1
            m.by_field[field] += 1
            if value is not None and value != '':
                m.parser_value_matched += 1
        else:
            m.by_field_fail['(unrecognized)'] += 1

        if status == 'ok':
            m.status_ok += 1
        elif status == 'warn':
            m.status_warn += 1
        elif status == 'error':
            m.status_error += 1

        alts = e.get('alternatives') or []
        if len(alts) > 1:
            m.multi_alternatives += 1
            if e.get('rawText') and alts and e.get('rawText') != alts[0]:
                m.alternatives_used += 1

        dev = e.get('device') or {}
        plat = dev.get('platform', '?')
        m.devices[plat] += 1
        cmajor = chrome_major(dev.get('userAgent', ''))
        if cmajor is not None:
            m.chrome_majors[cmajor] += 1
    return m


# ─────────────────────────────────────────────
# 리포트
# ─────────────────────────────────────────────


def pct(n: int, total: int) -> str:
    if total == 0:
        return '0%'
    return f'{100 * n / total:.1f}%'


def escape_pipe(s: str) -> str:
    return (s or '').replace('|', '\\|').replace('\n', ' ')


def format_metrics_block(title: str, m: Metrics) -> list[str]:
    lines: list[str] = []
    lines.append(f'### {title}')
    lines.append('')
    lines.append(f'- 전체 recognition: **{m.total}건**')
    if m.total == 0:
        lines.append('- (데이터 없음)')
        lines.append('')
        return lines
    lines.append(
        f'- status ok (최종 수용): **{m.status_ok}/{m.total} ({pct(m.status_ok, m.total)})**'
    )
    lines.append(
        f'- 필드+값 매칭: {m.parser_value_matched}/{m.total} ({pct(m.parser_value_matched, m.total)})'
    )
    lines.append(
        f'- 필드만 매칭: {m.parser_field_matched}/{m.total} ({pct(m.parser_field_matched, m.total)})'
    )
    lines.append(f'- status ok/warn/error: {m.status_ok} / {m.status_warn} / {m.status_error}')
    lines.append(
        f'- alternatives 다중 후보 존재: {m.multi_alternatives}건 ({pct(m.multi_alternatives, m.total)})'
    )
    lines.append('')
    if m.by_field:
        lines.append('**필드별 매칭 성공:**')
        lines.append('')
        lines.append('| field (영문) | field (한글) | 건수 | 비율 |')
        lines.append('|-------------|-------------|------|------|')
        for fname, n in sorted(m.by_field.items(), key=lambda x: -x[1]):
            en, ko = field_display(fname)
            lines.append(f'| {en} | {ko} | {n} | {pct(n, m.total)} |')
        lines.append('')
    if m.chrome_majors:
        lines.append('**Chrome 메이저 버전 분포:**')
        lines.append('')
        for v, n in sorted(m.chrome_majors.items()):
            phrases_support = '✓ phrases 지원' if v >= 142 else ''
            lines.append(f'- Chrome {v}: {n}건 {phrases_support}')
        lines.append('')
    if m.devices:
        lines.append('**디바이스 분포:**')
        lines.append('')
        for plat, n in sorted(m.devices.items(), key=lambda x: -x[1]):
            lines.append(f'- {plat}: {n}건')
        lines.append('')
    return lines


def write_report(
    sprint7: list[dict[str, Any]],
    baseline: list[dict[str, Any]],
    out_path: Path,
    source_label: str,
) -> None:
    s7_recog = [e for e in sprint7 if e.get('kind') == 'recognition']
    bl_recog = [e for e in baseline if e.get('kind') == 'recognition']

    s7_m = compute(s7_recog)
    bl_m = compute(bl_recog)

    lines: list[str] = []
    lines.append('# Sprint 7 필드 리포트 (F021 phrases biasing 효과 측정)')
    lines.append('')
    lines.append(f'- 소스: `{source_label}`')
    lines.append(f'- 생성: {datetime.now().isoformat()}')
    lines.append('')

    lines.append('## 1. Sprint 7 (v1.0.1+) vs Baseline (v6.x 이전) 요약')
    lines.append('')
    lines.append('| 지표 | Sprint 7 | Baseline |')
    lines.append('|------|----------|----------|')
    lines.append(f'| recognition 총계 | {s7_m.total} | {bl_m.total} |')
    lines.append(
        f'| status ok 비율 (최종 수용) | {pct(s7_m.status_ok, s7_m.total)} | {pct(bl_m.status_ok, bl_m.total)} |'
    )
    lines.append(
        f'| 필드+값 매칭 성공률 | {pct(s7_m.parser_value_matched, s7_m.total)} | {pct(bl_m.parser_value_matched, bl_m.total)} |'
    )
    lines.append(
        f'| 필드만 매칭 성공률 | {pct(s7_m.parser_field_matched, s7_m.total)} | {pct(bl_m.parser_field_matched, bl_m.total)} |'
    )
    lines.append(
        f'| status warn 비율 | {pct(s7_m.status_warn, s7_m.total)} | {pct(bl_m.status_warn, bl_m.total)} |'
    )
    lines.append(
        f'| status error 비율 | {pct(s7_m.status_error, s7_m.total)} | {pct(bl_m.status_error, bl_m.total)} |'
    )
    lines.append('')

    lines.append('## 2. 필드별 매칭 비교')
    lines.append('')
    lines.append('| field (영문) | field (한글) | Sprint 7 | Baseline |')
    lines.append('|-------------|-------------|----------|----------|')
    all_fields = set(s7_m.by_field) | set(bl_m.by_field)
    for fname in sorted(all_fields):
        en, ko = field_display(fname)
        s = s7_m.by_field.get(fname, 0)
        b = bl_m.by_field.get(fname, 0)
        lines.append(f'| {en} | {ko} | {s} | {b} |')
    lines.append('')

    # Chrome 142+ vs 이하 비교 (phrases biasing 효과 직접 측정)
    lines.append('## 3. Chrome 142+ vs 이하 (phrases biasing 효과)')
    lines.append('')
    c142_plus = [e for e in s7_recog if (cm := chrome_major((e.get('device') or {}).get('userAgent', ''))) and cm >= 142]
    c142_minus = [e for e in s7_recog if (cm := chrome_major((e.get('device') or {}).get('userAgent', ''))) and cm < 142]
    lines.append(f'- Chrome 142+ 환경: **{len(c142_plus)}건**')
    lines.append(f'- Chrome 141 이하: **{len(c142_minus)}건**')
    if c142_plus and c142_minus:
        m_plus = compute(c142_plus)
        m_minus = compute(c142_minus)
        lines.append('')
        lines.append(
            f'- Chrome 142+ status=ok 비율: {pct(m_plus.status_ok, m_plus.total)}'
        )
        lines.append(
            f'- Chrome 141 이하 status=ok 비율: {pct(m_minus.status_ok, m_minus.total)}'
        )
        lines.append(
            f'- Chrome 142+ 필드+값 매칭: {pct(m_plus.parser_value_matched, m_plus.total)}'
        )
        lines.append(
            f'- Chrome 141 이하 필드+값 매칭: {pct(m_minus.parser_value_matched, m_minus.total)}'
        )
    else:
        lines.append('')
        lines.append('> 비교에 충분한 양쪽 데이터가 없어 효과 단정 불가. '
                     '(Chrome 142 정식 릴리스 이후 재측정 권장)')
    lines.append('')

    lines.append('## 4. Sprint 7 상세')
    lines.append('')
    lines.extend(format_metrics_block('이번 필드 테스트 (v1.0.1+)', s7_m))

    lines.append('## 5. Baseline 상세 (기존 shared/voice-logs/)')
    lines.append('')
    lines.extend(format_metrics_block('이전 로그 전체', bl_m))

    lines.append('## 6. 다음 단계 제안')
    lines.append('')
    lines.append('1. 파서 실패(warn/error) 로그를 Whisper 대조 결과와 교차 → alias 후보 확정')
    lines.append('2. Chrome 142+ vs 이하 성공률 차이 >5%p 이면 F021 효과 확정')
    lines.append('3. iOS standalone 경고(F022)로 차단된 사용자 없는지 확인')
    lines.append('')

    out_path.write_text('\n'.join(lines), encoding='utf-8')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path, help='voice-logs-*.zip / 디렉토리 / JSON')
    args = parser.parse_args()

    if not args.source.exists():
        print(f'[error] 입력 경로 없음: {args.source}', file=sys.stderr)
        return 1

    all_logs = load_any(args.source)
    sprint7 = [e for e in all_logs if is_sprint7(e.get('appVersion', ''))]
    baseline_from_input = [
        e for e in all_logs if not is_sprint7(e.get('appVersion', ''))
    ]

    print(
        f'[info] 입력 로그 {len(all_logs)}건 중 Sprint 7 {len(sprint7)}건, baseline 후보 {len(baseline_from_input)}건',
        file=sys.stderr,
    )

    # 입력에 baseline이 충분하지 않으면 기존 shared/voice-logs/ 활용
    if len(baseline_from_input) < 20:
        print('[info] 입력의 baseline 부족 -> shared/voice-logs/ 합류', file=sys.stderr)
        baseline = baseline_from_input + load_baseline()
    else:
        baseline = baseline_from_input

    SHARED_DIR.mkdir(parents=True, exist_ok=True)
    date_tag = datetime.now().strftime('%Y%m%d')
    out_path = SHARED_DIR / f'sprint7-field-report-{date_tag}.md'
    write_report(sprint7, baseline, out_path, args.source.name)

    print(f'[done] -> {out_path}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
