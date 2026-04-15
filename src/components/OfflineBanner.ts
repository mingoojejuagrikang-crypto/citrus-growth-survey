/**
 * components/OfflineBanner.ts — 오프라인 상태 배너
 *
 * 목적: 네트워크가 오프라인 상태일 때 화면 상단에 고정 배너를 표시합니다.
 *       AppStore.networkStatus를 구독하여 자동으로 표시/숨김 처리합니다.
 */

import { appStore } from '../store/index.js';
import type { AppState } from '../types.js';

export class OfflineBanner {
  private el: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;

  mount(container: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = 'offline-banner';
    this.el.setAttribute('role', 'alert');
    this.el.setAttribute('aria-live', 'polite');
    this.el.innerHTML = `
      <span class="offline-banner-icon">📡</span>
      <span>오프라인 상태입니다. 저장은 가능하며 온라인 복구 시 자동 동기화됩니다.</span>
    `;
    this.el.style.display = 'none';

    container.prepend(this.el);

    // AppStore 구독 — 네트워크 상태 변경 시 배너 토글
    this.unsubscribe = appStore.subscribe((state: Readonly<AppState>) => {
      this.updateVisibility(state.networkStatus);
    });
  }

  unmount(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  private updateVisibility(status: 'online' | 'offline'): void {
    if (!this.el) return;
    const isOffline = status === 'offline';
    this.el.style.display = isOffline ? 'flex' : 'none';
  }
}
