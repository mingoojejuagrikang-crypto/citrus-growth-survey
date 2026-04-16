/**
 * pages/SttTestPage.ts — STT 인식 정확도 독립 테스트 페이지
 *
 * 목적: 음성 인식 결과를 실제 조사 저장과 무관하게 테스트하고,
 *       파서 결과 및 인식 통계를 실시간으로 확인합니다.
 *
 * 구현 방침:
 * - SttService / TtsService를 SurveyInputPage와 동일하게 사용
 * - growth 기준 activeFields 사용 (width, height, remark)
 * - 인식 결과는 항상 VoiceLogService.saveLog()로 저장
 * - 저장 후 로그 목록 자동 갱신
 * - mount() / unmount() 패턴 준수
 */

import { SttService } from '../services/SttService.js';
import { TtsService } from '../services/TtsService.js';
import * as VoiceLogService from '../services/VoiceLogService.js';
import { parse } from '../parser/parser.js';
import type { SttResultEvent, VoiceLog, ParseResult } from '../types.js';
import { nowIso } from '../utils/dateUtils.js';

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

/** growth 기준 activeFields (auto 타입 제외) */
const ACTIVE_FIELDS = ['width', 'height', 'remark'];

/** 로그 목록 최대 표시 건수 */
const MAX_LOG_DISPLAY = 20;

/** 필드 → 한국어 라벨 매핑 */
const FIELD_LABEL_MAP: Record<string, string> = {
  width: '횡경',
  height: '종경',
  remark: '비고',
};

// ─────────────────────────────────────────────
// SttTestPage 클래스
// ─────────────────────────────────────────────

export class SttTestPage {
  private el: HTMLElement | null = null;
  private sttService: SttService | null = null;
  private ttsService: TtsService | null = null;
  private isVoiceActive = false;
  private voiceBtnEl: HTMLButtonElement | null = null;
  private lastField: string | null = null;

  // ── 공개 메서드 ──

  mount(container: HTMLElement): void {
    this.el = document.createElement('div');
    container.appendChild(this.el);

    this.render();
    this.initVoiceServices();
    this.loadAndRenderLogs();
  }

  unmount(): void {
    this.sttService?.stop();
    this.sttService = null;
    this.ttsService?.cancel();
    this.ttsService = null;
    this.voiceBtnEl = null;
    this.isVoiceActive = false;

    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  // ── 렌더링 ──

  private render(): void {
    if (!this.el) return;

    this.el.innerHTML = `
      <div class="page" style="padding-top:0;">

        <!-- 헤더 -->
        <div class="page-header" style="position:sticky;top:0;z-index:20;">
          <h1>STT 테스트</h1>
        </div>

        <div style="padding:var(--padding-mobile);padding-bottom:calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 24px);">

          <!-- 음성 인식 영역 -->
          <section style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:16px;margin-bottom:16px;">
            <div style="font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);color:var(--color-text-secondary);margin-bottom:12px;">음성 인식</div>

            <!-- 큰 마이크 버튼 -->
            <div class="voice-primary-area" style="margin-bottom:12px;">
              <button class="btn-voice-primary" id="stt-test-voice-btn" type="button">
                <span class="voice-btn-icon">🎤</span>
                <span class="voice-btn-label">음성 입력</span>
                <span class="voice-btn-sub">탭하여 시작</span>
              </button>
            </div>

            <!-- 중간 텍스트 (interim) 실시간 표시 -->
            <div id="stt-interim-area" style="
              background:var(--color-bg);
              border:1px solid var(--color-border-light);
              border-radius:var(--radius-sm);
              padding:12px;
              min-height:56px;
              margin-bottom:8px;
              font-size:var(--font-size-md);
              color:var(--color-text-secondary);
              line-height:1.5;
            ">
              <span id="stt-interim-text" style="color:var(--color-text-disabled);">...</span>
            </div>

            <!-- 최종 인식 결과 -->
            <div id="stt-final-area" style="
              background:#e8f5e9;
              border:1px solid rgba(46,125,50,0.3);
              border-radius:var(--radius-sm);
              padding:12px;
              min-height:56px;
              font-size:var(--font-size-md);
              font-weight:var(--font-weight-semibold);
              color:var(--color-primary);
              line-height:1.5;
            ">
              <span id="stt-final-text" style="color:var(--color-text-disabled);font-weight:normal;">인식 결과가 여기에 표시됩니다</span>
            </div>
          </section>

          <!-- 파서 결과 -->
          <section style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:16px;margin-bottom:16px;">
            <div style="font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);color:var(--color-text-secondary);margin-bottom:12px;">파서 결과</div>
            <div id="stt-parse-result" style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">
              아직 인식 결과가 없습니다.
            </div>
          </section>

          <!-- 통계 -->
          <section style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:16px;margin-bottom:16px;">
            <div style="font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);color:var(--color-text-secondary);margin-bottom:12px;">통계</div>
            <div id="stt-stats" style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">
              로그 로딩 중...
            </div>
          </section>

          <!-- 최근 로그 20건 -->
          <section style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:16px;">
            <div style="font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);color:var(--color-text-secondary);margin-bottom:12px;">최근 로그 (최대 ${MAX_LOG_DISPLAY}건)</div>
            <div id="stt-log-list">
              <div style="color:var(--color-text-disabled);font-size:var(--font-size-sm);">로딩 중...</div>
            </div>
          </section>

        </div>
      </div>
    `;

    // 음성 버튼 이벤트 바인딩
    const voiceBtn = this.el.querySelector<HTMLButtonElement>('#stt-test-voice-btn');
    if (voiceBtn) {
      this.voiceBtnEl = voiceBtn;
      voiceBtn.addEventListener('click', () => this.handleToggleVoice());
    }
  }

  // ── 음성 서비스 초기화 ──

  private initVoiceServices(): void {
    this.sttService = new SttService();
    this.ttsService = new TtsService();

    // 중간 인식 결과 표시
    this.sttService.onInterim = (text: string) => {
      this.updateInterimText(text);
    };

    // 최종 인식 결과 처리
    this.sttService.onResult = (event: SttResultEvent) => {
      this.handleSttResult(event);
    };

    // 상태 변화 콜백 (현재 로그만)
    this.sttService.onStateChange = () => {
      // 상태 변화는 버튼 UI로만 표현
    };

    // 에러 처리
    this.sttService.onError = (msg: string) => {
      this.isVoiceActive = false;
      this.updateVoiceBtnUI(false);
      this.updateInterimText(`오류: ${msg}`);
    };

    // STT 미지원 브라우저 처리
    const w = window as unknown as Record<string, unknown>;
    const hasStt = ('SpeechRecognition' in w) || ('webkitSpeechRecognition' in w);
    if (!hasStt && this.voiceBtnEl) {
      this.voiceBtnEl.disabled = true;
      this.voiceBtnEl.classList.add('unsupported');
      const subEl = this.voiceBtnEl.querySelector<HTMLElement>('.voice-btn-sub');
      if (subEl) subEl.textContent = '이 브라우저는 음성 인식을 지원하지 않습니다';
    }
  }

  // ── 음성 버튼 토글 ──

  private handleToggleVoice(): void {
    if (!this.sttService) return;
    if (this.isVoiceActive) {
      this.sttService.stop();
      this.isVoiceActive = false;
      this.updateVoiceBtnUI(false);
      this.updateInterimText('');
    } else {
      this.sttService.start();
      this.isVoiceActive = true;
      this.updateVoiceBtnUI(true);
    }
  }

  // ── STT 최종 결과 처리 ──

  private handleSttResult(event: SttResultEvent): void {
    const rawText = event.transcript;

    // 최종 결과 표시
    this.updateFinalText(rawText);

    // 파서 실행
    const result: ParseResult = parse(rawText, {
      lastField: this.lastField,
      surveyType: 'growth',
      activeFields: ACTIVE_FIELDS,
    });

    // lastField 업데이트 (값만 발화 수정 모드를 위해)
    if (result.field) {
      this.lastField = result.field;
    }

    // 파서 결과 표시
    this.renderParseResult(rawText, result);

    // TTS 피드백
    if (result.field && result.score >= 0.5) {
      const fieldLabel = FIELD_LABEL_MAP[result.field] ?? result.field;
      const prefix = result.isCorrection ? '수정 ' : '';
      this.ttsService?.speak(`${prefix}${fieldLabel} ${result.value ?? ''}`);
    } else {
      this.ttsService?.speak('다시 말씀해 주세요');
    }

    // 로그 저장 (테스트 페이지에서도 항상 저장)
    const kind = result.field && result.score >= 0.5 ? 'ok' : 'fail';
    VoiceLogService.saveLog({
      ts: nowIso(),
      kind,
      rawText,
      alternatives: event.alternatives,
      parse: result.field !== null ? {
        field: result.field,
        value: result.value,
        score: result.score,
        method: result.method,
      } : null,
      status: kind === 'ok' ? 'accepted' : 'rejected',
      message: result.field ? `${FIELD_LABEL_MAP[result.field] ?? result.field} ${result.value ?? ''}` : '다시 말씀해 주세요',
      audioFileId: null,
      session: 'stt-test',
    }).then(() => {
      // 저장 완료 후 로그 목록 갱신
      this.loadAndRenderLogs();
    }).catch(() => {
      // 로그 저장 실패는 무시
    });
  }

  // ── 파서 결과 렌더링 ──

  private renderParseResult(rawText: string, result: ParseResult): void {
    const el = this.el?.querySelector<HTMLElement>('#stt-parse-result');
    if (!el) return;

    const fieldLabel = result.field
      ? (FIELD_LABEL_MAP[result.field] ?? result.field)
      : '—';

    const scoreColor = result.score >= 0.8
      ? 'var(--color-primary)'
      : result.score >= 0.5
        ? 'var(--color-warning)'
        : 'var(--color-error)';

    const modeText = result.isCorrection ? ' (수정 모드)' : '';

    el.innerHTML = `
      <div style="display:grid;gap:6px;">
        <div style="display:flex;gap:8px;align-items:baseline;">
          <span style="flex:0 0 72px;color:var(--color-text-secondary);">rawText</span>
          <span style="font-weight:var(--font-weight-medium);color:var(--color-text);">"${this.escapeHtml(rawText)}"</span>
        </div>
        <div style="display:flex;gap:8px;align-items:baseline;">
          <span style="flex:0 0 72px;color:var(--color-text-secondary);">필드</span>
          <span style="font-weight:var(--font-weight-medium);color:var(--color-text);">${this.escapeHtml(fieldLabel)}${this.escapeHtml(modeText)}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:baseline;">
          <span style="flex:0 0 72px;color:var(--color-text-secondary);">값</span>
          <span style="font-weight:var(--font-weight-medium);color:var(--color-text);">${this.escapeHtml(result.value ?? '—')}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:baseline;">
          <span style="flex:0 0 72px;color:var(--color-text-secondary);">신뢰도</span>
          <span style="font-weight:var(--font-weight-semibold);color:${scoreColor};">${(result.score * 100).toFixed(0)}%</span>
        </div>
        <div style="display:flex;gap:8px;align-items:baseline;">
          <span style="flex:0 0 72px;color:var(--color-text-secondary);">method</span>
          <span style="color:var(--color-text);">${this.escapeHtml(result.method)}</span>
        </div>
        ${result.warning ? `
        <div style="display:flex;gap:8px;align-items:baseline;">
          <span style="flex:0 0 72px;color:var(--color-text-secondary);">경고</span>
          <span style="color:var(--color-warning);">${this.escapeHtml(result.warning)}</span>
        </div>
        ` : ''}
      </div>
    `;
  }

  // ── 로그 목록 로드 및 렌더링 ──

  private async loadAndRenderLogs(): Promise<void> {
    try {
      const logs = await VoiceLogService.getLogs();
      const recent = logs.slice(0, MAX_LOG_DISPLAY);
      this.renderLogList(recent);
      this.renderStats(logs);
    } catch {
      const listEl = this.el?.querySelector<HTMLElement>('#stt-log-list');
      if (listEl) listEl.innerHTML = '<div style="color:var(--color-error);font-size:var(--font-size-sm);">로그 로딩 실패</div>';
    }
  }

  private renderLogList(logs: VoiceLog[]): void {
    const el = this.el?.querySelector<HTMLElement>('#stt-log-list');
    if (!el) return;

    if (logs.length === 0) {
      el.innerHTML = '<div style="color:var(--color-text-disabled);font-size:var(--font-size-sm);">로그가 없습니다.</div>';
      return;
    }

    el.innerHTML = logs.map((log) => {
      const kindColor = log.kind === 'ok'
        ? 'var(--color-primary)'
        : log.kind === 'warn'
          ? 'var(--color-warning)'
          : 'var(--color-error)';

      const kindLabel = log.kind === 'ok' ? '✓ ok' : log.kind === 'warn' ? '⚠ warn' : '✗ fail';

      const fieldStr = log.parse?.field
        ? `${FIELD_LABEL_MAP[log.parse.field] ?? log.parse.field} → ${log.parse.value ?? '?'}`
        : '—';

      const scoreStr = log.parse?.score !== undefined
        ? `${(log.parse.score * 100).toFixed(0)}%`
        : '—';

      // 시각: HH:MM:SS 부분만 표시
      const timeStr = log.ts.slice(11, 19);

      return `
        <div style="
          padding:10px 0;
          border-bottom:1px solid var(--color-border-light);
          font-size:var(--font-size-xs);
          display:grid;
          grid-template-columns:52px 1fr auto;
          gap:6px;
          align-items:start;
        ">
          <span style="color:var(--color-text-secondary);padding-top:1px;">${this.escapeHtml(timeStr)}</span>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-weight:var(--font-weight-medium);color:var(--color-text);font-size:var(--font-size-sm);">"${this.escapeHtml(log.rawText)}"</span>
            <span style="color:var(--color-text-secondary);">${this.escapeHtml(fieldStr)} · ${this.escapeHtml(scoreStr)}</span>
          </div>
          <span style="color:${kindColor};font-weight:var(--font-weight-semibold);padding-top:1px;white-space:nowrap;">${kindLabel}</span>
        </div>
      `;
    }).join('');
  }

  private renderStats(logs: VoiceLog[]): void {
    const el = this.el?.querySelector<HTMLElement>('#stt-stats');
    if (!el) return;

    const total = logs.length;
    const okCount = logs.filter((l) => l.kind === 'ok').length;
    const failCount = logs.filter((l) => l.kind === 'fail').length;
    const okRate = total > 0 ? ((okCount / total) * 100).toFixed(1) : '0.0';

    // 최근 실패 패턴 수집 (최근 50건 중 fail)
    const recentFails = logs
      .slice(0, 50)
      .filter((l) => l.kind === 'fail')
      .slice(0, 5);

    const failPatternHtml = recentFails.length > 0
      ? `<div style="margin-top:8px;color:var(--color-text-secondary);">최근 실패 패턴:</div>
         <ul style="margin-top:4px;padding-left:0;display:flex;flex-direction:column;gap:2px;">
           ${recentFails.map((l) => `<li style="color:var(--color-error);">"${this.escapeHtml(l.rawText)}"</li>`).join('')}
         </ul>`
      : '';

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;margin-bottom:8px;">
        <div>
          <div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);color:var(--color-text);">${total}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">전체</div>
        </div>
        <div>
          <div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);color:var(--color-primary);">${okRate}%</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">ok 비율</div>
        </div>
        <div>
          <div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);color:var(--color-error);">${failCount}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">실패</div>
        </div>
      </div>
      ${failPatternHtml}
    `;
  }

  // ── UI 업데이트 헬퍼 ──

  private updateVoiceBtnUI(active: boolean): void {
    if (!this.voiceBtnEl) return;
    if (active) {
      this.voiceBtnEl.classList.add('active');
      this.voiceBtnEl.classList.remove('unsupported');
      const iconEl = this.voiceBtnEl.querySelector<HTMLElement>('.voice-btn-icon');
      const subEl = this.voiceBtnEl.querySelector<HTMLElement>('.voice-btn-sub');
      if (iconEl) iconEl.textContent = '🔴';
      if (subEl) subEl.textContent = '듣는 중... (탭하여 중지)';
    } else {
      this.voiceBtnEl.classList.remove('active');
      const iconEl = this.voiceBtnEl.querySelector<HTMLElement>('.voice-btn-icon');
      const subEl = this.voiceBtnEl.querySelector<HTMLElement>('.voice-btn-sub');
      if (iconEl) iconEl.textContent = '🎤';
      if (subEl) subEl.textContent = '탭하여 시작';
    }
  }

  private updateInterimText(text: string): void {
    const el = this.el?.querySelector<HTMLElement>('#stt-interim-text');
    if (!el) return;
    if (text) {
      el.style.color = 'var(--color-text)';
      el.textContent = text;
    } else {
      el.style.color = 'var(--color-text-disabled)';
      el.textContent = '...';
    }
  }

  private updateFinalText(text: string): void {
    const el = this.el?.querySelector<HTMLElement>('#stt-final-text');
    if (!el) return;
    el.style.color = 'var(--color-primary)';
    el.style.fontWeight = 'var(--font-weight-semibold)';
    el.textContent = text;

    // interim도 초기화
    this.updateInterimText('');
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }
}
