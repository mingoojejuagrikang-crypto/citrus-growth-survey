/**
 * components/ConfirmDialog.ts — 재사용 확인 다이얼로그
 *
 * 목적: 중복 레코드, 이상치 저장, 삭제 등 확인이 필요한 동작에 사용하는 모달입니다.
 *       Promise 기반 showConfirm() 함수로 간편하게 사용할 수 있습니다.
 *
 * 사용 예시:
 *   const confirmed = await showConfirm('정말 삭제하시겠습니까?', '삭제', true);
 *   if (confirmed) { ... }
 */

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 위험 동작(삭제 등) 시 확인 버튼을 빨간색으로 표시 */
  isDangerous?: boolean;
}

// ─────────────────────────────────────────────
// showConfirm — Promise 기반 단순 API
// ─────────────────────────────────────────────

/**
 * 확인 다이얼로그를 표시하고 사용자의 선택을 Promise로 반환합니다.
 *
 * @param message 본문 메시지
 * @param confirmLabel 확인 버튼 텍스트 (기본: '확인')
 * @param isDangerous 위험 동작 여부 (확인 버튼 빨간색)
 * @returns 확인 시 true, 취소 시 false
 */
export function showConfirm(
  message: string,
  confirmLabel = '확인',
  isDangerous = false,
): Promise<boolean> {
  return showConfirmWithOptions({ message, confirmLabel, isDangerous });
}

/**
 * 더 많은 옵션을 지원하는 확인 다이얼로그 표시 함수.
 */
export function showConfirmWithOptions(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const dialog = new ConfirmDialog(options);
    dialog.show().then((result) => {
      resolve(result);
    });
  });
}

// ─────────────────────────────────────────────
// ConfirmDialog 클래스
// ─────────────────────────────────────────────

export class ConfirmDialog {
  private overlay: HTMLElement | null = null;
  private readonly options: Required<ConfirmDialogOptions>;

  constructor(options: ConfirmDialogOptions) {
    this.options = {
      title: options.title ?? '',
      message: options.message,
      confirmLabel: options.confirmLabel ?? '확인',
      cancelLabel: options.cancelLabel ?? '취소',
      isDangerous: options.isDangerous ?? false,
    };
  }

  /**
   * 다이얼로그를 표시하고 사용자 선택을 반환합니다.
   * @returns 확인: true, 취소: false
   */
  show(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.overlay = document.createElement('div');
      this.overlay.className = 'dialog-overlay';
      this.overlay.setAttribute('role', 'dialog');
      this.overlay.setAttribute('aria-modal', 'true');
      this.overlay.setAttribute('aria-label', this.options.title || this.options.message);

      const { title, message, confirmLabel, cancelLabel, isDangerous } = this.options;

      this.overlay.innerHTML = `
        <div class="dialog-box">
          ${title ? `<h2 class="dialog-title">${this.escapeHtml(title)}</h2>` : ''}
          <p class="dialog-message">${this.escapeHtml(message)}</p>
          <div class="dialog-actions">
            <button class="dialog-btn dialog-btn-cancel" type="button">${this.escapeHtml(cancelLabel)}</button>
            <button class="dialog-btn ${isDangerous ? 'dialog-btn-danger' : 'dialog-btn-confirm'}" type="button">
              ${this.escapeHtml(confirmLabel)}
            </button>
          </div>
        </div>
      `;

      const box = this.overlay.querySelector('.dialog-box');
      const cancelBtn = this.overlay.querySelector('.dialog-btn-cancel');
      const confirmBtn = this.overlay.querySelector(`.${isDangerous ? 'dialog-btn-danger' : 'dialog-btn-confirm'}`);

      const handleConfirm = () => {
        this.close();
        resolve(true);
      };

      const handleCancel = () => {
        this.close();
        resolve(false);
      };

      // 오버레이 배경 클릭 시 취소
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          handleCancel();
        }
      });

      // dialog-box 내부 클릭은 버블링 차단
      box?.addEventListener('click', (e) => e.stopPropagation());

      confirmBtn?.addEventListener('click', handleConfirm);
      cancelBtn?.addEventListener('click', handleCancel);

      // 키보드 접근성: Enter → 확인, Escape → 취소
      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          handleConfirm();
          document.removeEventListener('keydown', handleKeydown);
        } else if (e.key === 'Escape') {
          handleCancel();
          document.removeEventListener('keydown', handleKeydown);
        }
      };
      document.addEventListener('keydown', handleKeydown);

      document.body.appendChild(this.overlay);

      // 확인 버튼에 포커스
      (confirmBtn as HTMLButtonElement | null)?.focus();
    });
  }

  private close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }
}
