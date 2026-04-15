/**
 * pages/RecordListPage.ts — 저장 레코드 목록 조회 (F003)
 *
 * 목적: IndexedDB에 저장된 레코드를 조사일자/농가명 기준으로 그룹화하여 표시합니다.
 *
 * Acceptance Criteria (F003):
 * - 조사일자/농가명 기준 그룹화 목록 표시
 * - 동기화 상태 아이콘 (⏳ 미동기화 / ✓ 완료 / ⚠ 오류)
 * - 탭하면 상세 내용 인라인 펼치기
 * - 수정/삭제 가능 (삭제 전 ConfirmDialog)
 * - 앱 재시작 후 데이터 복구 확인 가능
 */

import type { GrowthRecord, QualityRecord, SurveyType, SyncStatus } from '../types.js';
import * as IndexedDBService from '../services/IndexedDBService.js';
import { syncStore } from '../store/index.js';
import { showConfirm } from '../components/ConfirmDialog.js';
import { SyncStatusBar } from '../components/SyncStatusBar.js';
import { showToast } from '../utils/toast.js';
import { formatDisplayDate } from '../utils/dateUtils.js';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

interface SessionGroup {
  sessionKey: string;
  surveyDate: string;
  farmerName: string;
  label: string;
  treatment: string;
  records: Array<GrowthRecord | QualityRecord>;
  surveyType: SurveyType;
  syncedCount: number;
  pendingCount: number;
}

type FilterType = 'all' | 'growth' | 'quality';

// ─────────────────────────────────────────────
// RecordListPage 클래스
// ─────────────────────────────────────────────

export class RecordListPage {
  private el: HTMLElement | null = null;
  private syncStatusBar: SyncStatusBar | null = null;
  private allRecords: Array<GrowthRecord | QualityRecord> = [];
  private expandedRecordId: string | null = null;
  private activeFilter: FilterType = 'all';
  private isLoading = false;

  async mount(container: HTMLElement): Promise<void> {
    this.el = document.createElement('div');
    container.appendChild(this.el);

    this.renderSkeleton();
    await this.loadRecords();
    this.render();
  }

  unmount(): void {
    this.syncStatusBar?.unmount();
    this.syncStatusBar = null;

    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  // ─────────────────────────────────────────────
  // 데이터 로드
  // ─────────────────────────────────────────────

  private async loadRecords(): Promise<void> {
    this.isLoading = true;
    try {
      const [growthRecords, qualityRecords] = await Promise.all([
        IndexedDBService.getRecords('growth'),
        IndexedDBService.getRecords('quality'),
      ]);

      // 타입 태그 추가 (구분용)
      const taggedGrowth = growthRecords.map((r) => ({ ...r, _type: 'growth' as SurveyType }));
      const taggedQuality = qualityRecords.map((r) => ({ ...r, _type: 'quality' as SurveyType }));

      this.allRecords = [
        ...taggedGrowth,
        ...taggedQuality,
      ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch {
      showToast('레코드를 불러오지 못했습니다.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // ─────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────

  private renderSkeleton(): void {
    if (!this.el) return;
    this.el.innerHTML = `
      <div class="page" style="padding-top:0;">
        <div class="page-header" style="position:sticky;top:0;z-index:20;">
          <h1>목록</h1>
        </div>
        <div style="padding:var(--padding-mobile);">
          ${Array.from({ length: 3 }).map(() => `
            <div class="skeleton" style="height:72px;margin-bottom:8px;border-radius:var(--radius);"></div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private render(): void {
    if (!this.el) return;

    const filteredRecords = this.getFilteredRecords();
    const groups = this.groupRecords(filteredRecords);

    this.el.innerHTML = `
      <div class="page" style="padding-top:0;">

        <!-- 헤더 -->
        <div class="page-header" style="position:sticky;top:0;z-index:20;">
          <h1>목록</h1>
          <button class="btn btn-ghost" id="refresh-btn" type="button" style="font-size:14px;color:var(--color-primary);">
            새로고침
          </button>
        </div>

        <div style="padding:var(--padding-mobile);padding-bottom:calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 24px);">

          <!-- 동기화 상태 바 -->
          <div id="sync-status-container"></div>

          <!-- 필터 탭 -->
          <div class="filter-bar">
            <button class="filter-chip${this.activeFilter === 'all' ? ' active' : ''}" data-filter="all" type="button">전체</button>
            <button class="filter-chip${this.activeFilter === 'growth' ? ' active' : ''}" data-filter="growth" type="button">비대조사</button>
            <button class="filter-chip${this.activeFilter === 'quality' ? ' active' : ''}" data-filter="quality" type="button">품질조사</button>
          </div>

          <!-- 통계 요약 -->
          <div style="display:flex;gap:8px;margin-bottom:16px;">
            ${this.renderStatBadge(filteredRecords)}
          </div>

          <!-- 레코드 목록 -->
          <div id="record-groups">
            ${groups.length === 0 ? this.renderEmptyState() : groups.map((g) => this.renderSessionGroup(g)).join('')}
          </div>

        </div>
      </div>
    `;

    this.mountSyncStatusBar();
    this.bindEvents();
  }

  private renderStatBadge(records: Array<GrowthRecord | QualityRecord>): string {
    const total = records.length;
    const pending = records.filter((r) => r.syncStatus === 'pending').length;
    const synced = records.filter((r) => r.syncStatus === 'synced').length;

    return `
      <div class="badge badge-success" style="font-size:13px;">전체 ${total}건</div>
      <div class="badge badge-warning" style="font-size:13px;">미동기화 ${pending}건</div>
      <div class="badge" style="background:var(--color-primary-bg);color:var(--color-primary);font-size:13px;">완료 ${synced}건</div>
    `;
  }

  private renderEmptyState(): string {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">저장된 레코드가 없습니다</div>
        <div class="empty-state-sub">비대조사 또는 품질조사 탭에서 데이터를 입력하세요</div>
      </div>
    `;
  }

  private renderSessionGroup(group: SessionGroup): string {
    const dateDisplay = formatDisplayDate(group.surveyDate);
    const syncBadge = group.pendingCount > 0
      ? `<span style="font-size:12px;color:var(--color-warning);">⏳ ${group.pendingCount}건 미동기화</span>`
      : `<span style="font-size:12px;color:var(--color-primary);">✓ 모두 동기화</span>`;
    const typeLabel = group.surveyType === 'growth' ? '비대' : '품질';

    return `
      <div class="session-group" data-session-key="${this.escapeAttr(group.sessionKey)}">
        <div class="session-group-header">
          <div class="session-group-info">
            <div class="session-group-title">
              ${this.escapeHtml(group.farmerName)} · ${this.escapeHtml(group.label)} · ${this.escapeHtml(group.treatment)}
              <span style="font-size:11px;background:var(--color-primary);color:white;padding:1px 6px;border-radius:99px;margin-left:6px;">${typeLabel}</span>
            </div>
            <div class="session-group-meta">${dateDisplay} · ${syncBadge}</div>
          </div>
          <span class="session-group-count">${group.records.length}건</span>
        </div>

        <div class="session-group-records">
          ${group.records.map((r) => this.renderRecordCard(r, group.surveyType)).join('')}
        </div>
      </div>
    `;
  }

  private renderRecordCard(record: GrowthRecord | QualityRecord, surveyType: SurveyType): string {
    const isExpanded = this.expandedRecordId === record.id;
    const syncIcon = this.getSyncIcon(record.syncStatus);
    const growthR = record as GrowthRecord;
    const qualityR = record as QualityRecord;

    const valSummary = surveyType === 'growth'
      ? `횡경 ${growthR.width ?? '-'} · 종경 ${growthR.height ?? '-'}`
      : `횡경 ${growthR.width ?? '-'} · 당도 ${qualityR.brix ?? '-'}`;

    const detailHTML = isExpanded ? this.renderRecordDetail(record, surveyType) : '';

    return `
      <div class="record-card" data-record-id="${this.escapeAttr(record.id)}" data-survey-type="${surveyType}">
        <div class="record-card-header" data-action="toggle-detail" data-record-id="${this.escapeAttr(record.id)}">
          <div class="record-card-main">
            <div class="record-card-id">나무 ${growthR.treeNo}번 · 과실 ${growthR.fruitNo}번</div>
            <div class="record-card-values">${valSummary}</div>
          </div>
          <div class="record-card-actions">
            <span class="${this.getSyncIconClass(record.syncStatus)}" aria-label="${this.getSyncLabel(record.syncStatus)}">${syncIcon}</span>
            <span style="color:var(--color-text-secondary);font-size:18px;transition:transform 200ms;">${isExpanded ? '▲' : '▼'}</span>
          </div>
        </div>
        ${detailHTML}
      </div>
    `;
  }

  private renderRecordDetail(record: GrowthRecord | QualityRecord, surveyType: SurveyType): string {
    const growthR = record as GrowthRecord;
    const qualityR = record as QualityRecord;

    const commonFields = [
      { label: '조사일자', value: formatDisplayDate(record.surveyDate) },
      { label: '농가명', value: record.farmerName },
      { label: '라벨', value: record.label },
      { label: '처리', value: record.treatment },
      { label: '나무번호', value: `${growthR.treeNo}번` },
      { label: '과실번호', value: `${growthR.fruitNo}번` },
      { label: '횡경', value: growthR.width != null ? `${growthR.width} mm` : '-' },
      { label: '종경', value: growthR.height != null ? `${growthR.height} mm` : '-' },
    ];

    const qualityFields = surveyType === 'quality' ? [
      { label: '과중', value: qualityR.fruitWeight != null ? `${qualityR.fruitWeight} g` : '-' },
      { label: '과피중', value: qualityR.pericarpWeight != null ? `${qualityR.pericarpWeight} g` : '-' },
      { label: '과피두께', value: qualityR.pericarpThickness != null ? `${qualityR.pericarpThickness} mm` : '-' },
      { label: '과피두께×4', value: qualityR.pericarpThicknessX4 != null ? `${qualityR.pericarpThicknessX4} mm` : '-' },
      { label: '당도', value: qualityR.brix != null ? `${qualityR.brix} °Bx` : '-' },
      { label: '산함량', value: qualityR.acidContent != null ? `${qualityR.acidContent} %` : '-' },
      { label: '당산도', value: qualityR.sugarAcidRatio != null ? String(qualityR.sugarAcidRatio) : '-' },
      { label: '착색', value: qualityR.coloring != null ? String(qualityR.coloring) : '-' },
      { label: '비파괴', value: qualityR.nonDestructive != null ? String(qualityR.nonDestructive) : '-' },
    ] : [];

    const allFields = [...commonFields, ...qualityFields];
    if (growthR.remark) {
      allFields.push({ label: '비고', value: growthR.remark });
    }

    const syncAtText = record.syncedAt
      ? new Date(record.syncedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : null;

    return `
      <div class="record-card-detail">
        <div class="record-detail-grid">
          ${allFields.map((f) => `
            <div class="record-detail-item">
              <span class="record-detail-label">${this.escapeHtml(f.label)}</span>
              <span class="record-detail-value">${this.escapeHtml(f.value)}</span>
            </div>
          `).join('')}
        </div>
        ${syncAtText ? `<div style="font-size:11px;color:var(--color-text-secondary);margin-top:8px;">동기화: ${syncAtText}</div>` : ''}
        <div class="record-detail-actions">
          <button class="btn btn-secondary" data-action="edit-record" data-record-id="${this.escapeAttr(record.id)}" data-survey-type="${surveyType}" type="button" style="flex:1;height:40px;font-size:14px;">
            수정
          </button>
          <button class="btn btn-danger" data-action="delete-record" data-record-id="${this.escapeAttr(record.id)}" data-survey-type="${surveyType}" type="button" style="flex:1;height:40px;font-size:14px;">
            삭제
          </button>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────
  // 서브 컴포넌트
  // ─────────────────────────────────────────────

  private mountSyncStatusBar(): void {
    const container = this.el?.querySelector<HTMLElement>('#sync-status-container');
    if (!container) return;

    this.syncStatusBar?.unmount();
    this.syncStatusBar = new SyncStatusBar();
    this.syncStatusBar.mount(container);
  }

  // ─────────────────────────────────────────────
  // 이벤트 바인딩
  // ─────────────────────────────────────────────

  private bindEvents(): void {
    if (!this.el) return;

    // 새로고침
    const refreshBtn = this.el.querySelector('#refresh-btn');
    refreshBtn?.addEventListener('click', () => this.handleRefresh());

    // 필터 탭
    const filterBar = this.el.querySelector('.filter-bar');
    filterBar?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-filter]');
      if (!btn) return;
      const filter = btn.dataset['filter'] as FilterType;
      this.handleFilterChange(filter);
    });

    // 이벤트 위임 — 레코드 카드
    const groupsContainer = this.el.querySelector('#record-groups');
    groupsContainer?.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const actionEl = target.closest<HTMLElement>('[data-action]');
      if (!actionEl) return;

      const action = actionEl.dataset['action'];
      const recordId = actionEl.dataset['recordId'];
      const surveyType = (actionEl.dataset['surveyType'] ?? 'growth') as SurveyType;

      if (action === 'toggle-detail' && recordId) {
        this.handleToggleDetail(recordId);
      } else if (action === 'delete-record' && recordId) {
        await this.handleDeleteRecord(recordId, surveyType);
      } else if (action === 'edit-record' && recordId) {
        this.handleEditRecord(recordId, surveyType);
      }
    });
  }

  // ─────────────────────────────────────────────
  // 핸들러
  // ─────────────────────────────────────────────

  private handleToggleDetail(recordId: string): void {
    this.expandedRecordId = this.expandedRecordId === recordId ? null : recordId;
    this.rerenderGroups();
  }

  private async handleDeleteRecord(recordId: string, surveyType: SurveyType): Promise<void> {
    const confirmed = await showConfirm(
      '레코드를 삭제하면 복구할 수 없습니다. 삭제하시겠습니까?',
      '삭제',
      true,
    );
    if (!confirmed) return;

    try {
      await IndexedDBService.deleteRecord(surveyType, recordId);
      this.allRecords = this.allRecords.filter((r) => r.id !== recordId);
      this.expandedRecordId = null;
      await syncStore.refresh(() => IndexedDBService.getPendingCount());
      this.rerenderGroups();
      showToast('레코드가 삭제되었습니다.', 'success');
    } catch {
      showToast('삭제에 실패했습니다.', 'error');
    }
  }

  private handleEditRecord(recordId: string, surveyType: SurveyType): void {
    // 편집 대상 레코드 ID를 URL hash에 포함하여 SurveyInputPage가 prefill 가능하도록 함
    // SurveyInputPage.mount()에서 edit= 파라미터를 파싱하여 폼을 채움 (이슈 3)
    const base = surveyType === 'growth' ? '#/survey/growth' : '#/survey/quality';
    window.location.hash = `${base}?edit=${encodeURIComponent(recordId)}`;
  }

  private handleFilterChange(filter: FilterType): void {
    this.activeFilter = filter;
    this.rerenderGroups();

    // 필터 버튼 활성화 상태 업데이트
    const filterBtns = this.el?.querySelectorAll<HTMLButtonElement>('[data-filter]');
    filterBtns?.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset['filter'] === filter);
    });
  }

  private async handleRefresh(): Promise<void> {
    const refreshBtn = this.el?.querySelector<HTMLButtonElement>('#refresh-btn');
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = '로딩 중...';
    }

    await this.loadRecords();
    this.expandedRecordId = null;
    this.rerenderGroups();

    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '새로고침';
    }
    showToast('새로고침 완료', 'success');
  }

  // ─────────────────────────────────────────────
  // 부분 렌더링
  // ─────────────────────────────────────────────

  private rerenderGroups(): void {
    const container = this.el?.querySelector<HTMLElement>('#record-groups');
    if (!container) return;

    const filteredRecords = this.getFilteredRecords();
    const groups = this.groupRecords(filteredRecords);

    container.innerHTML = groups.length === 0
      ? this.renderEmptyState()
      : groups.map((g) => this.renderSessionGroup(g)).join('');

    // 통계 재렌더
    const statContainer = container.previousElementSibling;
    if (statContainer && statContainer instanceof HTMLElement) {
      statContainer.innerHTML = this.renderStatBadge(filteredRecords);
    }
  }

  // ─────────────────────────────────────────────
  // 데이터 가공
  // ─────────────────────────────────────────────

  private getFilteredRecords(): Array<GrowthRecord | QualityRecord> {
    if (this.activeFilter === 'all') return this.allRecords;
    return this.allRecords.filter((r) => {
      // _type 태그로 필터링 (타입 단언 사용)
      const tagged = r as GrowthRecord & { _type?: SurveyType };
      return tagged._type === this.activeFilter;
    });
  }

  private groupRecords(records: Array<GrowthRecord | QualityRecord>): SessionGroup[] {
    const groupMap = new Map<string, SessionGroup>();

    for (const record of records) {
      const tagged = record as GrowthRecord & { _type?: SurveyType };
      const surveyType: SurveyType = tagged._type ?? 'growth';
      // sessionKey + surveyType로 그룹 키 생성
      const groupKey = `${record.sessionKey}_${surveyType}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          sessionKey: record.sessionKey,
          surveyDate: record.surveyDate,
          farmerName: record.farmerName,
          label: record.label,
          treatment: record.treatment,
          records: [],
          surveyType,
          syncedCount: 0,
          pendingCount: 0,
        });
      }

      const group = groupMap.get(groupKey)!;
      group.records.push(record);

      if (record.syncStatus === 'synced') {
        group.syncedCount++;
      } else {
        group.pendingCount++;
      }
    }

    // 그룹 내 레코드를 treeNo, fruitNo 순으로 정렬
    for (const group of groupMap.values()) {
      group.records.sort((a, b) => {
        const ga = a as GrowthRecord;
        const gb = b as GrowthRecord;
        if (ga.treeNo !== gb.treeNo) return ga.treeNo - gb.treeNo;
        return ga.fruitNo - gb.fruitNo;
      });
    }

    // 날짜 내림차순으로 정렬
    return Array.from(groupMap.values()).sort((a, b) =>
      b.surveyDate.localeCompare(a.surveyDate),
    );
  }

  // ─────────────────────────────────────────────
  // 유틸리티
  // ─────────────────────────────────────────────

  private getSyncIcon(status: SyncStatus): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'synced': return '✓';
      case 'error': return '⚠️';
      default: return '?';
    }
  }

  private getSyncIconClass(status: SyncStatus): string {
    switch (status) {
      case 'pending': return 'sync-icon-pending';
      case 'synced': return 'sync-icon-synced';
      case 'error': return 'sync-icon-error';
      default: return '';
    }
  }

  private getSyncLabel(status: SyncStatus): string {
    switch (status) {
      case 'pending': return '미동기화';
      case 'synced': return '동기화 완료';
      case 'error': return '동기화 오류';
      default: return '';
    }
  }

  private escapeHtml(text: string | number | null | undefined): string {
    if (text == null) return '-';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text)));
    return div.innerHTML;
  }

  private escapeAttr(text: string | number | null | undefined): string {
    return String(text ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
