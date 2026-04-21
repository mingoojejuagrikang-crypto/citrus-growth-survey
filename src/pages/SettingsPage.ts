/**
 * pages/SettingsPage.ts — 설정 탭 화면 (F001)
 *
 * 목적: 농가명 목록 추가/삭제, 라벨/처리/조사나무 범위 기본값 설정,
 *       비대/품질조사 항목 세트 안내, TTS/Gemma 등 기능 토글을 관리합니다.
 *
 * Acceptance Criteria (F001):
 * - 농가명 목록 추가/삭제 가능
 * - 라벨(A/B/C), 처리(관행/시험), 조사나무 범위 기본값 저장 가능
 * - 비대/품질조사 기본 세트 표시 (읽기 전용 안내)
 * - 설정값은 앱 재시작 후에도 유지 (IndexedDB 저장)
 * - 스마트폰 세로 한 손 조작 가능 레이아웃
 */

import * as SettingsService from '../services/SettingsService.js';
import { TtsService } from '../services/TtsService.js';
import type { AppDefaults } from '../types.js';
import { showConfirm } from '../components/ConfirmDialog.js';
import { showToast } from '../utils/toast.js';

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

/** TTS 값만 읽기 토글 localStorage 키 */
const TTS_VALUE_ONLY_KEY = 'tts.valueOnly';

// ─────────────────────────────────────────────
// 기본 항목 세트 정의 (읽기 전용 안내용)
// ─────────────────────────────────────────────

const GROWTH_PRESET_FIELDS = ['횡경 (mm)', '종경 (mm)', '비고'];
const QUALITY_PRESET_FIELDS = [
  '횡경 (mm)', '종경 (mm)',
  '과중 (g)', '과피중 (g)',
  '과피두께 (mm)', '과피두께×4 (자동계산)',
  '당도 °Bx', '적정산도', '산함량 (%)',
  '당산도 (자동계산)', '착색', '비파괴', '비고',
];

// ─────────────────────────────────────────────
// SettingsPage 클래스
// ─────────────────────────────────────────────

export class SettingsPage {
  private el: HTMLElement | null = null;
  private defaults: AppDefaults = SettingsService.getDefaultAppDefaults();
  private ttsEnabled = true;
  private gemmaEnabled = false;
  private audioRecordEnabled = false;
  private voiceLogEnabled = true;
  private isSaving = false;
  private newFarmerInput: HTMLInputElement | null = null;
  private newLabelInput: HTMLInputElement | null = null;
  private newTreatmentInput: HTMLInputElement | null = null;

  /** TTS 설정 미리듣기/속도 조정용 서비스 인스턴스 */
  private readonly ttsService: TtsService = new TtsService();

  /** 현재 TTS 재생 속도 (슬라이더 상태) */
  private ttsRate: number = this.ttsService.getRate();

  /** TTS 값만 읽기 (필드 레이블 생략) 여부 */
  private ttsValueOnly: boolean = false;

  async mount(container: HTMLElement): Promise<void> {
    this.el = document.createElement('div');
    this.el.className = 'page';
    container.appendChild(this.el);

    // 로딩 상태 표시
    this.renderLoading();

    // 설정값 로드
    await this.loadSettings();

    // 렌더링
    this.render();
  }

  unmount(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    this.newFarmerInput = null;
    this.newLabelInput = null;
    this.newTreatmentInput = null;
  }

  private renderLoading(): void {
    if (!this.el) return;
    this.el.innerHTML = `
      <div class="page-header">
        <h1>설정</h1>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;padding:48px;gap:12px;color:var(--color-text-secondary);">
        <div class="spinner"></div>
        <span>설정 불러오는 중...</span>
      </div>
    `;
  }

  private async loadSettings(): Promise<void> {
    try {
      [
        this.defaults,
        this.ttsEnabled,
        this.gemmaEnabled,
        this.audioRecordEnabled,
        this.voiceLogEnabled,
      ] = await Promise.all([
        SettingsService.getDefaults(),
        SettingsService.get<boolean>('ttsEnabled', true),
        SettingsService.get<boolean>('gemmaEnabled', false),
        SettingsService.get<boolean>('audioRecordEnabled', false),
        SettingsService.get<boolean>('voiceLogEnabled', true),
      ]);

      // tts.valueOnly는 localStorage에 저장 (SettingsService 독립)
      this.ttsValueOnly = localStorage.getItem('tts.valueOnly') === 'true';
      // ttsRate는 TtsService 생성 시 이미 로드됨 — 여기서 sync
      this.ttsRate = this.ttsService.getRate();
    } catch {
      showToast('설정을 불러오지 못했습니다.', 'error');
    }
  }

  private render(): void {
    if (!this.el) return;

    this.el.innerHTML = `
      <div class="page-header">
        <h1>설정</h1>
      </div>

      <div style="padding: var(--padding-mobile); padding-bottom: calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 80px);">

        <!-- 농가명 목록 -->
        <section class="settings-section" id="farmer-section">
          <h2 class="settings-section-title">농가명 목록</h2>
          <div class="farmer-name-list" id="farmer-list"></div>
          <div class="add-input-row">
            <input
              type="text"
              id="new-farmer-input"
              placeholder="새 농가명 입력"
              maxlength="20"
              autocomplete="off"
            />
            <button class="btn btn-primary" id="add-farmer-btn" type="button" style="flex-shrink:0;padding:0 16px;">
              추가
            </button>
          </div>
        </section>

        <!-- 기본값 설정 -->
        <section class="settings-section" id="defaults-section">
          <h2 class="settings-section-title">기본값 설정</h2>

          <!-- 라벨 -->
          <div class="form-group">
            <label class="form-label">라벨 목록</label>
            <div class="label-chips" id="label-chips"></div>
            <div class="add-input-row" style="margin-top:8px;">
              <input
                type="text"
                id="new-label-input"
                placeholder="새 라벨 입력 (예: D)"
                maxlength="10"
                autocomplete="off"
              />
              <button class="btn btn-primary" id="add-label-btn" type="button" style="flex-shrink:0;padding:0 16px;">
                추가
              </button>
            </div>
          </div>

          <!-- 처리 -->
          <div class="form-group">
            <label class="form-label">처리 목록</label>
            <div class="label-chips" id="treatment-chips"></div>
            <div class="add-input-row" style="margin-top:8px;">
              <input
                type="text"
                id="new-treatment-input"
                placeholder="새 처리 입력 (예: 시험2)"
                maxlength="20"
                autocomplete="off"
              />
              <button class="btn btn-primary" id="add-treatment-btn" type="button" style="flex-shrink:0;padding:0 16px;">
                추가
              </button>
            </div>
          </div>

          <!-- 조사나무 범위 -->
          <div class="form-group">
            <label class="form-label">조사나무 범위</label>
            <div class="tree-range-row">
              <input
                type="number"
                id="tree-min-input"
                class="tree-range-input"
                value="${this.defaults.treeRange.min}"
                min="1" max="100"
                placeholder="시작"
                inputmode="numeric"
              />
              <span class="tree-range-separator">~</span>
              <input
                type="number"
                id="tree-max-input"
                class="tree-range-input"
                value="${this.defaults.treeRange.max}"
                min="1" max="100"
                placeholder="끝"
                inputmode="numeric"
              />
              <span class="tree-range-separator">번</span>
            </div>
          </div>
        </section>

        <!-- 기본 항목 세트 안내 (읽기 전용) -->
        <section class="settings-section">
          <h2 class="settings-section-title">조사 항목 세트</h2>
          <p style="font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-bottom:12px;">
            기본 항목 세트는 아래와 같이 고정되어 있습니다.
          </p>

          <div class="preset-info-box" style="margin-bottom:12px;">
            <div class="preset-info-title">📏 비대조사 기본 세트</div>
            <div class="preset-info-fields">${GROWTH_PRESET_FIELDS.join(' · ')}</div>
          </div>

          <div class="preset-info-box">
            <div class="preset-info-title">🍊 품질조사 기본 세트</div>
            <div class="preset-info-fields">${QUALITY_PRESET_FIELDS.join(' · ')}</div>
          </div>
        </section>

        <!-- TTS 속도 설정 -->
        <section class="settings-section">
          <h2 class="settings-section-title">TTS 속도</h2>

          <div class="form-group" style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <label class="form-label" for="tts-rate-slider" style="margin-bottom:0;">재생 속도</label>
              <span id="tts-rate-label" style="font-weight:600;color:var(--color-primary);min-width:40px;text-align:right;">${this.ttsRate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              id="tts-rate-slider"
              min="0.8"
              max="2.0"
              step="0.1"
              value="${this.ttsRate}"
              style="width:100%;accent-color:var(--color-primary);"
            />
            <div style="display:flex;justify-content:space-between;font-size:var(--font-size-xs);color:var(--color-text-secondary);margin-top:4px;">
              <span>0.8x (느림)</span>
              <span>2.0x (빠름)</span>
            </div>
          </div>

          <button class="btn btn-secondary" id="tts-test-btn" type="button" style="height:44px;font-size:16px;margin-bottom:4px;">
            재생 테스트
          </button>

          <div class="toggle-row" style="margin-top:12px;">
            <div>
              <div class="toggle-label">TTS 메시지 축약 <span style="color:var(--color-warning,#e67e22);font-size:0.8em;">실험적</span></div>
              <div class="toggle-description">필드 레이블 생략 — "횡경 200.0" 대신 "200.0". 라벨 오인식 위험이 있어 현재 사용 비권장.</div>
            </div>
            <label class="toggle-switch" aria-label="TTS 메시지 축약">
              <input type="checkbox" id="tts-value-only-toggle" ${this.ttsValueOnly ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </section>

        <!-- 기능 토글 -->
        <section class="settings-section">
          <h2 class="settings-section-title">기능 설정</h2>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">TTS 음성 피드백</div>
              <div class="toggle-description">입력 결과를 음성으로 읽어줍니다</div>
            </div>
            <label class="toggle-switch" aria-label="TTS 음성 피드백">
              <input type="checkbox" id="tts-toggle" ${this.ttsEnabled ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-row" id="gemma-toggle-row">
            <div>
              <div class="toggle-label">AI 보조 (비고 입력)</div>
              <div class="toggle-description" id="gemma-desc"></div>
            </div>
            <label class="toggle-switch" aria-label="AI 보조 기능">
              <input type="checkbox" id="gemma-toggle" ${this.gemmaEnabled ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">오디오 녹음</div>
              <div class="toggle-description">발화 구간 오디오를 저장합니다</div>
            </div>
            <label class="toggle-switch" aria-label="오디오 녹음">
              <input type="checkbox" id="audio-toggle" ${this.audioRecordEnabled ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">STT 로그 수집</div>
              <div class="toggle-description">음성 인식 로그를 저장합니다</div>
            </div>
            <label class="toggle-switch" aria-label="STT 로그 수집">
              <input type="checkbox" id="log-toggle" ${this.voiceLogEnabled ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </section>

        <!-- 저장 버튼 -->
        <div class="save-area">
          <button class="btn btn-primary btn-full" id="save-btn" type="button" style="height:52px;font-size:18px;">
            설정 저장
          </button>
        </div>

        <!-- 앱 버전 (F020) -->
        <div style="text-align:center;padding:16px 0 8px;color:var(--color-text-secondary);font-size:var(--font-size-sm);">
          앱 버전: v${__APP_VERSION__}
        </div>

      </div>
    `;

    // 하위 요소 렌더링 및 이벤트 바인딩
    this.renderFarmerList();
    this.renderLabelChips();
    this.renderTreatmentChips();
    this.setupGemmaToggle();
    this.bindEvents();
  }

  // ─────────────────────────────────────────────
  // 렌더링 헬퍼
  // ─────────────────────────────────────────────

  private renderFarmerList(): void {
    const list = this.el?.querySelector('#farmer-list');
    if (!list) return;

    list.innerHTML = this.defaults.farmerNames.map((name) => `
      <div class="farmer-name-item" data-name="${this.escapeAttr(name)}">
        <span class="farmer-name-text">${this.escapeHtml(name)}</span>
        ${name === this.defaults.defaultFarmerName
          ? '<span class="farmer-name-default-badge">기본값</span>'
          : `<button class="btn btn-ghost" data-action="set-default-farmer" data-name="${this.escapeAttr(name)}" type="button" style="font-size:12px;height:32px;padding:0 8px;color:var(--color-primary);">기본</button>`
        }
        <button class="delete-btn" data-action="delete-farmer" data-name="${this.escapeAttr(name)}" type="button" aria-label="${this.escapeAttr(name)} 삭제">
          ✕
        </button>
      </div>
    `).join('');
  }

  private renderLabelChips(): void {
    const container = this.el?.querySelector('#label-chips');
    if (!container) return;

    container.innerHTML = this.defaults.labels.map((label) => `
      <div style="display:flex;align-items:center;gap:4px;">
        <span class="label-chip${label === this.defaults.defaultLabel ? ' selected' : ''}"
              data-action="set-default-label" data-value="${this.escapeAttr(label)}">
          ${this.escapeHtml(label)}
          ${label === this.defaults.defaultLabel ? ' ✓' : ''}
        </span>
        ${this.defaults.labels.length > 1
          ? `<button class="delete-btn" data-action="delete-label" data-value="${this.escapeAttr(label)}" type="button" aria-label="${this.escapeAttr(label)} 삭제" style="width:28px;height:28px;font-size:14px;">✕</button>`
          : ''
        }
      </div>
    `).join('');
  }

  private renderTreatmentChips(): void {
    const container = this.el?.querySelector('#treatment-chips');
    if (!container) return;

    container.innerHTML = this.defaults.treatments.map((treatment) => `
      <div style="display:flex;align-items:center;gap:4px;">
        <span class="label-chip${treatment === this.defaults.defaultTreatment ? ' selected' : ''}"
              data-action="set-default-treatment" data-value="${this.escapeAttr(treatment)}">
          ${this.escapeHtml(treatment)}
          ${treatment === this.defaults.defaultTreatment ? ' ✓' : ''}
        </span>
        ${this.defaults.treatments.length > 1
          ? `<button class="delete-btn" data-action="delete-treatment" data-value="${this.escapeAttr(treatment)}" type="button" aria-label="${this.escapeAttr(treatment)} 삭제" style="width:28px;height:28px;font-size:14px;">✕</button>`
          : ''
        }
      </div>
    `).join('');
  }

  private setupGemmaToggle(): void {
    // iOS 감지 후 Gemma 토글 비활성화
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const descEl = this.el?.querySelector<HTMLElement>('#gemma-desc');
    const toggleInput = this.el?.querySelector<HTMLInputElement>('#gemma-toggle');
    const toggleRow = this.el?.querySelector<HTMLElement>('#gemma-toggle-row');

    if (isIOS) {
      if (descEl) descEl.textContent = '이 기기에서 AI 보조 기능이 지원되지 않습니다';
      if (toggleInput) {
        toggleInput.disabled = true;
        toggleInput.checked = false;
      }
      if (toggleRow) toggleRow.style.opacity = '0.5';
    } else {
      if (descEl) descEl.textContent = 'Android Chrome에서 비고 입력 보조 제안 (Gemma AI)';
    }
  }

  // ─────────────────────────────────────────────
  // 이벤트 바인딩
  // ─────────────────────────────────────────────

  private bindEvents(): void {
    if (!this.el) return;

    // 농가명 추가
    this.newFarmerInput = this.el.querySelector('#new-farmer-input');
    const addFarmerBtn = this.el.querySelector('#add-farmer-btn');
    addFarmerBtn?.addEventListener('click', () => this.handleAddFarmer());
    this.newFarmerInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleAddFarmer();
    });

    // 라벨 추가
    this.newLabelInput = this.el.querySelector('#new-label-input');
    const addLabelBtn = this.el.querySelector('#add-label-btn');
    addLabelBtn?.addEventListener('click', () => this.handleAddLabel());
    this.newLabelInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleAddLabel();
    });

    // 처리 추가
    this.newTreatmentInput = this.el.querySelector('#new-treatment-input');
    const addTreatmentBtn = this.el.querySelector('#add-treatment-btn');
    addTreatmentBtn?.addEventListener('click', () => this.handleAddTreatment());
    this.newTreatmentInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleAddTreatment();
    });

    // 이벤트 위임 — 삭제/기본값 설정
    this.el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('[data-action]') as HTMLElement | null;
      if (!btn) return;

      const action = btn.dataset['action'];
      const name = btn.dataset['name'];
      const value = btn.dataset['value'];

      switch (action) {
        case 'delete-farmer':
          if (name) this.handleDeleteFarmer(name);
          break;
        case 'set-default-farmer':
          if (name) this.handleSetDefaultFarmer(name);
          break;
        case 'set-default-label':
          if (value) this.handleSetDefaultLabel(value);
          break;
        case 'delete-label':
          if (value) this.handleDeleteLabel(value);
          break;
        case 'set-default-treatment':
          if (value) this.handleSetDefaultTreatment(value);
          break;
        case 'delete-treatment':
          if (value) this.handleDeleteTreatment(value);
          break;
      }
    });

    // 토글 변경
    const ttsToggle = this.el.querySelector<HTMLInputElement>('#tts-toggle');
    ttsToggle?.addEventListener('change', async () => {
      this.ttsEnabled = ttsToggle.checked;
      await SettingsService.set('ttsEnabled', this.ttsEnabled);
    });

    const gemmaToggle = this.el.querySelector<HTMLInputElement>('#gemma-toggle');
    gemmaToggle?.addEventListener('change', async () => {
      this.gemmaEnabled = gemmaToggle.checked;
      await SettingsService.set('gemmaEnabled', this.gemmaEnabled);
    });

    const audioToggle = this.el.querySelector<HTMLInputElement>('#audio-toggle');
    audioToggle?.addEventListener('change', async () => {
      this.audioRecordEnabled = audioToggle.checked;
      await SettingsService.set('audioRecordEnabled', this.audioRecordEnabled);
    });

    const logToggle = this.el.querySelector<HTMLInputElement>('#log-toggle');
    logToggle?.addEventListener('change', async () => {
      this.voiceLogEnabled = logToggle.checked;
      await SettingsService.set('voiceLogEnabled', this.voiceLogEnabled);
    });

    // TTS 속도 슬라이더
    const ttsRateSlider = this.el.querySelector<HTMLInputElement>('#tts-rate-slider');
    const ttsRateLabel = this.el.querySelector<HTMLElement>('#tts-rate-label');
    ttsRateSlider?.addEventListener('input', () => {
      const rate = parseFloat(ttsRateSlider.value);
      if (!Number.isFinite(rate)) return;
      this.ttsRate = rate;
      this.ttsService.setRate(rate);
      if (ttsRateLabel) ttsRateLabel.textContent = `${rate.toFixed(1)}x`;
    });

    // TTS 재생 테스트 버튼
    const ttsTestBtn = this.el.querySelector<HTMLButtonElement>('#tts-test-btn');
    ttsTestBtn?.addEventListener('click', () => {
      this.ttsService.unlock();
      this.ttsService.speak('횡경 200.0');
    });

    // TTS 메시지 축약 토글
    const ttsValueOnlyToggle = this.el.querySelector<HTMLInputElement>('#tts-value-only-toggle');
    ttsValueOnlyToggle?.addEventListener('change', () => {
      this.ttsValueOnly = ttsValueOnlyToggle.checked;
      try {
        localStorage.setItem(TTS_VALUE_ONLY_KEY, String(this.ttsValueOnly));
      } catch {
        // localStorage 쓰기 실패 무시
      }
    });

    // 저장 버튼
    const saveBtn = this.el.querySelector('#save-btn');
    saveBtn?.addEventListener('click', () => this.handleSave());
  }

  // ─────────────────────────────────────────────
  // 핸들러
  // ─────────────────────────────────────────────

  private handleAddFarmer(): void {
    const input = this.newFarmerInput;
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;

    if (this.defaults.farmerNames.includes(name)) {
      showToast('이미 존재하는 농가명입니다.', 'warning');
      return;
    }

    this.defaults = {
      ...this.defaults,
      farmerNames: [...this.defaults.farmerNames, name],
    };
    input.value = '';
    this.renderFarmerList();
  }

  private async handleDeleteFarmer(name: string): Promise<void> {
    if (this.defaults.farmerNames.length <= 1) {
      showToast('농가명은 최소 1개가 필요합니다.', 'warning');
      return;
    }

    const confirmed = await showConfirm(`"${name}"을 삭제하시겠습니까?`, '삭제', true);
    if (!confirmed) return;

    const newNames = this.defaults.farmerNames.filter((n) => n !== name);
    this.defaults = {
      ...this.defaults,
      farmerNames: newNames,
      defaultFarmerName:
        this.defaults.defaultFarmerName === name
          ? (newNames[0] ?? '')
          : this.defaults.defaultFarmerName,
    };
    this.renderFarmerList();
  }

  private handleSetDefaultFarmer(name: string): void {
    this.defaults = { ...this.defaults, defaultFarmerName: name };
    this.renderFarmerList();
  }

  private handleAddLabel(): void {
    const input = this.newLabelInput;
    if (!input) return;
    const label = input.value.trim();
    if (!label) return;

    if (this.defaults.labels.includes(label)) {
      showToast('이미 존재하는 라벨입니다.', 'warning');
      return;
    }

    this.defaults = { ...this.defaults, labels: [...this.defaults.labels, label] };
    input.value = '';
    this.renderLabelChips();
  }

  private handleDeleteLabel(label: string): void {
    if (this.defaults.labels.length <= 1) {
      showToast('라벨은 최소 1개가 필요합니다.', 'warning');
      return;
    }
    const newLabels = this.defaults.labels.filter((l) => l !== label);
    this.defaults = {
      ...this.defaults,
      labels: newLabels,
      defaultLabel:
        this.defaults.defaultLabel === label
          ? (newLabels[0] ?? '')
          : this.defaults.defaultLabel,
    };
    this.renderLabelChips();
  }

  private handleSetDefaultLabel(label: string): void {
    this.defaults = { ...this.defaults, defaultLabel: label };
    this.renderLabelChips();
  }

  private handleAddTreatment(): void {
    const input = this.newTreatmentInput;
    if (!input) return;
    const treatment = input.value.trim();
    if (!treatment) return;

    if (this.defaults.treatments.includes(treatment)) {
      showToast('이미 존재하는 처리입니다.', 'warning');
      return;
    }

    this.defaults = { ...this.defaults, treatments: [...this.defaults.treatments, treatment] };
    input.value = '';
    this.renderTreatmentChips();
  }

  private handleDeleteTreatment(treatment: string): void {
    if (this.defaults.treatments.length <= 1) {
      showToast('처리는 최소 1개가 필요합니다.', 'warning');
      return;
    }
    const newTreatments = this.defaults.treatments.filter((t) => t !== treatment);
    this.defaults = {
      ...this.defaults,
      treatments: newTreatments,
      defaultTreatment:
        this.defaults.defaultTreatment === treatment
          ? (newTreatments[0] ?? '')
          : this.defaults.defaultTreatment,
    };
    this.renderTreatmentChips();
  }

  private handleSetDefaultTreatment(treatment: string): void {
    this.defaults = { ...this.defaults, defaultTreatment: treatment };
    this.renderTreatmentChips();
  }

  private async handleSave(): Promise<void> {
    if (this.isSaving) return;

    // 조사나무 범위 읽기
    const minInput = this.el?.querySelector<HTMLInputElement>('#tree-min-input');
    const maxInput = this.el?.querySelector<HTMLInputElement>('#tree-max-input');
    const treeMin = parseInt(minInput?.value ?? '1', 10);
    const treeMax = parseInt(maxInput?.value ?? '3', 10);

    if (isNaN(treeMin) || isNaN(treeMax) || treeMin < 1 || treeMax < treeMin) {
      showToast('조사나무 범위가 올바르지 않습니다.', 'error');
      return;
    }

    const toSave: AppDefaults = {
      ...this.defaults,
      treeRange: { min: treeMin, max: treeMax },
    };

    this.isSaving = true;
    const saveBtn = this.el?.querySelector<HTMLButtonElement>('#save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '저장 중...';
    }

    try {
      await SettingsService.saveDefaults(toSave);
      this.defaults = toSave;
      showToast('설정이 저장되었습니다.', 'success');
    } catch {
      showToast('설정 저장에 실패했습니다.', 'error');
    } finally {
      this.isSaving = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '설정 저장';
      }
    }
  }

  // ─────────────────────────────────────────────
  // 유틸리티
  // ─────────────────────────────────────────────

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  private escapeAttr(text: string): string {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
