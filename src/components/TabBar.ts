/**
 * components/TabBar.ts — 하단 탭 네비게이션
 *
 * 목적: 5개 탭(설정/비대조사/품질조사/목록/로그)을 하단에 고정 표시합니다.
 *       AppStore.currentPage를 구독하여 현재 탭을 강조합니다.
 *       탭 클릭 시 hashchange를 통해 라우터에 위임합니다.
 */

import { appStore } from '../store/index.js';
import type { AppState } from '../types.js';

// ─────────────────────────────────────────────
// 탭 정의
// ─────────────────────────────────────────────

interface TabItem {
  /** 해시 경로 */
  href: string;
  /** 아이콘 이모지 */
  icon: string;
  /** 표시 라벨 */
  label: string;
  /** 현재 경로 매칭에 사용할 prefix */
  matchPrefix: string;
}

const TABS: TabItem[] = [
  { href: '#/settings',       icon: '⚙️',  label: '설정',     matchPrefix: '#/settings' },
  { href: '#/survey/growth',  icon: '📏',  label: '비대조사', matchPrefix: '#/survey/growth' },
  { href: '#/survey/quality', icon: '🍊', label: '품질조사', matchPrefix: '#/survey/quality' },
  { href: '#/records',        icon: '📋',  label: '목록',     matchPrefix: '#/records' },
  { href: '#/stttest',        icon: '🧪',  label: 'STT테스트', matchPrefix: '#/stttest' },
  { href: '#/voicelogs',      icon: '🎙️', label: '로그',     matchPrefix: '#/voicelogs' },
];

// ─────────────────────────────────────────────
// TabBar 클래스
// ─────────────────────────────────────────────

export class TabBar {
  private el: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;

  mount(container: HTMLElement): void {
    this.el = document.createElement('nav');
    this.el.className = 'tab-bar';
    this.el.setAttribute('role', 'tablist');
    this.el.setAttribute('aria-label', '주요 탭');

    this.renderTabs('#/survey/growth');
    container.appendChild(this.el);

    // AppStore 구독 — currentPage 변경 시 활성 탭 업데이트
    this.unsubscribe = appStore.subscribe((state: Readonly<AppState>) => {
      this.updateActiveTabs(state.currentPage);
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

  private renderTabs(currentPage: string): void {
    if (!this.el) return;
    this.el.innerHTML = '';

    for (const tab of TABS) {
      const isActive = currentPage.startsWith(tab.matchPrefix);

      const btn = document.createElement('button');
      btn.className = `tab-bar-item${isActive ? ' active' : ''}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(isActive));
      btn.setAttribute('aria-label', tab.label);
      btn.innerHTML = `
        <span class="tab-bar-icon" aria-hidden="true">${tab.icon}</span>
        <span class="tab-bar-label">${tab.label}</span>
      `;

      btn.addEventListener('click', () => this.handleTabClick(tab.href));
      this.el.appendChild(btn);
    }
  }

  private updateActiveTabs(currentPage: string): void {
    if (!this.el) return;
    const buttons = this.el.querySelectorAll<HTMLButtonElement>('.tab-bar-item');
    buttons.forEach((btn, idx) => {
      const tab = TABS[idx];
      if (!tab) return;
      const isActive = currentPage.startsWith(tab.matchPrefix);
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
  }

  private handleTabClick(href: string): void {
    // hashchange 이벤트를 통해 AppStore.navigate() 가 자동 호출됨
    window.location.hash = href;
  }
}
