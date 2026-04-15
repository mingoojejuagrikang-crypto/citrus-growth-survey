/**
 * components/SyncStatusBar.ts — 동기화 상태 바
 *
 * 목적: 미동기화 건수와 수동 동기화 버튼을 표시합니다.
 *       SyncStore와 AppStore를 구독하여 실시간으로 상태를 반영합니다.
 */

import { syncStore, appStore } from '../store/index.js';
import type { SyncState, AppState } from '../types.js';

export class SyncStatusBar {
  private el: HTMLElement | null = null;
  private unsubscribers: Array<() => void> = [];
  private syncTrigger: (() => Promise<void>) | null = null;

  /**
   * 수동 동기화 트리거 함수를 등록합니다.
   * SheetsService.syncPendingRecords를 주입받아 사용합니다.
   */
  setSyncTrigger(fn: () => Promise<void>): void {
    this.syncTrigger = fn;
  }

  mount(container: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = 'sync-status-bar';
    container.appendChild(this.el);

    // SyncStore 구독
    this.unsubscribers.push(
      syncStore.subscribe((state: Readonly<SyncState>) => {
        const appState = appStore.getState();
        this.updateUI(state, appState);
      }),
    );

    // AppStore 구독 — 온라인/오프라인 상태에 따라 버튼 활성화
    this.unsubscribers.push(
      appStore.subscribe((appState: Readonly<AppState>) => {
        const syncState = syncStore.getState();
        this.updateUI(syncState, appState);
      }),
    );
  }

  unmount(): void {
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  private updateUI(syncState: Readonly<SyncState>, appState: Readonly<AppState>): void {
    if (!this.el) return;

    const { pendingCount, isSyncing, lastSyncAt, syncError } = syncState;
    const isOnline = appState.networkStatus === 'online';

    // 미동기화 없으면 숨김
    if (pendingCount === 0 && !syncError) {
      this.el.style.display = 'none';
      return;
    }

    this.el.style.display = 'flex';
    this.el.classList.toggle('synced', pendingCount === 0 && !syncError);

    let statusText = '';
    let statusIcon = '';

    if (isSyncing) {
      statusIcon = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>';
      statusText = '동기화 중...';
    } else if (syncError) {
      statusIcon = '⚠️';
      statusText = `동기화 실패: ${syncError}`;
    } else {
      statusIcon = '⏳';
      statusText = `미동기화 ${pendingCount}건`;
      if (lastSyncAt) {
        const date = new Date(lastSyncAt);
        const timeStr = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        statusText += ` (마지막: ${timeStr})`;
      }
    }

    const canSync = isOnline && !isSyncing && pendingCount > 0;

    this.el.innerHTML = `
      <span class="sync-status-text">
        ${statusIcon}
        <span>${statusText}</span>
      </span>
      <button
        class="sync-btn"
        type="button"
        ${canSync ? '' : 'disabled'}
        aria-label="수동 동기화 시작"
      >
        ${isSyncing ? '<span class="spinner" style="width:12px;height:12px;border-width:2px;margin-right:4px;"></span>' : ''}
        ${isOnline ? '동기화' : '오프라인'}
      </button>
    `;

    const btn = this.el.querySelector<HTMLButtonElement>('.sync-btn');
    btn?.addEventListener('click', () => this.handleSyncClick());
  }

  private async handleSyncClick(): Promise<void> {
    if (!this.syncTrigger) {
      if (import.meta.env.DEV) {
        console.warn('[SyncStatusBar] syncTrigger가 등록되지 않았습니다.');
      }
      return;
    }

    try {
      await this.syncTrigger();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[SyncStatusBar] 동기화 실패:', err);
      }
    }
  }
}
