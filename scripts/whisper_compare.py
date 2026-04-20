"""
whisper_compare.py — Sprint 7 Whisper vs Chrome Web Speech 대조 스크립트

목적:
  필드 테스트에서 수집한 voice-logs-*.zip을 입력받아, 각 recognition 엔트리의
  오디오(.webm/.mp4)를 OpenAI Whisper API로 재전사한 뒤 Chrome Web Speech
  전사(rawText)와 비교합니다. 차이 패턴을 추출해 alias/normalizer 개선
  후보를 도출하는 것이 최종 목적입니다.

사용법:
  python scripts/whisper_compare.py <zip_or_dir> [--limit N] [--no-cache]

  - zip_or_dir: voice-logs-YYYYMMDD.zip 경로 또는 unzip된 디렉토리
  - --limit: 처리할 엔트리 수 제한 (디버깅용)
  - --no-cache: shared/whisper-cache/ 무시하고 재호출

환경 변수:
  OPENAI_API_KEY — secrets/.env 에서 자동 로드

출력:
  shared/whisper-comparison-YYYYMMDD.md
  shared/whisper-comparison-YYYYMMDD.csv
  shared/whisper-cache/{logId}.json  (재실행 시 재사용)
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from dotenv import load_dotenv
from openai import OpenAI

# ─────────────────────────────────────────────
# 경로 상수
# ─────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SECRETS_ENV = PROJECT_ROOT / 'secrets' / '.env'
SHARED_DIR = PROJECT_ROOT.parent.parent / 'shared'
CACHE_DIR = SHARED_DIR / 'whisper-cache'

# ─────────────────────────────────────────────
# 데이터 구조
# ─────────────────────────────────────────────


@dataclass
class ComparisonRow:
    log_id: str
    ts: str
    app_version: str
    chrome_text: str
    whisper_text: str
    parsed_field: str | None
    parsed_value: Any
    status: str
    message: str
    agree: bool  # 두 전사 완전 일치
    ko_num_ambig: bool  # "이/삼/사..." 등 한국어 숫자 주변 차이 (추정)

    def to_csv_row(self) -> list[str]:
        return [
            self.log_id,
            self.ts,
            self.app_version,
            self.chrome_text,
            self.whisper_text,
            self.parsed_field or '',
            '' if self.parsed_value is None else str(self.parsed_value),
            self.status,
            self.message,
            'Y' if self.agree else 'N',
            'Y' if self.ko_num_ambig else 'N',
        ]


CSV_HEADER = [
    'log_id',
    'ts',
    'app_version',
    'chrome_text',
    'whisper_text',
    'parsed_field',
    'parsed_value',
    'status',
    'message',
    'agree',
    'ko_num_ambig',
]

# ─────────────────────────────────────────────
# 유틸
# ─────────────────────────────────────────────

KO_NUM_CHARS = set('영일이삼사오육칠팔구십백천')


def is_ko_num_involved(text: str) -> bool:
    """한국어 숫자 글자가 하나라도 포함되면 True."""
    return any(ch in KO_NUM_CHARS for ch in text)


def unpack_zip(zip_path: Path) -> Path:
    """ZIP을 임시 디렉토리에 풀고 경로를 반환. 이미 디렉토리면 그대로 반환."""
    if zip_path.is_dir():
        return zip_path

    tmp = Path(tempfile.mkdtemp(prefix='voice-logs-'))
    with zipfile.ZipFile(zip_path, 'r') as zf:
        zf.extractall(tmp)
    return tmp


def load_logs(work_dir: Path) -> list[dict[str, Any]]:
    """voice-logs.json 로드. 'logs' 키 래핑 여부를 자동 감지."""
    logs_file = work_dir / 'voice-logs.json'
    if not logs_file.exists():
        # 최상위 디렉토리가 아닌 하위 경로일 수도 있음
        matches = list(work_dir.rglob('voice-logs.json'))
        if not matches:
            raise FileNotFoundError(f'voice-logs.json 을 찾을 수 없음: {work_dir}')
        logs_file = matches[0]

    data = json.loads(logs_file.read_text(encoding='utf-8'))
    # 내보내기 포맷은 {"logs": [...]} 래핑, 일부 수동 내보내기는 배열 직접
    if isinstance(data, list):
        return data
    return data.get('logs', [])


def find_audio_file(work_dir: Path, log_id: str) -> Path | None:
    """audio/{log_id}.webm 또는 .mp4 파일 탐색."""
    for ext in ('webm', 'mp4', 'm4a', 'mpga', 'mp3', 'wav'):
        candidate = work_dir / 'audio' / f'{log_id}.{ext}'
        if candidate.exists():
            return candidate
        # 재귀 탐색 fallback
        for p in work_dir.rglob(f'{log_id}.{ext}'):
            return p
    return None


# ─────────────────────────────────────────────
# Whisper 전사
# ─────────────────────────────────────────────

WHISPER_PROMPT = (
    '감귤 생육조사 음성 입력입니다. 횡경, 종경, 과중, 과피중, 과피두께, 당도, '
    '적정산도, 산함량, 착색, 비파괴, 조사나무, 조사과실, 비고 등의 용어와 '
    '한국어 숫자(일, 이, 삼, 사, 오, 육, 칠, 팔, 구, 십, 백)가 자주 등장합니다.'
)


def transcribe_whisper(
    client: OpenAI,
    audio_path: Path,
    *,
    use_cache: bool,
    log_id: str,
) -> str | None:
    """Whisper API 호출. 결과는 shared/whisper-cache/{logId}.json 에 캐시."""
    cache_file = CACHE_DIR / f'{log_id}.json'
    if use_cache and cache_file.exists():
        try:
            cached = json.loads(cache_file.read_text(encoding='utf-8'))
            return cached.get('text')
        except json.JSONDecodeError:
            pass  # 손상 시 재호출

    try:
        with audio_path.open('rb') as f:
            resp = client.audio.transcriptions.create(
                model='whisper-1',
                file=f,
                language='ko',
                prompt=WHISPER_PROMPT,
                response_format='json',
                temperature=0,
            )
        text = (resp.text or '').strip()
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(
            json.dumps(
                {'log_id': log_id, 'text': text, 'cached_at': now_iso()},
                ensure_ascii=False,
                indent=2,
            ),
            encoding='utf-8',
        )
        return text
    except Exception as e:
        print(f'  [warn] Whisper 실패 ({log_id}): {e}', file=sys.stderr)
        return None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────
# 메인 처리
# ─────────────────────────────────────────────


def process(
    work_dir: Path,
    client: OpenAI,
    *,
    limit: int | None,
    use_cache: bool,
) -> list[ComparisonRow]:
    logs = load_logs(work_dir)
    recognition_logs = [l for l in logs if l.get('kind') == 'recognition']
    print(
        f'[info] 전체 로그 {len(logs)}건 중 recognition {len(recognition_logs)}건 대상',
        file=sys.stderr,
    )
    if limit:
        recognition_logs = recognition_logs[:limit]
        print(f'[info] --limit {limit} 적용', file=sys.stderr)

    rows: list[ComparisonRow] = []
    processed = 0
    with_audio = 0

    for log in recognition_logs:
        log_id = log.get('id') or ''
        chrome_text = (log.get('rawText') or '').strip()
        audio_path = find_audio_file(work_dir, log_id)

        whisper_text = ''
        if audio_path is not None:
            with_audio += 1
            t = transcribe_whisper(
                client, audio_path, use_cache=use_cache, log_id=log_id
            )
            whisper_text = (t or '').strip()
            processed += 1
            if processed % 10 == 0:
                print(f'  [progress] {processed}/{len(recognition_logs)}', file=sys.stderr)

        parse = log.get('parse') or {}
        rows.append(
            ComparisonRow(
                log_id=log_id,
                ts=log.get('ts', ''),
                app_version=log.get('appVersion', ''),
                chrome_text=chrome_text,
                whisper_text=whisper_text,
                parsed_field=parse.get('field'),
                parsed_value=parse.get('value'),
                status=log.get('status', ''),
                message=log.get('message', ''),
                agree=(chrome_text == whisper_text) and bool(chrome_text),
                ko_num_ambig=is_ko_num_involved(chrome_text)
                or is_ko_num_involved(whisper_text),
            )
        )

    print(
        f'[info] 오디오 포함 {with_audio}건 / Whisper 호출 {processed}건',
        file=sys.stderr,
    )
    return rows


# ─────────────────────────────────────────────
# 리포트 작성
# ─────────────────────────────────────────────


def write_csv(rows: Iterable[ComparisonRow], out_path: Path) -> None:
    with out_path.open('w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(CSV_HEADER)
        for r in rows:
            w.writerow(r.to_csv_row())


def write_md(rows: list[ComparisonRow], out_path: Path, source: str) -> None:
    total = len(rows)
    with_whisper = [r for r in rows if r.whisper_text]
    agree_n = sum(1 for r in with_whisper if r.agree)
    disagree = [r for r in with_whisper if not r.agree]

    # 파서 결과 기준
    chrome_success = sum(1 for r in rows if r.parsed_field)
    status_fail = sum(1 for r in rows if r.status == 'error')
    status_warn = sum(1 for r in rows if r.status == 'warn')

    # Whisper 기준 잠재적 구제 건수: Chrome 파싱 실패 + Whisper 전사가 더 상식적
    potential_rescue = [
        r
        for r in disagree
        if r.status in ('error', 'warn') and r.whisper_text
    ]

    lines: list[str] = []
    lines.append(f'# Whisper vs Chrome Web Speech 대조 리포트')
    lines.append('')
    lines.append(f'- 소스: `{source}`')
    lines.append(f'- 생성: {now_iso()}')
    lines.append(f'- 전체 recognition: **{total}건**')
    lines.append(f'- Whisper 전사 성공: **{len(with_whisper)}건**')
    lines.append('')
    lines.append('## 1. 요약 통계')
    lines.append('')
    lines.append(f'| 지표 | 값 |')
    lines.append(f'|------|-----|')
    lines.append(
        f'| Chrome 파서 필드 매칭 성공 | {chrome_success}/{total} ({pct(chrome_success, total)}) |'
    )
    lines.append(
        f'| Chrome 상태 warn | {status_warn}/{total} ({pct(status_warn, total)}) |'
    )
    lines.append(
        f'| Chrome 상태 error | {status_fail}/{total} ({pct(status_fail, total)}) |'
    )
    if with_whisper:
        lines.append(
            f'| Whisper vs Chrome 전사 완전 일치 | {agree_n}/{len(with_whisper)} ({pct(agree_n, len(with_whisper))}) |'
        )
        lines.append(
            f'| Chrome 실패(warn/error) + Whisper 전사 존재 | {len(potential_rescue)}건 (alias 후보 원천) |'
        )
    lines.append('')

    # 불일치 케이스 상위 30건
    lines.append('## 2. 전사 불일치 케이스 (상위 30건)')
    lines.append('')
    lines.append('| # | Chrome | Whisper | 파서 field | status | message |')
    lines.append('|---|--------|---------|-----------|--------|---------|')
    for i, r in enumerate(disagree[:30], 1):
        lines.append(
            f'| {i} | `{escape_pipe(r.chrome_text)}` | `{escape_pipe(r.whisper_text)}` '
            f'| {r.parsed_field or "-"} | {r.status} | {escape_pipe(r.message)} |'
        )
    if len(disagree) > 30:
        lines.append('')
        lines.append(f'... 외 {len(disagree) - 30}건은 CSV 참고')
    lines.append('')

    # Chrome 실패 + Whisper 구제 후보
    lines.append('## 3. alias / normalizer 개선 후보 (Chrome 실패 + Whisper 전사 성공)')
    lines.append('')
    lines.append('이 케이스들은 Whisper가 정확히 알아들은 발화를 Chrome이 놓친 것입니다.')
    lines.append('Whisper 전사에서 잘못된 alias 후보를 추가하거나 normalizer 규칙을')
    lines.append('보완하면 Chrome STT에서도 구제할 수 있습니다.')
    lines.append('')
    lines.append('| # | Chrome (오전사) | Whisper (정확) | 파서 field | message |')
    lines.append('|---|---------------|---------------|-----------|---------|')
    for i, r in enumerate(potential_rescue[:50], 1):
        lines.append(
            f'| {i} | `{escape_pipe(r.chrome_text)}` | `{escape_pipe(r.whisper_text)}` '
            f'| {r.parsed_field or "-"} | {escape_pipe(r.message)} |'
        )
    if len(potential_rescue) > 50:
        lines.append('')
        lines.append(f'... 외 {len(potential_rescue) - 50}건은 CSV 참고')
    lines.append('')

    # 한국어 숫자 관련 케이스
    ko_num_cases = [r for r in disagree if r.ko_num_ambig]
    lines.append('## 4. 한국어 숫자(영/일/이/삼/...) 관련 불일치')
    lines.append('')
    lines.append(f'- 한국어 숫자가 관여한 불일치: **{len(ko_num_cases)}건**')
    lines.append('')
    if ko_num_cases:
        lines.append('| Chrome | Whisper | 파서 value |')
        lines.append('|--------|---------|-----------|')
        for r in ko_num_cases[:30]:
            lines.append(
                f'| `{escape_pipe(r.chrome_text)}` | `{escape_pipe(r.whisper_text)}` '
                f'| {r.parsed_value if r.parsed_value is not None else "-"} |'
            )
    lines.append('')

    # 앱 버전별 분포 (Sprint 7 phrases biasing 효과 초안)
    versions: dict[str, int] = {}
    for r in rows:
        versions[r.app_version] = versions.get(r.app_version, 0) + 1
    lines.append('## 5. 앱 버전별 분포')
    lines.append('')
    for v, n in sorted(versions.items()):
        lines.append(f'- `{v}`: {n}건')
    lines.append('')

    lines.append('---')
    lines.append('')
    lines.append(
        '**다음 단계:** 섹션 3의 구제 후보를 `shared/alias-candidates-*.json` 으로 옮겨'
    )
    lines.append('backend 에이전트에 `alias.ts` / `normalizer.ts` 개선 위임.')
    lines.append('')

    out_path.write_text('\n'.join(lines), encoding='utf-8')


def pct(n: int, total: int) -> str:
    if total == 0:
        return '0%'
    return f'{100 * n / total:.1f}%'


def escape_pipe(s: str) -> str:
    return (s or '').replace('|', '\\|').replace('\n', ' ')


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Whisper API로 voice-logs-*.zip을 재전사하여 Chrome 전사와 대조합니다.'
    )
    parser.add_argument(
        'source', type=Path, help='voice-logs-*.zip 경로 또는 unzip된 디렉토리'
    )
    parser.add_argument(
        '--limit', type=int, default=None, help='처리할 recognition 수 제한'
    )
    parser.add_argument(
        '--no-cache', action='store_true', help='whisper-cache 무시하고 재호출'
    )
    args = parser.parse_args()

    load_dotenv(SECRETS_ENV)
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        print(f'[error] OPENAI_API_KEY 없음 ({SECRETS_ENV})', file=sys.stderr)
        return 1

    if not args.source.exists():
        print(f'[error] 입력 경로 없음: {args.source}', file=sys.stderr)
        return 1

    client = OpenAI(api_key=api_key)
    work_dir = unpack_zip(args.source)

    SHARED_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    rows = process(
        work_dir,
        client,
        limit=args.limit,
        use_cache=not args.no_cache,
    )

    date_tag = datetime.now().strftime('%Y%m%d')
    md_path = SHARED_DIR / f'whisper-comparison-{date_tag}.md'
    csv_path = SHARED_DIR / f'whisper-comparison-{date_tag}.csv'

    source_label = args.source.name
    write_csv(rows, csv_path)
    write_md(rows, md_path, source_label)

    print(f'[done] MD  -> {md_path}', file=sys.stderr)
    print(f'[done] CSV -> {csv_path}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
