/**
 * pages/VoiceLogPage.ts — STT 로그 목록 페이지 (Sprint 2 구현 예정)
 *
 * 목적: Sprint 1에서는 플레이스홀더로 표시합니다.
 *       실제 구현은 F007/F008 기능 개발 시 완성합니다.
 */
export class VoiceLogPage {
    el = null;
    mount(container) {
        this.el = document.createElement('div');
        this.el.className = 'page';
        this.el.innerHTML = `
      <div class="page-header">
        <h1>음성 로그</h1>
      </div>
      <div class="empty-state" style="padding-top: 80px;">
        <div class="empty-state-icon">🎙️</div>
        <div class="empty-state-text">음성 로그 기능은 Sprint 2에서 구현됩니다</div>
        <div class="empty-state-sub">STT 로그 수집을 설정에서 활성화하세요</div>
      </div>
    `;
        container.appendChild(this.el);
    }
    unmount() {
        if (this.el) {
            this.el.remove();
            this.el = null;
        }
    }
}
