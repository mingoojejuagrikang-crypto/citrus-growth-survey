/**
 * store/SyncStore.ts — 동기화 상태 스토어
 *
 * 목적: 미동기화 건수, 동기화 진행 여부, 마지막 동기화 결과를 관리합니다.
 *       state-management.md의 SyncStore 설계를 구현합니다.
 */

import { Observable } from './index.js';
import type { SyncState, SyncResult } from '../types.js';
import { nowIso } from '../utils/dateUtils.js';

// ─────────────────────────────────────────────
// 초기 상태
// ─────────────────────────────────────────────

const initialSyncState: SyncState = {
  pendingCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  lastSyncResult: null,
  syncError: null,
};

// ─────────────────────────────────────────────
// SyncStore 클래스
// ─────────────────────────────────────────────

class SyncStore extends Observable<SyncState> {
  constructor() {
    super(initialSyncState);
  }

  /**
   * 미동기화 레코드 건수를 설정합니다.
   * IndexedDBService.getPendingCount() 결과를 반영합니다.
   *
   * @param count 미동기화 건수
   */
  setPendingCount(count: number): void {
    this.setState({ pendingCount: count });
  }

  /**
   * 미동기화 건수를 1 증가시킵니다.
   * 새 레코드 저장 후 호출됩니다.
   */
  incrementPending(): void {
    const state = this.getState();
    this.setState({ pendingCount: state.pendingCount + 1 });
  }

  /**
   * 동기화를 시작합니다.
   * isSyncing을 true로 설정하고 에러를 초기화합니다.
   */
  startSync(): void {
    this.setState({ isSyncing: true, syncError: null });
  }

  /**
   * 동기화 완료를 처리합니다.
   * isSyncing=false, lastSyncAt=now, lastSyncResult 업데이트.
   *
   * @param result 동기화 결과 (성공/실패 건수)
   */
  finishSync(result: SyncResult): void {
    this.setState({
      isSyncing: false,
      lastSyncAt: nowIso(),
      lastSyncResult: result,
      syncError: null,
    });
  }

  /**
   * 동기화 실패를 처리합니다.
   * isSyncing=false, syncError 업데이트.
   *
   * @param msg 오류 메시지
   */
  setSyncError(msg: string): void {
    this.setState({ isSyncing: false, syncError: msg });
  }

  /**
   * 미동기화 건수를 IndexedDB에서 재조회하여 갱신합니다.
   * 비동기로 getPendingCount()를 호출합니다.
   *
   * @param getPendingCountFn IndexedDBService.getPendingCount 함수 참조
   */
  async refresh(getPendingCountFn: () => Promise<number>): Promise<void> {
    try {
      const count = await getPendingCountFn();
      this.setPendingCount(count);
    } catch (err) {
      console.warn('[SyncStore] 미동기화 건수 갱신 실패:', err instanceof Error ? err.message : String(err));
    }
  }
}

// ─────────────────────────────────────────────
// 싱글턴 인스턴스
// ─────────────────────────────────────────────

export const syncStore = new SyncStore();
