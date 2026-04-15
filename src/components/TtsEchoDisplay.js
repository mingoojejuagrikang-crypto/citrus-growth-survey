/**
 * components/TtsEchoDisplay.ts — 음성 인식 결과 크게 표시
 *
 * 목적: VoiceStore의 lastEchoText를 화면 하단에 크게 표시합니다.
 *       - 신규 입력: "횡경 35.1" 대형 텍스트 표시
 *       - 수정: "수정 횡경 36.1" (수정 강조)
 *       - 3초 후 자동 페이드 아웃
 *       - 1-tap으로 해당 FieldInputRow에 포커스 이동
 */
import { voiceStore } from '../store/index.js';
export class TtsEchoDisplay {
    el = null;
    unsubscribe = null;
    fadeTimer = null;
    removeTimer = null;
    /** 항목 포커스 요청 시 호출할 콜백 */
    onEditRequest = null;
    mount(container) {
        // VoiceStore 구독 — lastEchoText 변경 시 표시
        this.unsubscribe = voiceStore.subscribe((state) => {
            if (state.lastEchoText) {
                this.showEcho(state.lastEchoText, state.isCorrection, state.pendingField);
            }
        });
    }
    unmount() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.clearTimers();
        if (this.el) {
            this.el.remove();
            this.el = null;
        }
    }
    showEcho(text, isCorrection, pendingField) {
        // 기존 타이머 초기화
        this.clearTimers();
        // 기존 엘리먼트 제거
        if (this.el) {
            this.el.remove();
            this.el = null;
        }
        if (!text)
            return;
        // 표시 텍스트 분리 (예: "횡경 35.1" → 항목명 + 값)
        const parts = text.split(' ');
        let labelText = '';
        let valueText = text;
        if (isCorrection && parts.length >= 3 && parts[0] === '수정') {
            // "수정 횡경 35.1" 형태
            labelText = `수정 ${parts[1] ?? ''}`;
            valueText = parts.slice(2).join(' ');
        }
        else if (parts.length >= 2) {
            // "횡경 35.1" 형태
            labelText = parts[0] ?? '';
            valueText = parts.slice(1).join(' ');
        }
        this.el = document.createElement('div');
        this.el.className = 'tts-echo-display';
        this.el.setAttribute('role', 'status');
        this.el.setAttribute('aria-live', 'polite');
        this.el.setAttribute('aria-label', `인식 결과: ${text}`);
        this.el.innerHTML = `
      <div class="tts-echo-card">
        ${labelText ? `<div class="tts-echo-label${isCorrection ? ' correction' : ''}">${this.escapeHtml(labelText)}</div>` : ''}
        <div class="tts-echo-value">${this.escapeHtml(valueText)}</div>
        ${pendingField ? '<div class="tts-echo-hint">탭하여 수정</div>' : ''}
      </div>
    `;
        // 1-tap 수정 진입
        if (pendingField) {
            this.el.addEventListener('click', () => {
                if (this.onEditRequest && pendingField) {
                    this.onEditRequest(pendingField);
                }
                this.hide();
            });
        }
        document.body.appendChild(this.el);
        // 2.5초 후 페이드 아웃 시작 (3초 전에 시작)
        this.fadeTimer = setTimeout(() => {
            if (this.el) {
                this.el.classList.add('fading');
            }
        }, 2500);
        // 3초 후 완전 제거
        this.removeTimer = setTimeout(() => {
            this.hide();
        }, 3000);
    }
    hide() {
        this.clearTimers();
        if (this.el) {
            this.el.remove();
            this.el = null;
        }
    }
    clearTimers() {
        if (this.fadeTimer !== null) {
            clearTimeout(this.fadeTimer);
            this.fadeTimer = null;
        }
        if (this.removeTimer !== null) {
            clearTimeout(this.removeTimer);
            this.removeTimer = null;
        }
    }
    escapeHtml(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }
}
