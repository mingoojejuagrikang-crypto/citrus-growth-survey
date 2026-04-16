/**
 * services/MediaRecorderService.ts — MediaRecorder 기반 오디오 녹음 서비스
 *
 * 목적: 발화 구간 오디오를 녹음하여 AudioBlob으로 반환합니다.
 *       audioRecordEnabled 설정이 true일 때만 사용합니다.
 *
 * 포맷 선택:
 *   - Android Chrome: audio/webm;codecs=opus (우선)
 *   - iOS Safari: audio/mp4;codecs=mp4a.40.2 폴백
 *   - MediaRecorder.isTypeSupported()로 런타임 결정
 *
 * 재발 방지 (ERR-DEPLOY-001):
 *   - 이 파일에서 클래스를 정의하고 배럴 index에는 re-export만 수행
 */

import type { AudioBlob } from '../types.js';

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

/** 지원 여부를 순서대로 검사할 MIME 타입 목록 */
const PREFERRED_MIME_TYPES: readonly string[] = [
  'audio/webm;codecs=opus',      // Android Chrome 우선
  'audio/mp4;codecs=mp4a.40.2',  // iOS Safari
  'audio/mp4',
  'audio/aac',
];

// ─────────────────────────────────────────────
// 내부 유틸리티
// ─────────────────────────────────────────────

/**
 * 브라우저가 지원하는 첫 번째 MIME 타입을 반환합니다.
 *
 * @returns 지원되는 MIME 타입 문자열 또는 빈 문자열
 */
function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  return PREFERRED_MIME_TYPES.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
}

// ─────────────────────────────────────────────
// MediaRecorderService 클래스
// ─────────────────────────────────────────────

/**
 * MediaRecorder 기반 오디오 녹음 서비스.
 * startRecording()으로 녹음을 시작하고, stopRecording()으로 AudioBlob을 받습니다.
 */
export class MediaRecorderService {
  // ── 내부 상태 ──

  private _mediaRecorder: MediaRecorder | null = null;
  private _chunks: Blob[] = [];
  private _startTime = 0;
  private _isRecording = false;
  private _resolveStop: ((blob: AudioBlob) => void) | null = null;
  private _rejectStop: ((err: Error) => void) | null = null;

  // ── 정적 메서드 ──

  /**
   * 현재 브라우저에서 MediaRecorder와 지원 MIME 타입 사용이 가능한지 확인합니다.
   *
   * @returns 지원되면 true
   */
  static isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' && getSupportedMimeType() !== '';
  }

  // ── 공개 getter ──

  /** 현재 녹음 중이면 true */
  get isRecording(): boolean {
    return this._isRecording;
  }

  // ── 공개 메서드 ──

  /**
   * 녹음을 시작합니다.
   * 이미 녹음 중이면 이전 세션을 중단하고 새로 시작합니다.
   *
   * @param stream 마이크 MediaStream (SttService._cachedStream 재사용 권장)
   */
  startRecording(stream: MediaStream): void {
    if (!MediaRecorderService.isSupported()) {
      console.warn('[MediaRecorderService] 이 브라우저는 녹음을 지원하지 않습니다.');
      return;
    }

    // 이미 녹음 중이면 기존 세션 중단
    if (this._isRecording && this._mediaRecorder) {
      try {
        this._mediaRecorder.stop();
      } catch {
        // 무시
      }
    }

    const mimeType = getSupportedMimeType();
    this._chunks = [];
    this._startTime = Date.now();

    try {
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this._chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const durationMs = Date.now() - this._startTime;
        const blob = new Blob(this._chunks, { type: mimeType || 'audio/mp4' });
        const audioBlob: AudioBlob = { blob, mimeType: mimeType || 'audio/mp4', durationMs };

        this._isRecording = false;
        this._chunks = [];

        this._resolveStop?.(audioBlob);
        this._resolveStop = null;
        this._rejectStop = null;
      };

      recorder.onerror = () => {
        this._isRecording = false;
        this._rejectStop?.(new Error('MediaRecorder 오류가 발생했습니다.'));
        this._resolveStop = null;
        this._rejectStop = null;
      };

      this._mediaRecorder = recorder;
      this._isRecording = true;
      recorder.start();
    } catch (err) {
      this._isRecording = false;
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[MediaRecorderService] startRecording 오류:', msg);
    }
  }

  /**
   * 녹음을 중지하고 AudioBlob을 반환합니다.
   * startRecording()이 호출되지 않은 상태에서 호출하면 reject됩니다.
   *
   * @returns AudioBlob Promise (blob, mimeType, durationMs)
   */
  stopRecording(): Promise<AudioBlob> {
    return new Promise<AudioBlob>((resolve, reject) => {
      if (!this._isRecording || !this._mediaRecorder) {
        reject(new Error('녹음이 시작되지 않았습니다.'));
        return;
      }

      this._resolveStop = resolve;
      this._rejectStop = reject;

      try {
        this._mediaRecorder.stop();
      } catch (err) {
        this._isRecording = false;
        this._resolveStop = null;
        this._rejectStop = null;
        const msg = err instanceof Error ? err.message : String(err);
        reject(new Error(`녹음 중지 실패: ${msg}`));
      }
    });
  }
}
