/**
 * services/TtsService.ts — Web Speech Synthesis API 기반 TTS 서비스
 *
 * 목적: 텍스트를 음성으로 출력합니다. 새 발화 요청 시 이전 발화를 즉시 취소합니다.
 *
 * iOS Safari 버그 대응:
 *   - speak() 전 speechSynthesis.cancel() 호출 후 50ms 대기
 *   - 이를 통해 iOS에서 이전 발화가 중단되지 않고 겹치는 현상 방지
 *
 * 재발 방지 (ERR-DEPLOY-001):
 *   - 이 파일에서 클래스를 정의하고 배럴 index에는 re-export만 수행
 */

import type { TtsOptions } from '../types.js';

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

/** TTS 언어 기본값 */
const DEFAULT_LANG = 'ko-KR';

/** iOS Safari speak() 전 cancel 후 대기 시간 (ms) */
const IOS_CANCEL_DELAY_MS = 50;

/** iOS Safari UA 판별 정규식 */
const IOS_UA_REGEX = /iPad|iPhone|iPod/;

// ─────────────────────────────────────────────
// 내부 유틸리티
// ─────────────────────────────────────────────

/**
 * 현재 기기가 iOS인지 확인합니다.
 *
 * @returns iOS이면 true
 */
function isIOS(): boolean {
  return (
    IOS_UA_REGEX.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

// ─────────────────────────────────────────────
// TtsService 클래스
// ─────────────────────────────────────────────

/**
 * Web Speech Synthesis API 기반 TTS 서비스.
 * speak() 호출 시 이전 발화를 취소하고 새 발화를 시작합니다.
 */
export class TtsService {
  // ── 공개 콜백 ──

  /** 발화 시작(onstart) 콜백 */
  onStart: (() => void) | null = null;

  /** 발화 완료(onend) 콜백 */
  onEnd: (() => void) | null = null;

  // ── 내부 상태 ──

  private _isSpeaking = false;
  private _isUnlocked = false;
  private readonly _isSupported: boolean;
  private readonly _isIOS: boolean;

  constructor() {
    this._isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this._isIOS = isIOS();
  }

  // ── 공개 getter ──

  /** 현재 발화 중이면 true */
  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  /** SpeechSynthesis API 지원 여부 */
  get isSupported(): boolean {
    return this._isSupported;
  }

  // ── 공개 메서드 ──

  /**
   * 사용자 제스처 핸들러 내에서 동기적으로 오디오 컨텍스트를 언락합니다.
   * iOS에서 첫 speak()가 setTimeout 내부에서 실행되면 무음 처리되므로
   * 탭 이벤트 직후 이 메서드를 먼저 호출해야 합니다.
   */
  unlock(): void {
    if (!this._isSupported || this._isUnlocked) return;
    try {
      const utt = new SpeechSynthesisUtterance('');
      utt.volume = 0;
      window.speechSynthesis.speak(utt);
      window.speechSynthesis.cancel();
      this._isUnlocked = true;
    } catch {
      // 무시
    }
  }

  /**
   * 텍스트를 음성으로 출력합니다.
   * 이전 발화가 있으면 취소 후 새 발화를 시작합니다.
   * 빈 문자열이면 아무 작업도 하지 않습니다.
   *
   * @param text 발화할 텍스트
   * @param options TTS 옵션 (rate, pitch, volume, lang)
   */
  speak(text: string, options?: TtsOptions): void {
    if (!this._isSupported) return;
    if (!text.trim()) return;

    // 이전 발화 취소
    window.speechSynthesis.cancel();

    if (this._isIOS) {
      // iOS Safari: cancel() 후 즉시 speak()하면 발화가 시작 안 되는 버그 대응
      setTimeout(() => {
        this._doSpeak(text, options);
      }, IOS_CANCEL_DELAY_MS);
    } else {
      this._doSpeak(text, options);
    }
  }

  /**
   * 현재 발화를 즉시 취소합니다.
   */
  cancel(): void {
    if (!this._isSupported) return;
    window.speechSynthesis.cancel();
    this._isSpeaking = false;
  }

  // ── 내부 메서드 ──

  /**
   * SpeechSynthesisUtterance를 생성하고 발화를 시작합니다.
   *
   * @param text 발화할 텍스트
   * @param options TTS 옵션
   */
  private _doSpeak(text: string, options?: TtsOptions): void {
    const utt = new SpeechSynthesisUtterance(text);

    utt.lang = options?.lang ?? DEFAULT_LANG;
    if (options?.rate !== undefined) utt.rate = options.rate;
    if (options?.pitch !== undefined) utt.pitch = options.pitch;
    if (options?.volume !== undefined) utt.volume = options.volume;

    utt.onstart = () => {
      this._isSpeaking = true;
      this.onStart?.();
    };

    utt.onend = () => {
      this._isSpeaking = false;
      this.onEnd?.();
    };

    utt.onerror = () => {
      this._isSpeaking = false;
      this.onEnd?.();
    };

    window.speechSynthesis.speak(utt);
  }
}
