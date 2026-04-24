/**
 * pages/GuidedModeController.ts — 가이드 모드 컨트롤러 (F035-이슈#4)
 *
 * 목적: 가이드 모드에서 조사 항목을 순차적으로 안내하고 행 자동 저장/진행을 관리합니다.
 *
 * 동작 개요:
 * 1. start() 호출 시 첫 번째 미입력 필드의 TTS 안내 시작
 * 2. onFieldSaved(fieldKey) — 필드 저장 완료 시 호출. 다음 필드 안내 또는 행 완료 처리
 * 3. skipCurrent() — 현재 대기 필드를 건너뜁니다 ("다음"/"패스" 명령어 처리)
 * 4. stop() — 가이드 모드 비활성화
 *
 * 설계 참고:
 * - GUIDED_FIELD_SEQUENCE[surveyType]를 기본 순서로 사용 (fallback)
 * - getFilledFields()로 이미 입력된 필드를 추적
 * - speakField()는 SurveyInputPage의 A1 경로를 재사용 (setAwaitingValueFor + TTS)
 * - finalizeRow()는 현재 행을 저장하고 다음 행 세션 필드를 반환
 * - diffSession()으로 변경된 세션 필드만 TTS 공지
 */

import type { SurveyType } from '../types.js';
import { GUIDED_FIELD_SEQUENCE } from '../types.js';
import type { TtsService } from '../services/TtsService.js';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

/**
 * finalizeRow() 반환값.
 * 다음 행으로 이동 후 변경된 세션 필드 정보를 포함합니다.
 */
export interface RowAdvanceInfo {
  /** 다음 행 세션 필드 (treeNo, fruitNo 등) */
  nextSession: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// 가이드 모드에서 diff 비교할 세션 필드 키
// 참고: SurveyInputPage.SESSION_FIELD_KEYS (라우팅용)와 다릅니다.
//   라우팅용: farmerName/label/treatment/treeNo
//   가이드 diff용: treeNo(+fruitNo for quality) — 행 이동 시 알림 대상
// ─────────────────────────────────────────────

const SESSION_GUIDED_DIFF_KEYS_GROWTH = ['treeNo'] as const;
const SESSION_GUIDED_DIFF_KEYS_QUALITY = ['treeNo', 'fruitNo'] as const;

/** 필드 키 → TTS 표시 레이블 매핑 */
const FIELD_LABEL_MAP: Readonly<Record<string, string>> = {
  treeNo: '조사나무',
  fruitNo: '조사과실',
  width: '횡경',
  height: '종경',
  fruitWeight: '과중',
  pericarpWeight: '과피중',
  pericarpThickness: '과피두께',
  brix: '당도',
  titratableAcidity: '적정산도',
  acidContent: '산함량',
  coloring: '착색',
  nonDestructive: '비파괴',
  remark: '비고',
};

// ─────────────────────────────────────────────
// GuidedModeController 클래스
// ─────────────────────────────────────────────

export class GuidedModeController {
  /**
   * 가이드 모드 활성 상태.
   * SurveyInputPage에서 isSkipCommand 처리 시 확인합니다.
   */
  isActive = false;

  /** 현재 가이드 중인 필드 키 (skip 처리에 사용) */
  private currentField: string | null = null;

  /** 가이드 항목 순서 (GUIDED_FIELD_SEQUENCE fallback) */
  private readonly seq: readonly string[];

  /** Codex MEDIUM #3: 활성 setTimeout 핸들 (stop() 시 전부 clear) */
  private pendingTimers: Set<ReturnType<typeof setTimeout>> = new Set();

  /**
   * @param surveyType        조사 유형 ('growth' | 'quality')
   * @param ttsService        TtsService 인스턴스 (diff 알림용)
   * @param getFilledFields   현재 입력된 필드 키 집합 반환 함수
   * @param speakField        특정 필드를 TTS 안내 + awaitingValueFor 설정 함수 (A1 재사용)
   * @param finalizeRow       현재 행 저장 + 다음 행 세션 필드 자동 증가 함수
   * @param getSessionFields  현재 세션 필드 반환 함수
   */
  constructor(
    private readonly surveyType: SurveyType,
    private readonly ttsService: TtsService,
    private readonly getFilledFields: () => Set<string>,
    private readonly speakField: (fieldKey: string) => void,
    private readonly finalizeRow: () => Promise<RowAdvanceInfo>,
    private readonly getSessionFields: () => Record<string, unknown>,
  ) {
    this.seq = GUIDED_FIELD_SEQUENCE[surveyType];
  }

  /**
   * 가이드 모드를 시작합니다.
   * 첫 번째 미입력 필드의 TTS 안내를 시작합니다.
   */
  start(): void {
    this.isActive = true;
    this.advance();
  }

  /**
   * 가이드 모드를 중지합니다.
   * 마이크 토글 off 시 호출됩니다 (재개는 start() 재호출).
   */
  stop(): void {
    this.isActive = false;
    this.currentField = null;
    // Codex MEDIUM #3: 대기 중인 타이머 전부 정리 (stale TTS/advance 방지)
    for (const t of this.pendingTimers) clearTimeout(t);
    this.pendingTimers.clear();
  }

  /**
   * Codex MEDIUM #3: 추적되는 setTimeout — stop() 시 자동 정리.
   */
  private scheduleTimer(cb: () => void, ms: number): void {
    const t = setTimeout(() => {
      this.pendingTimers.delete(t);
      if (this.isActive) cb();
    }, ms);
    this.pendingTimers.add(t);
  }

  /**
   * 필드 저장 완료 후 호출됩니다.
   * 다음 미입력 필드를 안내하거나, 모든 필드가 채워지면 행 저장 + 다음 행으로 이동합니다.
   *
   * @param _fieldKey 저장된 필드 키 (현재 미사용, 확장성 위해 유지)
   */
  async onFieldSaved(_fieldKey: string): Promise<void> {
    if (!this.isActive) return;

    const filled = this.getFilledFields();
    // remark는 선택 항목이므로 필수 필드 완료 판단에서 제외
    const requiredRemaining = this.seq.filter((k) => k !== 'remark' && !filled.has(k));

    if (requiredRemaining.length === 0) {
      // 한 행의 필수 필드 모두 채워짐 → 행 저장 + 다음 행 세팅
      try {
        const prevSession = { ...this.getSessionFields() };
        await this.finalizeRow();
        const nextSession = this.getSessionFields();
        const diffText = this.diffSession(prevSession, nextSession);
        if (diffText) {
          this.ttsService.speak(diffText);
        }
        // diff TTS 재생 후 잠시 대기하고 다음 행 첫 필드 안내
        this.scheduleTimer(() => this.advance(), 900);
      } catch (err) {
        console.error('[GuidedModeController] finalizeRow 실패:', err instanceof Error ? err.message : String(err));
        // 저장 실패해도 가이드 모드 계속 (사용자가 직접 저장 버튼으로 처리 가능)
        if (this.isActive) this.advance();
      }
      return;
    }

    // 아직 미입력 필드 있음 → 다음 필드 안내
    this.advance();
  }

  /**
   * 현재 대기 중인 필드를 건너뜁니다.
   * "다음"/"패스"/"스킵"/"건너뛰기" 명령어 처리 시 SurveyInputPage에서 호출됩니다.
   */
  skipCurrent(): void {
    if (!this.isActive) return;
    this.advance({ skipCurrent: true });
  }

  // ─────────────────────────────────────────────
  // 내부 메서드
  // ─────────────────────────────────────────────

  /**
   * 다음 미입력 필드를 결정하고 speakField()를 호출합니다.
   *
   * @param opts.skipCurrent true이면 현재 currentField를 후보에서 제외
   */
  private advance(opts: { skipCurrent?: boolean } = {}): void {
    const filled = this.getFilledFields();
    // skipCurrent 시 currentField도 임시로 filled에 추가하여 건너뜀
    const skipKey = opts.skipCurrent ? this.currentField : null;

    const candidates = this.seq.filter((k) => {
      if (filled.has(k)) return false;
      if (skipKey !== null && k === skipKey) return false;
      return true;
    });

    const next = candidates[0];
    if (!next) {
      // 모든 필드가 채워졌거나 skip으로 인해 후보가 없음
      // onFieldSaved에서 행 완료 처리 → 여기서는 noop
      return;
    }

    this.currentField = next;
    this.speakField(next);
  }

  /**
   * 이전 행과 다음 행의 세션 필드를 비교하여 변경된 항목만 TTS 텍스트로 반환합니다.
   * 예: treeNo 1→2 → "조사나무 2", fruitNo 1→2 → "조사과실 2"
   *
   * @param prev 이전 행 세션 필드
   * @param next 다음 행 세션 필드
   * @returns 변경된 항목 TTS 텍스트 (예: "조사나무 2 조사과실 1") 또는 빈 문자열
   */
  private diffSession(prev: Record<string, unknown>, next: Record<string, unknown>): string {
    const diffKeys = this.surveyType === 'quality'
      ? SESSION_GUIDED_DIFF_KEYS_QUALITY
      : SESSION_GUIDED_DIFF_KEYS_GROWTH;

    const parts: string[] = [];
    for (const k of diffKeys) {
      if (prev[k] !== next[k] && next[k] != null) {
        const label = FIELD_LABEL_MAP[k] ?? k;
        parts.push(`${label} ${String(next[k])}`);
      }
    }
    return parts.join(' ');
  }
}
