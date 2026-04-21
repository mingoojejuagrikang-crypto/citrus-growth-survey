/**
 * pages/SurveyInputPage.ts — 비대조사/품질조사 입력 화면 (F002)
 *
 * 목적: surveyType 파라미터에 따라 비대조사(growth) 또는 품질조사(quality) 입력 화면을 표시합니다.
 *
 * Acceptance Criteria (F002):
 * - 조사일자 기본값: 오늘 날짜
 * - 농가명/라벨/처리: 설정 기본값 목록에서 선택
 * - 조사나무/조사과실: 숫자 직접 입력
 * - 횡경/종경: 소수점 1자리 숫자, 입력값 그대로 보존
 * - 중복 레코드 식별 키 존재 시 ConfirmDialog 표시
 * - 저장 후: 과실번호만 초기화, 나머지 유지
 * - 이상치 경고: 노란 배지 + 저장 시 ConfirmDialog
 *
 * 음성 UX:
 * - TtsEchoDisplay를 통해 인식 결과 표시
 * - VoiceStore.pendingField로 하이라이트된 행 표시
 * - STT 토글 버튼으로 음성 입력 활성화/비활성화
 * - SttService → parser → surveyStore 자동 필드 업데이트
 */

import type { SurveyType, AppDefaults, GrowthRecord, QualityRecord, SessionFields, VoiceState, SurveyState, SttResultEvent } from '../types.js';
import { surveyStore, voiceStore, syncStore } from '../store/index.js';
import * as SettingsService from '../services/SettingsService.js';
import * as IndexedDBService from '../services/IndexedDBService.js';
import * as VoiceLogService from '../services/VoiceLogService.js';
import { SttService } from '../services/SttService.js';
import { TtsService } from '../services/TtsService.js';
import { MediaRecorderService } from '../services/MediaRecorderService.js';
import { parse } from '../parser/parser.js';
import { showConfirm } from '../components/ConfirmDialog.js';
import { TtsEchoDisplay } from '../components/TtsEchoDisplay.js';
import { SyncStatusBar } from '../components/SyncStatusBar.js';
import { validateRecord, validateField } from '../utils/validation.js';
import { makeRecordId, makeSessionKey } from '../utils/recordKey.js';
import { showToast } from '../utils/toast.js';
import { todayString, formatDisplayDate, nowIso } from '../utils/dateUtils.js';
import { collectDeviceInfo } from '../utils/deviceDetect.js';
import { formatFieldValue } from '../utils/formatFieldValue.js';
import { FIELD_DATA_TYPES } from '../types.js';

// ─────────────────────────────────────────────
// 필드 정의 (비대조사 / 품질조사)
// ─────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  unit: string;
  inputType: 'decimal1' | 'integer' | 'text' | 'auto';
  required: boolean;
  placeholder?: string;
}

const GROWTH_FIELDS: FieldDef[] = [
  { key: 'width',  label: '횡경', unit: 'mm', inputType: 'decimal1', required: false, placeholder: '예: 35.1' },
  { key: 'height', label: '종경', unit: 'mm', inputType: 'decimal1', required: false, placeholder: '예: 32.0' },
  { key: 'remark', label: '비고', unit: '',   inputType: 'text',     required: false, placeholder: '자유 입력' },
];

const QUALITY_FIELDS: FieldDef[] = [
  { key: 'width',                label: '횡경',       unit: 'mm',  inputType: 'decimal1', required: false },
  { key: 'height',               label: '종경',       unit: 'mm',  inputType: 'decimal1', required: false },
  { key: 'fruitWeight',          label: '과중',       unit: 'g',   inputType: 'decimal1', required: false },
  { key: 'pericarpWeight',       label: '과피중',     unit: 'g',   inputType: 'decimal1', required: false },
  { key: 'pericarpThickness',    label: '과피두께',   unit: 'mm',  inputType: 'decimal1', required: false },
  { key: 'pericarpThicknessX4',  label: '과피두께×4', unit: 'mm',  inputType: 'auto',     required: false },
  { key: 'brix',                 label: '당도',       unit: '°Bx', inputType: 'decimal1', required: false },
  { key: 'titratableAcidity',    label: '적정산도',   unit: '',    inputType: 'decimal1', required: false },
  { key: 'acidContent',          label: '산함량',     unit: '%',   inputType: 'decimal1', required: false },
  { key: 'sugarAcidRatio',       label: '당산도',     unit: '',    inputType: 'auto',     required: false },
  { key: 'coloring',             label: '착색',       unit: '',    inputType: 'integer',  required: false },
  { key: 'nonDestructive',       label: '비파괴',     unit: '',    inputType: 'decimal1', required: false },
  { key: 'remark',               label: '비고',       unit: '',    inputType: 'text',     required: false },
];

// ─────────────────────────────────────────────
// SurveyInputPage 클래스
// ─────────────────────────────────────────────

export class SurveyInputPage {
  private el: HTMLElement | null = null;
  private surveyType: SurveyType;
  private defaults: AppDefaults = SettingsService.getDefaultAppDefaults();
  private unsubscribers: Array<() => void> = [];
  private ttsEchoDisplay: TtsEchoDisplay | null = null;
  private syncStatusBar: SyncStatusBar | null = null;
  private isSaving = false;

  // 음성 서비스 멤버 변수
  private sttService: SttService | null = null;
  private ttsService: TtsService | null = null;
  private mediaRecorderService: MediaRecorderService | null = null;
  private voiceBtnEl: HTMLButtonElement | null = null;
  private isVoiceActive = false;
  private voiceLogEnabled = false;
  private audioRecordEnabled = false;
  private ttsEnabled = true;

  // 세션 필드 값 (세션 헤더)
  private sessionFields: SessionFields = {
    surveyDate: todayString(),
    baseDate: '',
    farmerName: '',
    label: '',
    treatment: '관행',
    treeNo: 1,
  };

  // 측정값 (Record)
  private fieldValues: Record<string, string> = {};

  constructor(surveyType: SurveyType) {
    this.surveyType = surveyType;
  }

  async mount(container: HTMLElement): Promise<void> {
    this.el = document.createElement('div');
    container.appendChild(this.el);

    // 편집 모드 여부 확인: URL hash에 edit= 파라미터가 있으면 setSurveyType() 호출을 건너뜀
    // (setSurveyType은 currentRecord를 초기화하므로 편집 prefill 전에 호출하면 안 됨)
    const editRecordId = this.getEditParamFromHash();
    if (!editRecordId) {
      // 일반 모드: surveyStore 조사 유형 전환 (currentRecord 초기화)
      surveyStore.setSurveyType(this.surveyType);
    }

    // 설정 로드 — mount마다 최신 설정을 읽어 기본값을 반영
    await this.loadDefaults();

    // 편집 모드: 해당 레코드를 로드하여 폼 prefill
    if (editRecordId) {
      await this.prefillEditRecord(editRecordId);
    }

    // sessionFields를 store에서 가져옴
    const storeState = surveyStore.getState();
    this.sessionFields = { ...storeState.sessionFields };

    // 기존 currentRecord 값 복원
    this.syncFieldValuesFromStore(storeState);

    // 렌더링
    this.render();
    this.mountSubComponents();

    // Store 구독
    this.unsubscribers.push(
      surveyStore.subscribe((state: Readonly<SurveyState>) => {
        this.onSurveyStoreUpdate(state);
      }),
    );

    this.unsubscribers.push(
      voiceStore.subscribe((state: Readonly<VoiceState>) => {
        this.onVoiceStoreUpdate(state);
      }),
    );

    // 음성 서비스 초기화
    await this.initVoiceServices();
  }

  unmount(): void {
    // 음성 서비스 정리
    if (this.sttService) {
      this.sttService.stop();
      this.sttService = null;
    }
    if (this.ttsService) {
      this.ttsService.cancel();
      this.ttsService = null;
    }
    if (this.mediaRecorderService?.isRecording) {
      this.mediaRecorderService.stopRecording().catch(() => {});
    }
    this.mediaRecorderService = null;
    this.voiceBtnEl = null;
    this.isVoiceActive = false;

    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];

    this.ttsEchoDisplay?.unmount();
    this.ttsEchoDisplay = null;

    this.syncStatusBar?.unmount();
    this.syncStatusBar = null;

    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  // ─────────────────────────────────────────────
  // 초기화
  // ─────────────────────────────────────────────

  private async loadDefaults(): Promise<void> {
    try {
      // mount마다 최신 설정을 로드하여 설정 변경이 즉시 반영되도록 함
      this.defaults = await SettingsService.getDefaults();
      // sessionFields 기본값 적용 (이미 값이 있으면 덮어쓰지 않음)
      if (!this.sessionFields.farmerName && this.defaults.defaultFarmerName) {
        this.sessionFields.farmerName = this.defaults.defaultFarmerName;
      }
      if (!this.sessionFields.label && this.defaults.defaultLabel) {
        this.sessionFields.label = this.defaults.defaultLabel;
      }
      if (!this.sessionFields.treatment && this.defaults.defaultTreatment) {
        this.sessionFields.treatment = this.defaults.defaultTreatment;
      }
    } catch {
      // 기본값 사용
    }
  }

  /**
   * URL hash에서 edit= 파라미터를 파싱하여 레코드 ID를 반환합니다.
   * 예: #/survey/growth?edit=rec_abc123 → 'rec_abc123'
   */
  private getEditParamFromHash(): string | null {
    const hash = window.location.hash; // e.g. #/survey/growth?edit=id
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return null;
    const query = hash.slice(queryIndex + 1);
    const params = new URLSearchParams(query);
    return params.get('edit');
  }

  /**
   * 편집 모드: 주어진 레코드 ID를 IndexedDB에서 조회하여
   * surveyStore에 prefill합니다.
   */
  private async prefillEditRecord(recordId: string): Promise<void> {
    try {
      const record = await IndexedDBService.getRecordById(this.surveyType, recordId);
      if (!record) return;

      const r = record as GrowthRecord;
      // 조사 유형을 먼저 설정하되 currentRecord를 빈 값으로 초기화 후 즉시 복원
      surveyStore.setSurveyType(this.surveyType);

      // 세션 필드 복원
      surveyStore.updateSessionFields({
        surveyDate: r.surveyDate,
        farmerName: r.farmerName,
        label: r.label,
        treatment: r.treatment,
        treeNo: r.treeNo,
      });

      // 측정값 복원 (fruitNo 포함)
      const fields = this.getActiveFields();
      const recordMap = record as unknown as Record<string, unknown>;
      for (const field of fields) {
        const val = recordMap[field.key];
        if (val !== undefined && val !== null) {
          surveyStore.updateField(field.key, val);
        }
      }
      // fruitNo 복원
      surveyStore.updateField('fruitNo', r.fruitNo);
    } catch {
      // prefill 실패 시 빈 폼으로 진행
    }
  }

  private syncFieldValuesFromStore(state: Readonly<SurveyState>): void {
    const record = state.currentRecord as Record<string, unknown>;
    const fields = this.getActiveFields();
    for (const field of fields) {
      const val = record[field.key];
      if (val !== undefined && val !== null) {
        this.fieldValues[field.key] = String(val);
      }
    }
  }

  // ─────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────

  private render(): void {
    if (!this.el) return;

    const isGrowth = this.surveyType === 'growth';
    const titleText = isGrowth ? '비대조사' : '품질조사';

    this.el.innerHTML = `
      <div class="page" id="survey-page-inner" style="padding-top:0;">

        <!-- 페이지 헤더 -->
        <div class="page-header" style="position:sticky;top:0;z-index:20;">
          <h1>${titleText}</h1>
          <button class="btn btn-ghost" id="load-session-btn" type="button" style="font-size:14px;color:var(--color-primary);">
            세션 불러오기
          </button>
        </div>

        <div style="padding:var(--padding-mobile);padding-bottom:calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 100px);">

          <!-- 동기화 상태 바 -->
          <div id="sync-status-container"></div>

          <!-- 세션 헤더 입력 -->
          <section class="session-header" id="session-header">
            ${this.renderSessionHeaderHTML()}
          </section>

          <!-- 측정값 입력 -->
          <section class="measurement-section">
            <div class="measurement-section-title">측정값</div>
            <div id="field-list">
              ${this.renderFieldListHTML()}
            </div>
          </section>

          <!-- 음성 입력 영역 (항상 표시, 기본 입력 수단) -->
          <div class="voice-primary-area" id="voice-primary-area">
            <button class="btn-voice-primary" id="voice-btn" type="button">
              <span class="voice-btn-icon">🎤</span>
              <span class="voice-btn-label">음성 입력</span>
              <span class="voice-btn-sub">탭하여 시작</span>
            </button>
          </div>
          <!-- 저장 버튼 -->
          <div class="save-area" style="margin-top:12px;">
            <button class="btn btn-primary btn-full" id="save-btn" type="button" style="height:52px;font-size:18px;">
              저장
            </button>
          </div>

        </div>
      </div>

      <!-- 최근 세션 바텀 시트 (숨김) -->
      <div id="recent-session-sheet" style="display:none;"></div>
    `;

    this.bindEvents();
  }

  private renderSessionHeaderHTML(): string {
    const { surveyDate, farmerName, label, treatment, treeNo } = this.sessionFields;
    const { farmerNames, labels, treatments, treeRange } = this.defaults;

    const farmerOptions = farmerNames.map((n) =>
      `<option value="${this.escapeAttr(n)}" ${n === farmerName ? 'selected' : ''}>${this.escapeHtml(n)}</option>`
    ).join('');

    const labelOptions = labels.map((l) =>
      `<option value="${this.escapeAttr(l)}" ${l === label ? 'selected' : ''}>${this.escapeHtml(l)}</option>`
    ).join('');

    const treatmentOptions = treatments.map((t) =>
      `<option value="${this.escapeAttr(t)}" ${t === treatment ? 'selected' : ''}>${this.escapeHtml(t)}</option>`
    ).join('');

    // 조사나무 options 생성
    const treeOptions = [];
    for (let i = treeRange.min; i <= treeRange.max; i++) {
      treeOptions.push(`<option value="${i}" ${i === treeNo ? 'selected' : ''}>${i}번</option>`);
    }

    return `
      <div class="session-header-row">
        <span class="session-header-label">조사일자</span>
        <div class="session-header-value">
          <input
            type="date"
            id="session-date"
            class="session-header-input"
            value="${surveyDate}"
          />
        </div>
      </div>
      <div class="session-header-row">
        <span class="session-header-label">농가명</span>
        <div class="session-header-value">
          <select id="session-farmer" class="session-header-select">
            ${farmerOptions}
          </select>
        </div>
      </div>
      <div class="session-header-row">
        <span class="session-header-label">라벨</span>
        <div class="session-header-value">
          <select id="session-label" class="session-header-select">
            ${labelOptions}
          </select>
        </div>
      </div>
      <div class="session-header-row">
        <span class="session-header-label">처리</span>
        <div class="session-header-value">
          <select id="session-treatment" class="session-header-select">
            ${treatmentOptions}
          </select>
        </div>
      </div>
      <div class="session-header-row">
        <span class="session-header-label">조사나무</span>
        <div class="session-header-value">
          <select id="session-tree" class="session-header-select">
            ${treeOptions}
          </select>
        </div>
      </div>
      <div class="session-header-row">
        <span class="session-header-label">조사과실</span>
        <div class="session-header-value">
          <input
            type="number"
            id="session-fruit"
            class="session-header-input"
            value="${(surveyStore.getState().currentRecord as Partial<GrowthRecord>).fruitNo ?? ''}"
            min="1" max="5"
            placeholder="1~5"
            inputmode="numeric"
          />
        </div>
      </div>
    `;
  }

  private renderFieldListHTML(highlightedField?: string | null): string {
    const fields = this.getActiveFields();
    const record = surveyStore.getState().currentRecord as Record<string, unknown>;

    return fields.map((field) => {
      const isAuto = field.inputType === 'auto';
      const isHighlighted = highlightedField === field.key;
      const currentVal = this.fieldValues[field.key] ?? (record[field.key] != null ? String(record[field.key]) : '');

      // 이상치 체크
      const numVal = parseFloat(currentVal);
      let hasWarning = false;
      if (!isNaN(numVal) && !isAuto) {
        const result = validateField(field.key, numVal);
        hasWarning = result.warning;
      }

      return `
        <div class="field-row${isHighlighted ? ' highlighted' : ''}" data-field="${this.escapeAttr(field.key)}">
          <span class="field-row-label">
            ${this.escapeHtml(field.label)}
            ${hasWarning ? '<span class="field-warning-dot" title="이상치 범위"></span>' : ''}
          </span>
          <div class="field-row-input-wrap">
            <input
              type="${field.inputType === 'text' ? 'text' : 'number'}"
              class="field-row-input${hasWarning ? ' has-warning' : ''}${isAuto ? '' : ''}"
              data-field-key="${this.escapeAttr(field.key)}"
              value="${this.escapeAttr(currentVal)}"
              placeholder="${field.placeholder ?? ''}"
              ${field.inputType === 'decimal1' ? 'step="0.1" inputmode="decimal"' : ''}
              ${field.inputType === 'integer' ? 'step="1" inputmode="numeric"' : ''}
              ${isAuto ? 'readonly tabindex="-1"' : ''}
              ${isAuto ? 'style="background:var(--color-border-light);color:var(--color-text-secondary);"' : ''}
            />
            ${field.unit ? `<span class="field-row-unit">${this.escapeHtml(field.unit)}</span>` : '<span class="field-row-unit"></span>'}
          </div>
        </div>
      `;
    }).join('');
  }

  // ─────────────────────────────────────────────
  // 서브 컴포넌트 마운트
  // ─────────────────────────────────────────────

  private mountSubComponents(): void {
    if (!this.el) return;

    // SyncStatusBar
    const syncContainer = this.el.querySelector<HTMLElement>('#sync-status-container');
    if (syncContainer) {
      this.syncStatusBar = new SyncStatusBar();
      this.syncStatusBar.mount(syncContainer);
    }

    // TtsEchoDisplay
    this.ttsEchoDisplay = new TtsEchoDisplay();
    this.ttsEchoDisplay.onEditRequest = (fieldKey: string) => {
      this.focusField(fieldKey);
    };
    this.ttsEchoDisplay.mount(document.body);
  }

  // ─────────────────────────────────────────────
  // 이벤트 바인딩
  // ─────────────────────────────────────────────

  private bindEvents(): void {
    if (!this.el) return;

    // 세션 헤더 입력 변경
    const sessionDate = this.el.querySelector<HTMLInputElement>('#session-date');
    const sessionFarmer = this.el.querySelector<HTMLSelectElement>('#session-farmer');
    const sessionLabel = this.el.querySelector<HTMLSelectElement>('#session-label');
    const sessionTreatment = this.el.querySelector<HTMLSelectElement>('#session-treatment');
    const sessionTree = this.el.querySelector<HTMLSelectElement>('#session-tree');
    const sessionFruit = this.el.querySelector<HTMLInputElement>('#session-fruit');

    sessionDate?.addEventListener('change', () => {
      this.sessionFields.surveyDate = sessionDate.value;
      surveyStore.updateSessionFields({ surveyDate: sessionDate.value });
    });

    sessionFarmer?.addEventListener('change', () => {
      this.sessionFields.farmerName = sessionFarmer.value;
      surveyStore.updateSessionFields({ farmerName: sessionFarmer.value });
    });

    sessionLabel?.addEventListener('change', () => {
      this.sessionFields.label = sessionLabel.value;
      surveyStore.updateSessionFields({ label: sessionLabel.value });
    });

    sessionTreatment?.addEventListener('change', () => {
      this.sessionFields.treatment = sessionTreatment.value;
      surveyStore.updateSessionFields({ treatment: sessionTreatment.value });
    });

    sessionTree?.addEventListener('change', () => {
      this.sessionFields.treeNo = parseInt(sessionTree.value, 10);
      surveyStore.updateSessionFields({ treeNo: this.sessionFields.treeNo });
    });

    sessionFruit?.addEventListener('input', () => {
      const val = parseInt(sessionFruit.value, 10);
      if (!isNaN(val)) {
        surveyStore.updateField('fruitNo', val);
      }
    });

    // 필드 입력 (이벤트 위임)
    const fieldList = this.el.querySelector<HTMLElement>('#field-list');
    fieldList?.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      const fieldKey = input.dataset['fieldKey'];
      if (!fieldKey) return;

      this.fieldValues[fieldKey] = input.value;

      if (input.type === 'text') {
        surveyStore.updateField(fieldKey, input.value);
      } else if (input.value === '') {
        // 빈값 입력 시 store에서 해당 필드를 undefined로 설정하여 이전 값 잔존 방지
        surveyStore.updateField(fieldKey, undefined);
      } else {
        const numVal = parseFloat(input.value);
        if (!isNaN(numVal)) {
          surveyStore.updateField(fieldKey, numVal);
        } else {
          // NaN 결과도 undefined로 처리
          surveyStore.updateField(fieldKey, undefined);
        }
      }

      // 이상치 경고 배지 실시간 업데이트 (이슈 7)
      this.updateWarningBadge(fieldKey, input);
    });

    fieldList?.addEventListener('focus', (e) => {
      const input = e.target as HTMLInputElement;
      const fieldKey = input.dataset['fieldKey'];
      if (!fieldKey) return;
      surveyStore.setLastField(fieldKey);
    }, true);

    // 세션 불러오기 버튼
    const loadSessionBtn = this.el.querySelector('#load-session-btn');
    loadSessionBtn?.addEventListener('click', () => this.handleLoadSession());

    // 저장 버튼
    const saveBtn = this.el.querySelector('#save-btn');
    saveBtn?.addEventListener('click', () => this.handleSave());

    // 음성 버튼
    const voiceBtn = this.el.querySelector<HTMLButtonElement>('#voice-btn');
    if (voiceBtn) {
      this.voiceBtnEl = voiceBtn;
      voiceBtn.addEventListener('click', () => this.toggleVoice());
    }
  }

  // ─────────────────────────────────────────────
  // Store 구독 핸들러
  // ─────────────────────────────────────────────

  private onSurveyStoreUpdate(state: Readonly<SurveyState>): void {
    // 자동계산 필드 업데이트
    const record = state.currentRecord as Record<string, unknown>;
    const autoFields = this.getActiveFields().filter((f) => f.inputType === 'auto');

    for (const field of autoFields) {
      const val = record[field.key];
      const input = this.el?.querySelector<HTMLInputElement>(`[data-field-key="${field.key}"]`);
      if (input && val != null) {
        input.value = String(val);
        this.fieldValues[field.key] = String(val);
      } else if (input && val == null) {
        input.value = '';
        this.fieldValues[field.key] = '';
      }
    }
  }

  private onVoiceStoreUpdate(state: Readonly<VoiceState>): void {
    // pendingField가 있으면 해당 행 하이라이트
    const { pendingField } = state;

    const allRows = this.el?.querySelectorAll<HTMLElement>('.field-row');
    allRows?.forEach((row) => {
      const key = row.dataset['field'];
      row.classList.toggle('highlighted', key === pendingField && pendingField !== null);
    });

    // 음성 인식으로 필드가 업데이트된 경우 input 값 갱신
    if (pendingField) {
      const record = surveyStore.getState().currentRecord as Record<string, unknown>;
      const val = record[pendingField];
      const input = this.el?.querySelector<HTMLInputElement>(`[data-field-key="${pendingField}"]`);
      if (input && val != null) {
        // F019: 저장값이 숫자이면 formatFieldValue로 표시 포맷 적용 (예: integer 13, decimal 200.0)
        const displayValue = typeof val === 'number'
          ? formatFieldValue(pendingField, val)
          : String(val);
        input.value = displayValue;
        this.fieldValues[pendingField] = displayValue;
      }
    }
  }

  // ─────────────────────────────────────────────
  // 저장 핸들러
  // ─────────────────────────────────────────────

  private async handleSave(): Promise<void> {
    if (this.isSaving) return;

    // 세션 필드 읽기
    const sessionFields = this.readSessionFields();

    // 조사과실 번호 읽기
    const fruitNoInput = this.el?.querySelector<HTMLInputElement>('#session-fruit');
    const fruitNo = parseInt(fruitNoInput?.value ?? '', 10);

    // 필수 필드 검증
    if (!sessionFields.farmerName) {
      showToast('농가명을 선택하세요.', 'error');
      return;
    }
    if (isNaN(fruitNo) || fruitNo < 1 || fruitNo > 5) {
      showToast('조사과실 번호를 1~5 범위로 입력하세요.', 'error');
      this.el?.querySelector<HTMLInputElement>('#session-fruit')?.focus();
      return;
    }

    // 레코드 ID 생성
    const recordId = makeRecordId({
      surveyDate: sessionFields.surveyDate,
      farmerName: sessionFields.farmerName,
      label: sessionFields.label,
      treatment: sessionFields.treatment,
      treeNo: sessionFields.treeNo,
      fruitNo,
    });
    const sessionKey = makeSessionKey(sessionFields);

    // 중복 확인
    const existing = await IndexedDBService.getRecordById(this.surveyType, recordId);
    if (existing) {
      const confirmed = await showConfirm(
        `조사나무 ${sessionFields.treeNo}번, 과실 ${fruitNo}번 데이터가 이미 존재합니다. 덮어쓰시겠습니까?`,
        '덮어쓰기',
        false,
      );
      if (!confirmed) return;
    }

    // 레코드 구성 + 이상치 검증
    const now = new Date().toISOString();
    const record = surveyStore.buildRecord(recordId, sessionKey, now);

    // fruitNo 반영
    (record as GrowthRecord).fruitNo = fruitNo;

    const validation = validateRecord(record);

    if (validation.hasWarning) {
      const confirmed = await showConfirm(
        `이상치가 포함되어 있습니다:\n${validation.warnings.join('\n')}\n\n그래도 저장하시겠습니까?`,
        '저장',
        false,
      );
      if (!confirmed) return;
    }

    // 저장
    this.isSaving = true;
    const saveBtn = this.el?.querySelector<HTMLButtonElement>('#save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;margin-right:6px;"></span>저장 중...';
    }

    try {
      await IndexedDBService.saveRecord(this.surveyType, record);

      // 신규 저장 시에만 pending 카운터 증가 (덮어쓰기 시 중복 카운트 방지, 이슈 5)
      if (!existing) {
        syncStore.incrementPending();
      }

      // store는 fruitNo만 초기화 (SurveyStore.resetAfterSave 확인 완료)
      surveyStore.resetAfterSave();

      // AC: 저장 후 과실번호만 초기화, 나머지 필드는 유지 (이슈 1)
      this.clearFruitNumberField();

      showToast('저장 완료', 'success');
      if (this.isVoiceActive && this.ttsEnabled) {
        this.ttsService?.speak('저장 완료');
      }

      // 다음 입력 준비: 과실번호 입력 포커스
      fruitNoInput?.focus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '저장에 실패했습니다.';
      showToast(msg, 'error');
    } finally {
      this.isSaving = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '저장';
      }
    }
  }

  /**
   * 저장 후 과실번호 input만 초기화합니다.
   * AC: 나머지 측정값 필드(횡경, 종경 등)는 유지하여 연속 입력 편의성 제공.
   */
  private clearFruitNumberField(): void {
    // DOM 초기화
    const fruitInput = this.el?.querySelector<HTMLInputElement>('#session-fruit');
    if (fruitInput) fruitInput.value = '';
    // fieldValues에서 fruitNo 제거 (측정값 필드는 유지)
    delete this.fieldValues['fruitNo'];
  }

  /**
   * 이상치 경고 배지를 실시간으로 업데이트합니다. (이슈 7)
   * number input 이벤트 발생 시 호출됩니다.
   */
  private updateWarningBadge(fieldKey: string, input: HTMLInputElement): void {
    const numVal = parseFloat(input.value);
    let hasWarning = false;
    if (!isNaN(numVal)) {
      const result = validateField(fieldKey, numVal);
      hasWarning = result.warning;
    }

    // 해당 field-row의 라벨 내 경고 dot 갱신
    const row = input.closest<HTMLElement>('.field-row');
    if (!row) return;

    const labelEl = row.querySelector<HTMLElement>('.field-row-label');
    if (!labelEl) return;

    const existingDot = labelEl.querySelector('.field-warning-dot');
    if (hasWarning && !existingDot) {
      const dot = document.createElement('span');
      dot.className = 'field-warning-dot';
      dot.title = '이상치 범위';
      labelEl.appendChild(dot);
    } else if (!hasWarning && existingDot) {
      existingDot.remove();
    }

    // input 클래스도 갱신
    input.classList.toggle('has-warning', hasWarning);
  }

  // ─────────────────────────────────────────────
  // 세션 불러오기 (최근 세션 바텀 시트)
  // ─────────────────────────────────────────────

  private async handleLoadSession(): Promise<void> {
    try {
      const sessions = await IndexedDBService.getRecentSessions(5);
      if (sessions.length === 0) {
        showToast('저장된 세션이 없습니다.', 'info');
        return;
      }

      this.showSessionPicker(sessions);
    } catch {
      showToast('세션 목록을 불러오지 못했습니다.', 'error');
    }
  }

  private showSessionPicker(sessions: Array<{ sessionKey: string; surveyDate: string; farmerName: string; label: string; treatment: string; lastUpdatedAt: string }>): void {
    // 기존 overlay와 sheet 모두 제거 (이슈 4: sheet 노드 누수 방지)
    document.getElementById('session-picker-overlay')?.remove();
    document.getElementById('session-picker-sheet')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'session-picker-overlay';
    overlay.className = 'bottom-sheet-overlay';

    const sheet = document.createElement('div');
    sheet.id = 'session-picker-sheet';
    sheet.className = 'bottom-sheet';
    sheet.innerHTML = `
      <div class="bottom-sheet-handle"></div>
      <div class="bottom-sheet-header">
        <div class="bottom-sheet-title">최근 세션 불러오기</div>
      </div>
      <div class="bottom-sheet-list">
        ${sessions.map((s) => `
          <div class="bottom-sheet-item" data-session-key="${this.escapeAttr(s.sessionKey)}"
               data-survey-date="${this.escapeAttr(s.surveyDate)}"
               data-farmer-name="${this.escapeAttr(s.farmerName)}"
               data-label="${this.escapeAttr(s.label)}"
               data-treatment="${this.escapeAttr(s.treatment)}">
            <div class="bottom-sheet-item-main">
              <div class="bottom-sheet-item-title">${this.escapeHtml(s.farmerName)} · ${this.escapeHtml(s.label)} · ${this.escapeHtml(s.treatment)}</div>
              <div class="bottom-sheet-item-meta">${formatDisplayDate(s.surveyDate)}</div>
            </div>
            <span style="color:var(--color-text-secondary);font-size:20px;">›</span>
          </div>
        `).join('')}
      </div>
    `;

    // overlay 클릭 시 overlay + sheet 모두 제거 (이슈 4)
    overlay.addEventListener('click', () => {
      overlay.remove();
      sheet.remove();
    });
    sheet.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = (e.target as HTMLElement).closest<HTMLElement>('.bottom-sheet-item');
      if (!item) return;

      const sessionFields: Partial<SessionFields> = {
        surveyDate: item.dataset['surveyDate'] ?? '',
        farmerName: item.dataset['farmerName'] ?? '',
        label: item.dataset['label'] ?? '',
        treatment: item.dataset['treatment'] ?? '',
      };

      this.applySession(sessionFields);
      // 선택 후 overlay + sheet 모두 제거 (이슈 4)
      overlay.remove();
      sheet.remove();
    });

    document.body.appendChild(overlay);
    document.body.appendChild(sheet);
  }

  private applySession(fields: Partial<SessionFields>): void {
    if (fields.surveyDate) this.sessionFields.surveyDate = fields.surveyDate;
    if (fields.farmerName) this.sessionFields.farmerName = fields.farmerName;
    if (fields.label) this.sessionFields.label = fields.label;
    if (fields.treatment) this.sessionFields.treatment = fields.treatment;

    surveyStore.updateSessionFields(this.sessionFields);

    // 세션 헤더 DOM 갱신
    const sessionHeader = this.el?.querySelector<HTMLElement>('#session-header');
    if (sessionHeader) {
      sessionHeader.innerHTML = this.renderSessionHeaderHTML();
      this.rebindSessionHeaderEvents();
    }

    showToast('세션이 불러와졌습니다.', 'success');
  }

  private readSessionFields(): SessionFields {
    const date = this.el?.querySelector<HTMLInputElement>('#session-date')?.value ?? todayString();
    const farmer = this.el?.querySelector<HTMLSelectElement>('#session-farmer')?.value ?? '';
    const label = this.el?.querySelector<HTMLSelectElement>('#session-label')?.value ?? '';
    const treatment = this.el?.querySelector<HTMLSelectElement>('#session-treatment')?.value ?? '';
    const treeNo = parseInt(this.el?.querySelector<HTMLSelectElement>('#session-tree')?.value ?? '1', 10);

    return {
      surveyDate: date,
      baseDate: '',
      farmerName: farmer,
      label,
      treatment,
      treeNo: isNaN(treeNo) ? 1 : treeNo,
    };
  }

  private rebindSessionHeaderEvents(): void {
    const sessionDate = this.el?.querySelector<HTMLInputElement>('#session-date');
    const sessionFarmer = this.el?.querySelector<HTMLSelectElement>('#session-farmer');
    const sessionLabel = this.el?.querySelector<HTMLSelectElement>('#session-label');
    const sessionTreatment = this.el?.querySelector<HTMLSelectElement>('#session-treatment');
    const sessionTree = this.el?.querySelector<HTMLSelectElement>('#session-tree');
    const sessionFruit = this.el?.querySelector<HTMLInputElement>('#session-fruit');

    sessionDate?.addEventListener('change', () => {
      this.sessionFields.surveyDate = sessionDate.value;
      surveyStore.updateSessionFields({ surveyDate: sessionDate.value });
    });
    sessionFarmer?.addEventListener('change', () => {
      this.sessionFields.farmerName = sessionFarmer.value;
      surveyStore.updateSessionFields({ farmerName: sessionFarmer.value });
    });
    sessionLabel?.addEventListener('change', () => {
      this.sessionFields.label = sessionLabel.value;
      surveyStore.updateSessionFields({ label: sessionLabel.value });
    });
    sessionTreatment?.addEventListener('change', () => {
      this.sessionFields.treatment = sessionTreatment.value;
      surveyStore.updateSessionFields({ treatment: sessionTreatment.value });
    });
    sessionTree?.addEventListener('change', () => {
      this.sessionFields.treeNo = parseInt(sessionTree.value, 10);
      surveyStore.updateSessionFields({ treeNo: this.sessionFields.treeNo });
    });
    sessionFruit?.addEventListener('input', () => {
      const val = parseInt(sessionFruit.value, 10);
      if (!isNaN(val)) {
        surveyStore.updateField('fruitNo', val);
      }
    });
  }

  // ─────────────────────────────────────────────
  // 음성 서비스
  // ─────────────────────────────────────────────

  /**
   * 음성 서비스를 초기화합니다.
   * 설정에서 ttsEnabled / voiceLogEnabled / audioRecordEnabled를 읽고
   * SttService, TtsService, (옵션) MediaRecorderService를 생성합니다.
   */
  private async initVoiceServices(): Promise<void> {
    try {
      this.ttsEnabled = await SettingsService.get('ttsEnabled', true);
      this.voiceLogEnabled = await SettingsService.get('voiceLogEnabled', true);
      this.audioRecordEnabled = await SettingsService.get('audioRecordEnabled', false);
    } catch {
      // 설정 읽기 실패 시 기본값 유지
    }

    // STT 서비스 생성 및 콜백 등록
    this.sttService = new SttService();

    this.sttService.onResult = (event: SttResultEvent) => {
      this.handleSttResult(event);
    };

    this.sttService.onInterim = (text: string) => {
      voiceStore.setInterimText(text);

      // iOS fallback: onspeechstart가 발화하지 않은 경우 첫 interim에서 녹음 시작
      if (this.audioRecordEnabled && this.mediaRecorderService && !this.mediaRecorderService.isRecording) {
        const stream = this.sttService?.stream;
        if (stream) {
          this.mediaRecorderService.startRecording(stream);
        }
      }
    };

    this.sttService.onStateChange = (state) => {
      voiceStore.setSttStatus(state);
    };

    this.sttService.onError = (msg: string) => {
      if (msg === 'ios-standalone') {
        // iOS 홈화면 PWA에서 STT 불가 — 버튼 비활성화 및 경고 표시
        this.showIOSStandaloneWarning();
        return;
      }
      voiceStore.setError(msg);
      // STT 오류 시 버튼 UI도 비활성 상태로 복원
      this.isVoiceActive = false;
      this.updateVoiceBtnUI(false);
    };

    // TTS 서비스 생성 및 콜백 등록
    this.ttsService = new TtsService();

    this.ttsService.onStart = () => {
      voiceStore.setTtsSpeaking(true);
    };

    this.ttsService.onEnd = () => {
      voiceStore.setTtsSpeaking(false);
    };

    // 오디오 녹음 서비스 (선택적)
    if (this.audioRecordEnabled && MediaRecorderService.isSupported()) {
      this.mediaRecorderService = new MediaRecorderService();

      this.sttService.onSpeechStart = () => {
        const stream = this.sttService?.stream;
        if (stream && this.mediaRecorderService && !this.mediaRecorderService.isRecording) {
          this.mediaRecorderService.startRecording(stream);
        }
      };
    }

    // iOS 홈화면 PWA(standalone 모드) 선제 체크 — STT 불가 경고 표시
    if (this.sttService.isIOSStandaloneMode) {
      this.showIOSStandaloneWarning();
      return;
    }

    // STT 미지원 브라우저에서 음성 버튼 비활성화
    const w = window as unknown as Record<string, unknown>;
    const hasStt = ('SpeechRecognition' in w) || ('webkitSpeechRecognition' in w);
    if (!hasStt && this.voiceBtnEl) {
      this.voiceBtnEl.disabled = true;
      this.voiceBtnEl.classList.add('unsupported');
      const subEl = this.voiceBtnEl.querySelector<HTMLElement>('.voice-btn-sub');
      if (subEl) subEl.textContent = '이 브라우저는 음성 인식을 지원하지 않습니다';
    }
  }

  /**
   * iOS 홈화면 PWA(standalone 모드)에서 STT 불가 경고를 표시합니다.
   * 음성 버튼을 비활성화하고 경고 메시지를 버튼 하단에 표시합니다.
   *
   * 원인: WebKit 버그 225298 — iOS standalone 모드에서 SpeechRecognition 미동작
   */
  private showIOSStandaloneWarning(): void {
    this.isVoiceActive = false;
    if (this.voiceBtnEl) {
      this.voiceBtnEl.disabled = true;
      this.voiceBtnEl.classList.remove('active');
      this.voiceBtnEl.classList.add('unsupported');
      const iconEl = this.voiceBtnEl.querySelector<HTMLElement>('.voice-btn-icon');
      const labelEl = this.voiceBtnEl.querySelector<HTMLElement>('.voice-btn-label');
      const subEl = this.voiceBtnEl.querySelector<HTMLElement>('.voice-btn-sub');
      if (iconEl) iconEl.textContent = '🚫';
      if (labelEl) labelEl.textContent = '음성 입력 사용 불가';
      if (subEl) subEl.textContent = 'iOS 홈화면 앱에서는 음성 입력이 지원되지 않습니다. Safari 브라우저에서 직접 열어 사용하세요.';
    }
  }

  /**
   * STT 최종 인식 결과를 처리합니다.
   *
   * A. field 있고 score >= 0.5: 필드 업데이트 → TTS "{필드명} {값}"
   * B. isCorrection: true (값만 발화): lastField 사용 → TTS "수정 {필드명} {값}"
   * C. 인식 실패: TTS "다시 말씀해 주세요"
   */
  private handleSttResult(event: SttResultEvent): void {
    // F023: _handleResult 진입 시각 (SttService에서 전달된 t0) 및 asrMs
    const t0 = event.t0;
    const asrMs = event.asrMs;

    // activeFields 목록 (auto 타입 제외)
    const activeFieldKeys =
      this.surveyType === 'growth'
        ? ['width', 'height', 'remark']
        : [
            'width', 'height', 'fruitWeight', 'pericarpWeight',
            'pericarpThickness', 'brix', 'titratableAcidity',
            'acidContent', 'coloring', 'nonDestructive', 'remark',
          ];

    // 필드명 → TTS 텍스트 매핑
    const fieldLabelMap: Record<string, string> = {
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

    const storeState = surveyStore.getState();

    // F023: parse() 실행 시간 계측
    const parseStart = performance.now();
    const result = parse(event.transcript, {
      lastField: storeState.lastField,
      surveyType: this.surveyType,
      activeFields: activeFieldKeys,
    }, event.alternatives ?? []);
    const parseMs = performance.now() - parseStart;

    const now = new Date().toISOString();

    // A. field 있고 score >= 0.5 (F025: outOfRange 결과는 fail 경로로)
    if (result.field !== null && result.score >= 0.5 && !result.isCorrection && !result.outOfRange) {
      const fieldKey = result.field;
      // integer 타입 필드(remark 제외)는 storeValue를 반올림하여 저장값-표시값 일치
      const dataType = FIELD_DATA_TYPES[fieldKey];
      const storeValue = (dataType?.type === 'integer' && result.numericValue !== null)
        ? Math.round(result.numericValue)
        : (result.numericValue !== null ? result.numericValue : (result.value ?? ''));
      surveyStore.updateField(fieldKey, storeValue);

      // F019: 필드 데이터 타입에 맞게 표시값 포맷 (200 → "200.0" 등)
      const displayValue = result.numericValue !== null
        ? formatFieldValue(fieldKey, result.numericValue)
        : (result.value ?? '');

      // DOM input 갱신
      const inputEl = this.el?.querySelector<HTMLInputElement>(`[data-field-key="${fieldKey}"]`);
      if (inputEl) {
        inputEl.value = displayValue;
        this.fieldValues[fieldKey] = displayValue;
        this.updateWarningBadge(fieldKey, inputEl);
      }

      const fieldLabel = fieldLabelMap[fieldKey] ?? fieldKey;
      const ttsValueOnly = localStorage.getItem('tts.valueOnly') === 'true';
      const ttsText = ttsValueOnly ? displayValue : `${fieldLabel} ${displayValue}`;
      voiceStore.setEchoText(ttsText);

      // F023: ttsCallMs — speak() 호출 직전 시각 기준
      // ttsStartMs — utterance.onstart 콜백 기반. 2000ms fallback 후 0 유지.
      const ttsCallMsA = this.ttsEnabled ? performance.now() - t0 : 0;
      let ttsStartMsA = 0;
      const ttsStartPromiseA = new Promise<void>((resolve) => {
        if (this.ttsEnabled && this.ttsService) {
          this.ttsService.speak(ttsText, undefined, {
            onStarted: (ts: number) => {
              ttsStartMsA = ts - t0;
              resolve();
            },
          });
        } else {
          resolve();
        }
      });
      const ttsStartWithTimeoutA = Promise.race([
        ttsStartPromiseA,
        new Promise<void>((resolve) => setTimeout(resolve, 2000)),
      ]);

      voiceStore.setRecognitionResult(result);
      setTimeout(() => voiceStore.clearPending(), 2000);

      // 음성 로그 저장 (실패해도 계속)
      if (this.voiceLogEnabled) {
        const mrs = this.mediaRecorderService;
        const isRecording = mrs?.isRecording ?? false;
        const audioPromise: Promise<import('../types.js').AudioBlob | null> =
          this.audioRecordEnabled && isRecording && mrs
            ? mrs.stopRecording().catch((e) => { console.warn('[MediaRecorder] stopRecording 실패:', e); return null; })
            : Promise.resolve(null);

        (async () => {
          try {
            await ttsStartWithTimeoutA;

            // F023: saveLogMs — saveLog() 호출 직전 시각 기준
            const saveLogMsA = performance.now() - t0;

            const logId = await VoiceLogService.saveLog({
              ts: now,
              kind: 'ok',
              rawText: event.transcript,
              alternatives: event.alternatives,
              parse: {
                field: result.field,
                value: result.value,
                score: result.score,
                method: result.method,
              },
              status: 'accepted',
              message: ttsText,
              audioFileId: null,
              timing: {
                asrMs,
                parseMs,
                ttsCallMs: ttsCallMsA,
                ttsStartMs: ttsStartMsA,
                saveLogMs: saveLogMsA,
              },
              // F025: 수락에 사용된 alternative 인덱스 (0 = primary rawText)
              selectedAltIndex: result.selectedAltIndex ?? 0,
              session: storeState.sessionFields
                ? `${storeState.sessionFields.surveyDate}_${storeState.sessionFields.farmerName}`
                : undefined,
              device: collectDeviceInfo(),
            });

            const audioBlob = await audioPromise;
            if (audioBlob) {
              const audioId = await VoiceLogService.saveAudio({
                logId,
                blob: audioBlob.blob,
                mimeType: audioBlob.mimeType,
                durationMs: audioBlob.durationMs,
                ts: now,
              });
              await VoiceLogService.updateLogAudioId(logId, audioId);
            }
          } catch {
            // 로그/오디오 저장 실패 무시
          }
        })();
      }
      return;
    }

    // B. isCorrection: true (값만 발화 — lastField 사용)
    if (result.isCorrection && result.field !== null) {
      const fieldKey = result.field;
      // integer 타입 필드(remark 제외)는 storeValue를 반올림하여 저장값-표시값 일치
      const dataTypeB = FIELD_DATA_TYPES[fieldKey];
      const storeValue = (dataTypeB?.type === 'integer' && result.numericValue !== null)
        ? Math.round(result.numericValue)
        : (result.numericValue !== null ? result.numericValue : (result.value ?? ''));
      surveyStore.updateField(fieldKey, storeValue);

      // F019: 필드 데이터 타입에 맞게 표시값 포맷 (200 → "200.0" 등)
      const displayValue = result.numericValue !== null
        ? formatFieldValue(fieldKey, result.numericValue)
        : (result.value ?? '');

      // DOM input 갱신
      const inputEl = this.el?.querySelector<HTMLInputElement>(`[data-field-key="${fieldKey}"]`);
      if (inputEl) {
        inputEl.value = displayValue;
        this.fieldValues[fieldKey] = displayValue;
        this.updateWarningBadge(fieldKey, inputEl);
      }

      const fieldLabel = fieldLabelMap[fieldKey] ?? fieldKey;
      const ttsText = `수정 ${fieldLabel} ${displayValue}`;
      voiceStore.setEchoText(ttsText);

      // F023: ttsCallMs — speak() 호출 직전 시각 기준
      const ttsCallMsB = this.ttsEnabled ? performance.now() - t0 : 0;
      let ttsStartMsB = 0;
      const ttsStartPromiseB = new Promise<void>((resolve) => {
        if (this.ttsEnabled && this.ttsService) {
          this.ttsService.speak(ttsText, undefined, {
            onStarted: (ts: number) => {
              ttsStartMsB = ts - t0;
              resolve();
            },
          });
        } else {
          resolve();
        }
      });
      const ttsStartWithTimeoutB = Promise.race([
        ttsStartPromiseB,
        new Promise<void>((resolve) => setTimeout(resolve, 2000)),
      ]);

      voiceStore.setRecognitionResult(result);
      setTimeout(() => voiceStore.clearPending(), 2000);

      if (this.voiceLogEnabled) {
        const mrs = this.mediaRecorderService;
        const isRecording = mrs?.isRecording ?? false;
        const audioPromise: Promise<import('../types.js').AudioBlob | null> =
          this.audioRecordEnabled && isRecording && mrs
            ? mrs.stopRecording().catch((e) => { console.warn('[MediaRecorder] stopRecording 실패:', e); return null; })
            : Promise.resolve(null);

        (async () => {
          try {
            await ttsStartWithTimeoutB;
            const saveLogMsB = performance.now() - t0;

            const logId = await VoiceLogService.saveLog({
              ts: now,
              kind: 'ok',
              rawText: event.transcript,
              alternatives: event.alternatives,
              parse: {
                field: result.field,
                value: result.value,
                score: result.score,
                method: result.method,
              },
              status: 'corrected',
              message: ttsText,
              audioFileId: null,
              timing: {
                asrMs,
                parseMs,
                ttsCallMs: ttsCallMsB,
                ttsStartMs: ttsStartMsB,
                saveLogMs: saveLogMsB,
              },
              session: storeState.sessionFields
                ? `${storeState.sessionFields.surveyDate}_${storeState.sessionFields.farmerName}`
                : undefined,
              device: collectDeviceInfo(),
            });

            const audioBlob = await audioPromise;
            if (audioBlob) {
              const audioId = await VoiceLogService.saveAudio({
                logId,
                blob: audioBlob.blob,
                mimeType: audioBlob.mimeType,
                durationMs: audioBlob.durationMs,
                ts: now,
              });
              await VoiceLogService.updateLogAudioId(logId, audioId);
            }
          } catch {
            // 로그/오디오 저장 실패 무시
          }
        })();
      }
      return;
    }

    // C. 인식 실패 (F025: outOfRange 포함)
    const failTts = result.outOfRange
      ? '다시 말씀해 주세요 범위를 벗어났습니다'
      : '다시 말씀해 주세요';
    voiceStore.setEchoText(failTts);

    // F023: fail 브랜치에서 TTS 없음 → ttsCallMs/ttsStartMs = 0
    const ttsCallMsC = this.ttsEnabled ? performance.now() - t0 : 0;
    let ttsStartMsC = 0;
    const ttsStartPromiseC = new Promise<void>((resolve) => {
      if (this.ttsEnabled && this.ttsService) {
        this.ttsService.speak(failTts, undefined, {
          onStarted: (ts: number) => {
            ttsStartMsC = ts - t0;
            resolve();
          },
        });
      } else {
        resolve();
      }
    });
    const ttsStartWithTimeoutC = Promise.race([
      ttsStartPromiseC,
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]);

    voiceStore.setError('인식 실패');

    if (this.voiceLogEnabled) {
      const mrs = this.mediaRecorderService;
      const isRecording = mrs?.isRecording ?? false;
      const audioPromise: Promise<import('../types.js').AudioBlob | null> =
        this.audioRecordEnabled && isRecording && mrs
          ? mrs.stopRecording().catch(() => null)
          : Promise.resolve(null);

      (async () => {
        try {
          await ttsStartWithTimeoutC;
          const saveLogMsC = performance.now() - t0;

          const logId = await VoiceLogService.saveLog({
            ts: now,
            kind: 'fail',
            rawText: event.transcript,
            alternatives: event.alternatives,
            parse: {
              field: result.field,
              value: result.value,
              score: result.score,
              method: result.method,
            },
            status: 'rejected',
            message: failTts,
            audioFileId: null,
            timing: {
              asrMs,
              parseMs,
              ttsCallMs: ttsCallMsC,
              ttsStartMs: ttsStartMsC,
              saveLogMs: saveLogMsC,
            },
            // F025: outOfRange rejected는 -1, 일반 실패는 undefined
            selectedAltIndex: result.outOfRange ? -1 : undefined,
            session: storeState.sessionFields
              ? `${storeState.sessionFields.surveyDate}_${storeState.sessionFields.farmerName}`
              : undefined,
            device: collectDeviceInfo(),
          });

          const audioBlob = await audioPromise;
          if (audioBlob) {
            const audioId = await VoiceLogService.saveAudio({
              logId,
              blob: audioBlob.blob,
              mimeType: audioBlob.mimeType,
              durationMs: audioBlob.durationMs,
              ts: now,
            });
            await VoiceLogService.updateLogAudioId(logId, audioId);
          }
        } catch {
          // 로그/오디오 저장 실패 무시
        }
      })();
    }
  }

  /**
   * 음성 버튼 토글: 음성 입력 시작/중지를 전환합니다.
   */
  private toggleVoice(): void {
    if (!this.sttService) return;
    if (this.isVoiceActive) {
      if (this.mediaRecorderService?.isRecording) {
        this.mediaRecorderService.stopRecording().catch(() => {/* 유실 무시 */});
      }
      this.sttService.stop();
      this.isVoiceActive = false;
      this.updateVoiceBtnUI(false);
      if (this.ttsEnabled) this.ttsService?.speak('음성 입력 종료');
    } else {
      this.ttsService?.unlock();
      this.sttService.start();
      this.isVoiceActive = true;
      this.updateVoiceBtnUI(true);
      if (this.ttsEnabled) this.ttsService?.speak('음성 입력 시작');
    }
  }

  /**
   * 음성 버튼 UI를 활성/비활성 상태에 맞게 업데이트합니다.
   *
   * @param active 활성 상태이면 true
   */
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

  // ─────────────────────────────────────────────
  // 유틸리티
  // ─────────────────────────────────────────────

  private getActiveFields(): FieldDef[] {
    return this.surveyType === 'growth' ? GROWTH_FIELDS : QUALITY_FIELDS;
  }

  private focusField(fieldKey: string): void {
    const input = this.el?.querySelector<HTMLInputElement>(`[data-field-key="${fieldKey}"]`);
    if (input) {
      input.focus();
      input.select();
      // 해당 행으로 스크롤
      input.closest('.field-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  private escapeAttr(text: string): string {
    return String(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
