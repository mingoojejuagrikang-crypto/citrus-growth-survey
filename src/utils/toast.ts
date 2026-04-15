/**
 * utils/toast.ts — 토스트 메시지 유틸리티
 *
 * 목적: 성공/오류/경고 메시지를 화면 하단에 일시적으로 표시합니다.
 */

type ToastType = 'success' | 'error' | 'warning' | 'info';

const TYPE_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const TYPE_COLORS: Record<ToastType, string> = {
  success: 'rgba(46, 125, 50, 0.95)',
  error: 'rgba(198, 40, 40, 0.95)',
  warning: 'rgba(245, 124, 0, 0.95)',
  info: 'rgba(33, 33, 33, 0.95)',
};

let activeToast: HTMLElement | null = null;
let removeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 토스트 메시지를 표시합니다.
 * 기존 토스트가 있으면 교체합니다.
 *
 * @param message 표시할 메시지
 * @param type 메시지 유형 ('success' | 'error' | 'warning' | 'info')
 * @param durationMs 표시 시간 (기본 2000ms)
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  durationMs = 2000,
): void {
  // 기존 토스트 제거
  if (activeToast) {
    activeToast.remove();
    activeToast = null;
  }
  if (removeTimer !== null) {
    clearTimeout(removeTimer);
    removeTimer = null;
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.style.background = TYPE_COLORS[type];
  toast.style.animationDuration = `200ms, 300ms`;
  toast.style.animationDelay = `0ms, ${durationMs - 300}ms`;
  toast.innerHTML = `
    <span style="font-weight:600;margin-right:6px;">${TYPE_ICONS[type]}</span>
    <span>${escapeHtml(message)}</span>
  `;

  document.body.appendChild(toast);
  activeToast = toast;

  removeTimer = setTimeout(() => {
    if (activeToast === toast) {
      toast.remove();
      activeToast = null;
    }
    removeTimer = null;
  }, durationMs);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}
