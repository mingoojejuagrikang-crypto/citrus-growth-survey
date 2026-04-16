/**
 * pages/VoiceLogPage.ts — STT 음성 로그 목록/관리 페이지
 *
 * 목적: voiceLogs/voiceAudio의 날짜별 통계, 상세 로그, 오디오 재생,
 *       JSON/ZIP 내보내기, 전체 삭제 기능을 제공합니다.
 *
 * 구성:
 *   - 상단: 저장소 통계 + 내보내기/전체 삭제 버튼
 *   - 중단: 날짜별 요약 카드 목록 (최신순)
 *   - 하단: 선택된 날짜의 로그 상세 (토글)
 */

import { getDB } from '../db/index.js';
import {
  getLogs,
  getLogStats,
  getStorageStats,
  exportLogs,
  exportLogsWithAudio,
  deleteLog,
  deleteAllLogs,
} from '../services/VoiceLogService.js';
import { showConfirm } from '../components/ConfirmDialog.js';
import { showToast } from '../utils/toast.js';
import type { VoiceLog, LogDateStat } from '../types.js';

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

/** kind별 배지 색상 클래스 */
const KIND_BADGE_CLASS: Record<string, string> = {
  ok: 'badge-ok',
  warn: 'badge-warn',
  fail: 'badge-fail',
};

/** kind별 레이블 */
const KIND_LABEL: Record<string, string> = {
  ok: '성공',
  warn: '경고',
  fail: '실패',
};

/** 바이트를 사람이 읽기 쉬운 문자열로 변환 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** HTML 특수문자 이스케이프 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

/** ISO 8601 타임스탬프를 'HH:MM:SS' 형식으로 변환 */
function formatTime(isoTs: string): string {
  try {
    const d = new Date(isoTs);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  } catch {
    return isoTs;
  }
}

// ─────────────────────────────────────────────
// VoiceLogPage 클래스
// ─────────────────────────────────────────────

export class VoiceLogPage {
  private el: HTMLElement | null = null;

  /** 현재 펼쳐진 날짜 (토글 상태) */
  private expandedDate: string | null = null;

  /** 날짜별 상세 로그 캐시 (날짜 → VoiceLog[]) */
  private logCache: Map<string, VoiceLog[]> = new Map();

  /** 오디오 재생 중인 URL (해제용) */
  private activeAudioUrls: string[] = [];

  // ─────────────────────────────────────────────
  // 라이프사이클
  // ─────────────────────────────────────────────

  /**
   * 페이지를 container에 마운트하고 데이터를 로드합니다.
   *
   * @param container 마운트할 부모 HTMLElement
   */
  mount(container: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = 'page voice-log-page';
    this.el.innerHTML = this.renderSkeleton();
    container.appendChild(this.el);
    this.injectStyles();
    void this.loadAndRender();
  }

  /**
   * 페이지를 언마운트하고 리소스를 해제합니다.
   */
  unmount(): void {
    this.revokeAudioUrls();
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    this.logCache.clear();
    this.expandedDate = null;
  }

  // ─────────────────────────────────────────────
  // 데이터 로드 및 전체 렌더
  // ─────────────────────────────────────────────

  /**
   * 저장소 통계와 날짜별 통계를 병렬로 조회하고 화면을 갱신합니다.
   */
  private async loadAndRender(): Promise<void> {
    if (!this.el) return;
    try {
      const [storageStats, dateStats] = await Promise.all([
        getStorageStats(),
        getLogStats(),
      ]);
      this.renderStorage(storageStats);
      this.renderDateList(dateStats);
    } catch (err) {
      this.renderError(err instanceof Error ? err.message : String(err));
    }
  }

  // ─────────────────────────────────────────────
  // 렌더링 — 뼈대
  // ─────────────────────────────────────────────

  /**
   * 초기 로딩 상태 HTML을 반환합니다.
   */
  private renderSkeleton(): string {
    return `
      <div class="page-header">
        <h1 class="page-title">음성 로그</h1>
      </div>
      <div class="vl-storage-section" id="vl-storage">
        <div class="vl-loading">불러오는 중…</div>
      </div>
      <div class="vl-date-list" id="vl-date-list">
        <div class="vl-loading">불러오는 중…</div>
      </div>
      <div class="vl-detail-section" id="vl-detail"></div>
    `;
  }

  // ─────────────────────────────────────────────
  // 렌더링 — 저장소 통계 섹션
  // ─────────────────────────────────────────────

  /**
   * 저장소 통계 섹션을 갱신합니다.
   *
   * @param stats getStorageStats() 반환값
   */
  private renderStorage(stats: {
    logCount: number;
    audioCount: number;
    estimatedBytes: number;
  }): void {
    const section = this.el?.querySelector('#vl-storage');
    if (!section) return;

    section.innerHTML = `
      <div class="vl-storage-card">
        <div class="vl-storage-stats">
          <span class="vl-stat-item">
            <span class="vl-stat-label">로그</span>
            <span class="vl-stat-value">${stats.logCount}건</span>
          </span>
          <span class="vl-stat-divider">·</span>
          <span class="vl-stat-item">
            <span class="vl-stat-label">오디오</span>
            <span class="vl-stat-value">${stats.audioCount}개</span>
          </span>
          <span class="vl-stat-divider">·</span>
          <span class="vl-stat-item">
            <span class="vl-stat-label">크기</span>
            <span class="vl-stat-value">${formatBytes(stats.estimatedBytes)}</span>
          </span>
        </div>
        <div class="vl-storage-actions">
          <button class="btn btn-sm btn-secondary" id="vl-btn-export-json">JSON 내보내기</button>
          <button class="btn btn-sm btn-secondary" id="vl-btn-export-zip">ZIP 내보내기</button>
          <button class="btn btn-sm btn-danger" id="vl-btn-delete-all">전체 삭제</button>
        </div>
      </div>
    `;

    section.querySelector('#vl-btn-export-json')?.addEventListener('click', () => {
      void this.handleExportJson();
    });
    section.querySelector('#vl-btn-export-zip')?.addEventListener('click', () => {
      void this.handleExportZip();
    });
    section.querySelector('#vl-btn-delete-all')?.addEventListener('click', () => {
      void this.handleDeleteAll();
    });
  }

  // ─────────────────────────────────────────────
  // 렌더링 — 날짜별 요약 목록
  // ─────────────────────────────────────────────

  /**
   * 날짜별 요약 카드 목록을 갱신합니다.
   *
   * @param stats getLogStats() 반환값 (최신순)
   */
  private renderDateList(stats: LogDateStat[]): void {
    const list = this.el?.querySelector('#vl-date-list');
    if (!list) return;

    if (stats.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="padding: 40px 0;">
          <div class="empty-state-icon">🎙</div>
          <div class="empty-state-text">저장된 음성 로그가 없습니다</div>
        </div>
      `;
      return;
    }

    const cards = stats
      .map((stat) => this.renderDateCard(stat))
      .join('');

    list.innerHTML = `<div class="vl-date-cards">${cards}</div>`;

    // 카드 탭 이벤트 등록
    list.querySelectorAll<HTMLElement>('.vl-date-card').forEach((card) => {
      card.addEventListener('click', () => {
        const date = card.dataset['date'];
        if (!date) return;
        void this.handleDateCardClick(date);
      });
    });
  }

  /**
   * 날짜별 요약 카드 HTML을 반환합니다.
   *
   * @param stat 날짜별 통계 객체
   */
  private renderDateCard(stat: LogDateStat): string {
    const isExpanded = this.expandedDate === stat.date;
    const audioIcon = stat.hasAudio ? '<span class="vl-audio-icon" title="오디오 포함">🎵</span>' : '';
    return `
      <div class="vl-date-card ${isExpanded ? 'is-expanded' : ''}" data-date="${escapeHtml(stat.date)}" role="button" tabindex="0" aria-expanded="${isExpanded}">
        <div class="vl-date-card-header">
          <span class="vl-date-label">${escapeHtml(stat.date)}</span>
          ${audioIcon}
          <span class="vl-date-total">${stat.totalCount}건</span>
          <span class="vl-expand-icon">${isExpanded ? '▲' : '▼'}</span>
        </div>
        <div class="vl-date-card-badges">
          <span class="badge badge-ok">성공 ${stat.okCount}</span>
          <span class="badge badge-warn">경고 ${stat.warnCount}</span>
          <span class="badge badge-fail">실패 ${stat.failCount}</span>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────
  // 렌더링 — 로그 상세 섹션
  // ─────────────────────────────────────────────

  /**
   * 특정 날짜의 로그 상세 목록을 렌더링합니다.
   *
   * @param date YYYY-MM-DD 형식 날짜
   * @param logs 해당 날짜의 로그 목록
   */
  private renderDetail(date: string, logs: VoiceLog[]): void {
    const section = this.el?.querySelector('#vl-detail');
    if (!section) return;

    if (logs.length === 0) {
      section.innerHTML = `<div class="vl-detail-empty">해당 날짜의 로그가 없습니다.</div>`;
      return;
    }

    const items = logs.map((log) => this.renderLogItem(log)).join('');
    section.innerHTML = `
      <div class="vl-detail-header">
        <span class="vl-detail-title">${escapeHtml(date)} 로그 상세</span>
      </div>
      <div class="vl-log-list">${items}</div>
    `;

    // 개별 삭제 버튼 이벤트
    section.querySelectorAll<HTMLButtonElement>('.vl-btn-delete-log').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const logId = btn.dataset['logId'];
        if (!logId) return;
        void this.handleDeleteLog(logId, date);
      });
    });

    // 오디오 재생 버튼 이벤트
    section.querySelectorAll<HTMLButtonElement>('.vl-btn-play-audio').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const audioId = btn.dataset['audioId'];
        if (!audioId) return;
        void this.handlePlayAudio(audioId, btn);
      });
    });
  }

  /**
   * 개별 로그 항목 HTML을 반환합니다.
   *
   * @param log VoiceLog 레코드
   */
  private renderLogItem(log: VoiceLog): string {
    const badgeClass = KIND_BADGE_CLASS[log.kind] ?? 'badge-fail';
    const kindLabel = KIND_LABEL[log.kind] ?? log.kind;
    const timeStr = formatTime(log.ts);

    // 파싱 결과 표시
    let parseHtml = '<span class="vl-parse-none">파싱 결과 없음</span>';
    if (log.parse) {
      const field = log.parse.field ?? '-';
      const value = log.parse.value ?? '-';
      const score = (log.parse.score * 100).toFixed(0);
      parseHtml = `
        <span class="vl-parse-field">${escapeHtml(field)}</span>
        <span class="vl-parse-sep"> → </span>
        <span class="vl-parse-value">${escapeHtml(value)}</span>
        <span class="vl-parse-score">(${score}%)</span>
      `;
    }

    // 오디오 재생 버튼
    const audioBtn = log.audioFileId
      ? `<button class="btn btn-xs btn-secondary vl-btn-play-audio" data-audio-id="${escapeHtml(log.audioFileId)}" title="오디오 재생">▶</button>`
      : '';

    return `
      <div class="vl-log-item" data-log-id="${escapeHtml(log.id)}">
        <div class="vl-log-row vl-log-header-row">
          <span class="vl-log-time">${escapeHtml(timeStr)}</span>
          <span class="badge ${badgeClass}">${escapeHtml(kindLabel)}</span>
          <div class="vl-log-actions">
            ${audioBtn}
            <button class="btn btn-xs btn-danger vl-btn-delete-log" data-log-id="${escapeHtml(log.id)}" title="삭제">✕</button>
          </div>
        </div>
        <div class="vl-log-raw">${escapeHtml(log.rawText)}</div>
        <div class="vl-log-parse">${parseHtml}</div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────
  // 렌더링 — 에러 상태
  // ─────────────────────────────────────────────

  /**
   * 에러 메시지를 날짜 목록 영역에 표시합니다.
   *
   * @param message 에러 메시지
   */
  private renderError(message: string): void {
    const list = this.el?.querySelector('#vl-date-list');
    if (!list) return;
    list.innerHTML = `<div class="vl-error">데이터를 불러오지 못했습니다: ${escapeHtml(message)}</div>`;
  }

  // ─────────────────────────────────────────────
  // 이벤트 핸들러 — 날짜 카드 토글
  // ─────────────────────────────────────────────

  /**
   * 날짜 카드를 탭하면 해당 날짜의 상세 로그를 토글합니다.
   *
   * @param date YYYY-MM-DD 형식 날짜
   */
  private async handleDateCardClick(date: string): Promise<void> {
    // 같은 날짜 재탭 → 접기
    if (this.expandedDate === date) {
      this.expandedDate = null;
      this.clearDetail();
      this.refreshDateCards();
      return;
    }

    this.expandedDate = date;
    this.refreshDateCards();

    try {
      let logs = this.logCache.get(date);
      if (!logs) {
        logs = await getLogs({ dateFrom: date, dateTo: date });
        this.logCache.set(date, logs);
      }
      this.renderDetail(date, logs);
    } catch (err) {
      showToast(
        `로그 조회 실패: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  }

  /**
   * 상세 섹션 내용을 지웁니다.
   */
  private clearDetail(): void {
    const section = this.el?.querySelector('#vl-detail');
    if (section) section.innerHTML = '';
  }

  /**
   * 날짜 카드 목록을 현재 expandedDate 기준으로 재렌더링합니다.
   * (캐시된 통계를 재사용하여 DB 재조회 없이 UI만 갱신)
   */
  private refreshDateCards(): void {
    const list = this.el?.querySelector('#vl-date-list');
    if (!list) return;

    // 카드 DOM에서 직접 aria-expanded/class 토글
    list.querySelectorAll<HTMLElement>('.vl-date-card').forEach((card) => {
      const cardDate = card.dataset['date'];
      const isExpanded = cardDate === this.expandedDate;
      card.classList.toggle('is-expanded', isExpanded);
      card.setAttribute('aria-expanded', String(isExpanded));

      const expandIcon = card.querySelector('.vl-expand-icon');
      if (expandIcon) expandIcon.textContent = isExpanded ? '▲' : '▼';
    });
  }

  // ─────────────────────────────────────────────
  // 이벤트 핸들러 — 내보내기
  // ─────────────────────────────────────────────

  /**
   * 로그를 JSON 파일로 다운로드합니다.
   * exportLogs() → Blob → <a> 클릭 방식으로 처리합니다.
   */
  private async handleExportJson(): Promise<void> {
    try {
      const json = await exportLogs();
      const blob = new Blob([json], { type: 'application/json' });
      this.triggerDownload(blob, `voice-logs-${this.todayStr()}.json`);
      showToast('JSON 내보내기 완료', 'success');
    } catch (err) {
      showToast(
        `내보내기 실패: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  }

  /**
   * 로그와 오디오를 ZIP 파일로 다운로드합니다.
   * exportLogsWithAudio() → Blob → <a> 클릭 방식으로 처리합니다.
   */
  private async handleExportZip(): Promise<void> {
    try {
      showToast('ZIP 생성 중…', 'info', 60000);
      const zipData = await exportLogsWithAudio();
      const blob = new Blob([zipData.buffer as ArrayBuffer], { type: 'application/zip' });
      this.triggerDownload(blob, `voice-logs-${this.todayStr()}.zip`);
      showToast('ZIP 내보내기 완료', 'success');
    } catch (err) {
      showToast(
        `ZIP 내보내기 실패: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  }

  /**
   * Blob을 파일 다운로드로 트리거합니다.
   * Blob URL을 생성 → <a> 클릭 → URL 해제 순으로 처리합니다.
   *
   * @param blob 다운로드할 Blob
   * @param filename 저장 파일명
   */
  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 짧은 딜레이 후 URL 해제 (브라우저 다운로드 시작 보장)
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ─────────────────────────────────────────────
  // 이벤트 핸들러 — 삭제
  // ─────────────────────────────────────────────

  /**
   * 전체 로그를 삭제합니다.
   * showConfirm으로 위험 동작 확인 후 deleteAllLogs()를 호출합니다.
   */
  private async handleDeleteAll(): Promise<void> {
    const confirmed = await showConfirm(
      '모든 음성 로그와 오디오 파일을 삭제합니다. 되돌릴 수 없습니다.',
      '전체 삭제',
      true,
    );
    if (!confirmed) return;

    try {
      await deleteAllLogs();
      this.logCache.clear();
      this.expandedDate = null;
      showToast('전체 로그가 삭제되었습니다', 'success');
      void this.loadAndRender();
    } catch (err) {
      showToast(
        `삭제 실패: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  }

  /**
   * 개별 로그를 삭제합니다.
   * showConfirm으로 확인 후 deleteLog()를 호출합니다.
   *
   * @param logId 삭제할 로그 id
   * @param date 해당 로그가 속한 날짜 (캐시 갱신용)
   */
  private async handleDeleteLog(logId: string, date: string): Promise<void> {
    const confirmed = await showConfirm('이 로그를 삭제하시겠습니까?', '삭제', true);
    if (!confirmed) return;

    try {
      await deleteLog(logId);

      // 캐시에서 해당 로그 제거
      const cached = this.logCache.get(date);
      if (cached) {
        const updated = cached.filter((l) => l.id !== logId);
        this.logCache.set(date, updated);
        this.renderDetail(date, updated);
      }

      showToast('로그가 삭제되었습니다', 'success');

      // 저장소 통계 갱신
      try {
        const storageStats = await getStorageStats();
        this.renderStorage(storageStats);
      } catch {
        // 통계 갱신 실패는 무시
      }
    } catch (err) {
      showToast(
        `삭제 실패: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  }

  // ─────────────────────────────────────────────
  // 이벤트 핸들러 — 오디오 재생
  // ─────────────────────────────────────────────

  /**
   * voiceAudio 스토어에서 blob을 조회하여 오디오를 재생합니다.
   * URL.createObjectURL로 임시 URL을 생성하고 재생 종료 시 해제합니다.
   *
   * @param audioId voiceAudio.id
   * @param triggerBtn 재생 버튼 엘리먼트 (재생 중 상태 표시용)
   */
  private async handlePlayAudio(
    audioId: string,
    triggerBtn: HTMLButtonElement,
  ): Promise<void> {
    try {
      const db = await getDB();
      const audioRecord = await db.get('voiceAudio', audioId);
      if (!audioRecord) {
        showToast('오디오 파일을 찾을 수 없습니다', 'warning');
        return;
      }

      const url = URL.createObjectURL(audioRecord.blob);
      this.activeAudioUrls.push(url);

      const audio = new Audio(url);
      triggerBtn.textContent = '■';
      triggerBtn.disabled = true;

      audio.addEventListener('ended', () => {
        triggerBtn.textContent = '▶';
        triggerBtn.disabled = false;
        URL.revokeObjectURL(url);
        this.activeAudioUrls = this.activeAudioUrls.filter((u) => u !== url);
      });

      audio.addEventListener('error', () => {
        triggerBtn.textContent = '▶';
        triggerBtn.disabled = false;
        URL.revokeObjectURL(url);
        this.activeAudioUrls = this.activeAudioUrls.filter((u) => u !== url);
        showToast('오디오 재생 실패', 'error');
      });

      await audio.play();
    } catch (err) {
      showToast(
        `오디오 재생 실패: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  }

  // ─────────────────────────────────────────────
  // 유틸 — 활성 오디오 URL 해제
  // ─────────────────────────────────────────────

  /**
   * 페이지 언마운트 시 생성된 모든 오디오 Blob URL을 해제합니다.
   */
  private revokeAudioUrls(): void {
    this.activeAudioUrls.forEach((url) => URL.revokeObjectURL(url));
    this.activeAudioUrls = [];
  }

  // ─────────────────────────────────────────────
  // 유틸 — 기타
  // ─────────────────────────────────────────────

  /**
   * 오늘 날짜를 'YYYY-MM-DD' 형식으로 반환합니다.
   */
  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  // ─────────────────────────────────────────────
  // 인라인 스타일 — 페이지 전용 CSS
  // ─────────────────────────────────────────────

  /**
   * VoiceLogPage 전용 스타일을 <head>에 한 번만 주입합니다.
   * 이미 주입된 경우 건너뜁니다.
   */
  private injectStyles(): void {
    const STYLE_ID = 'voice-log-page-styles';
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ── VoiceLogPage 레이아웃 ── */
      .voice-log-page {
        display: flex;
        flex-direction: column;
        gap: 0;
        padding-bottom: 80px;
      }

      /* ── 저장소 통계 카드 ── */
      .vl-storage-card {
        background: var(--surface, #fff);
        border-bottom: 1px solid var(--border, #e0e0e0);
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .vl-storage-stats {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
      }
      .vl-stat-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .vl-stat-label {
        font-size: 12px;
        color: var(--text-secondary, #666);
      }
      .vl-stat-value {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary, #212121);
      }
      .vl-stat-divider {
        color: var(--text-secondary, #aaa);
        margin: 0 4px;
      }
      .vl-storage-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      /* ── 날짜별 카드 목록 ── */
      .vl-date-cards {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      .vl-date-card {
        background: var(--surface, #fff);
        border-bottom: 1px solid var(--border, #e0e0e0);
        padding: 12px 16px;
        cursor: pointer;
        user-select: none;
        transition: background 0.15s;
      }
      .vl-date-card:hover,
      .vl-date-card.is-expanded {
        background: var(--surface-hover, #f5f5f5);
      }
      .vl-date-card-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .vl-date-label {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary, #212121);
        flex: 1;
      }
      .vl-audio-icon {
        font-size: 13px;
      }
      .vl-date-total {
        font-size: 13px;
        color: var(--text-secondary, #666);
      }
      .vl-expand-icon {
        font-size: 11px;
        color: var(--text-secondary, #999);
        margin-left: 4px;
      }
      .vl-date-card-badges {
        display: flex;
        gap: 6px;
        margin-top: 6px;
      }

      /* ── 배지 ── */
      .badge {
        display: inline-block;
        padding: 2px 7px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.4;
      }
      .badge-ok {
        background: #e8f5e9;
        color: #2e7d32;
      }
      .badge-warn {
        background: #fff3e0;
        color: #e65100;
      }
      .badge-fail {
        background: #ffebee;
        color: #c62828;
      }

      /* ── 로그 상세 섹션 ── */
      .vl-detail-section {
        background: var(--surface-alt, #fafafa);
      }
      .vl-detail-header {
        padding: 10px 16px 4px;
        border-bottom: 1px solid var(--border, #e0e0e0);
      }
      .vl-detail-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary, #555);
      }
      .vl-detail-empty {
        padding: 20px 16px;
        font-size: 13px;
        color: var(--text-secondary, #888);
      }

      /* ── 로그 항목 ── */
      .vl-log-list {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      .vl-log-item {
        padding: 10px 16px;
        border-bottom: 1px solid var(--border, #ececec);
        background: var(--surface, #fff);
      }
      .vl-log-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .vl-log-header-row {
        margin-bottom: 4px;
      }
      .vl-log-time {
        font-size: 12px;
        color: var(--text-secondary, #888);
        font-variant-numeric: tabular-nums;
        min-width: 56px;
      }
      .vl-log-actions {
        margin-left: auto;
        display: flex;
        gap: 4px;
        align-items: center;
      }
      .vl-log-raw {
        font-size: 14px;
        color: var(--text-primary, #212121);
        margin-bottom: 2px;
        word-break: break-all;
      }
      .vl-log-parse {
        font-size: 12px;
        color: var(--text-secondary, #666);
      }
      .vl-parse-field { font-weight: 600; color: #1565c0; }
      .vl-parse-value { color: #2e7d32; }
      .vl-parse-score { color: #999; }
      .vl-parse-none  { color: #bbb; font-style: italic; }

      /* ── 버튼 크기 변형 ── */
      .btn-xs {
        padding: 2px 7px;
        font-size: 11px;
        border-radius: 4px;
        min-height: 24px;
      }
      .btn-sm {
        padding: 5px 12px;
        font-size: 13px;
        border-radius: 6px;
      }
      .btn-danger {
        background: #c62828;
        color: #fff;
        border: none;
        cursor: pointer;
      }
      .btn-danger:hover { background: #b71c1c; }
      .btn-secondary {
        background: var(--surface, #fff);
        color: var(--text-primary, #333);
        border: 1px solid var(--border, #ccc);
        cursor: pointer;
      }
      .btn-secondary:hover { background: var(--surface-hover, #f0f0f0); }

      /* ── 로딩/에러 ── */
      .vl-loading {
        padding: 24px 16px;
        font-size: 14px;
        color: var(--text-secondary, #999);
        text-align: center;
      }
      .vl-error {
        padding: 24px 16px;
        font-size: 14px;
        color: #c62828;
      }
    `;
    document.head.appendChild(style);
  }
}
