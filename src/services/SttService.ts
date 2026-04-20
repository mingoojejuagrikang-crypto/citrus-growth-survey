/**
 * services/SttService.ts — Web Speech API 기반 STT 서비스
 *
 * 목적: 항상-ON 마이크 루프를 유지하며 음성 인식 결과를 콜백으로 전달합니다.
 *       iOS Safari 호환을 위해 continuous 설정을 UA로 분기하고,
 *       onend/onerror 발생 시 자동 재시작 패턴을 구현합니다.
 *
 * 주요 iOS 대응:
 *   - continuous: iOS는 false, 그 외는 true
 *   - 각 onresult(isFinal) 수신 후 abort() → setTimeout → start() 재시작
 *   - echoCancellation: true 마이크 스트림 캐싱 (한 번만 획득)
 *
 * 재발 방지 (ERR-DEPLOY-001):
 *   - 이 파일에서 클래스를 정의하고 배럴 index에는 re-export만 수행
 */

import type { SttResultEvent, SttState } from '../types.js';

// ─────────────────────────────────────────────
// Web Speech API 타입 선언 (TypeScript lib에 미포함 대응)
// ─────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  onspeechstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

/** 인식 언어 기본값 */
const DEFAULT_LANG = 'ko-KR';

/** onend 후 재시작 대기 시간 (ms) */
const RESTART_DELAY_MS = 300;

/** iOS Safari UA 판별 정규식 */
const IOS_UA_REGEX = /iPad|iPhone|iPod/;

// ─────────────────────────────────────────────
// 내부 유틸리티
// ─────────────────────────────────────────────

/**
 * 현재 기기가 iOS인지 확인합니다.
 * iPadOS 13+의 데스크톱 UA 우회를 maxTouchPoints로 보조 감지합니다.
 *
 * @returns iOS이면 true
 */
function isIOS(): boolean {
  return (
    IOS_UA_REGEX.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * iOS 홈화면에 설치된 PWA(standalone 모드)인지 확인합니다.
 * iOS standalone 모드에서는 SpeechRecognition API가 동작하지 않습니다.
 * (WebKit 버그 225298)
 *
 * @returns iOS standalone 모드이면 true
 */
function isIOSStandalone(): boolean {
  return isIOS() && (window.navigator as unknown as Record<string, unknown>)['standalone'] === true;
}

/**
 * SpeechRecognition 생성자를 반환합니다.
 * 브라우저 호환성을 위해 표준 및 webkit prefix 모두 시도합니다.
 *
 * @returns SpeechRecognition 생성자 또는 null
 */
function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as Record<string, unknown>;
  return (
    (w['SpeechRecognition'] as SpeechRecognitionCtor | undefined) ??
    (w['webkitSpeechRecognition'] as SpeechRecognitionCtor | undefined) ??
    null
  );
}

// ─────────────────────────────────────────────
// SttService 클래스
// ─────────────────────────────────────────────

/**
 * Web Speech API 기반 STT 서비스.
 * start()를 호출하면 항상-ON 마이크 루프가 시작됩니다.
 * stop()을 호출할 때까지 자동으로 재시작됩니다.
 */
export class SttService {
  // ── 공개 콜백 ──

  /** 최종 인식 결과(isFinal=true) 콜백 */
  onResult: ((event: SttResultEvent) => void) | null = null;

  /** 중간 인식 결과(isFinal=false) 콜백 */
  onInterim: ((text: string) => void) | null = null;

  /** STT 상태 변화 콜백 */
  onStateChange: ((state: SttState) => void) | null = null;

  /** 에러 메시지 콜백 */
  onError: ((msg: string) => void) | null = null;

  /** 발화 시작(speechstart) 콜백 */
  onSpeechStart: (() => void) | null = null;

  // ── 내부 상태 ──

  private _isRunning = false;
  private _recognition: SpeechRecognitionInstance | null = null;
  private _cachedStream: MediaStream | null = null;
  private _restartTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly _lang: string;
  private readonly _isIOS: boolean;

  /**
   * @param options.lang 인식 언어 (기본 'ko-KR')
   */
  constructor(options: { lang?: string } = {}) {
    this._lang = options.lang ?? DEFAULT_LANG;
    this._isIOS = isIOS();
  }

  // ── 공개 getter ──

  /** 현재 STT 루프가 실행 중이면 true */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /** 캐시된 마이크 스트림 (MediaRecorder 재사용용) */
  get stream(): MediaStream | null {
    return this._cachedStream;
  }

  /**
   * iOS 홈화면 PWA(standalone 모드) 여부를 반환합니다.
   * SurveyInputPage 등에서 페이지 init 시 미리 경고를 표시하는 데 사용됩니다.
   *
   * @returns iOS standalone 모드이면 true
   */
  get isIOSStandaloneMode(): boolean {
    return isIOSStandalone();
  }

  // ── 공개 메서드 ──

  /**
   * 마이크 권한을 획득하고 항상-ON STT 루프를 시작합니다.
   * 이미 실행 중이면 아무 작업도 하지 않습니다.
   * iOS 홈화면 PWA(standalone 모드)에서는 SpeechRecognition이 동작하지 않으므로
   * 즉시 'ios-standalone' 에러 코드를 emitError하고 반환합니다.
   */
  start(): void {
    if (isIOSStandalone()) {
      this._emitError('ios-standalone');
      return;
    }

    if (this._isRunning) return;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      this._emitError('STT를 지원하지 않는 브라우저입니다');
      return;
    }

    this._isRunning = true;
    this._emitState('listening');

    // 마이크 권한 획득 → STT 시작
    this._ensureStream()
      .then(() => {
        this._startRecognition();
      })
      .catch((err: unknown) => {
        this._isRunning = false;
        this._emitState('idle');
        const msg = err instanceof Error ? err.message : String(err);
        this._emitError(`마이크 권한 획득 실패: ${msg}`);
      });
  }

  /**
   * STT 루프를 완전히 정지합니다.
   * 재시작 타이머도 취소합니다.
   */
  stop(): void {
    this._isRunning = false;
    this._clearRestartTimer();

    if (this._recognition) {
      try {
        this._recognition.abort();
      } catch {
        // 이미 중단된 경우 무시
      }
      this._recognition = null;
    }

    this._emitState('idle');
  }

  /**
   * 현재 인식 세션을 abort하고 즉시 재시작합니다.
   * 실행 중이 아니면 start()를 호출합니다.
   */
  restart(): void {
    if (!this._isRunning) {
      this.start();
      return;
    }

    this._clearRestartTimer();

    if (this._recognition) {
      try {
        this._recognition.abort();
      } catch {
        // 무시
      }
    }

    this._scheduleRestart();
  }

  // ── 내부 메서드 ──

  /**
   * echoCancellation:true 마이크 스트림을 획득합니다.
   * 이미 캐시된 스트림이 있으면 재사용합니다.
   *
   * @returns MediaStream Promise
   */
  private async _ensureStream(): Promise<MediaStream> {
    if (this._cachedStream) return this._cachedStream;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true },
    });
    this._cachedStream = stream;
    return stream;
  }

  /**
   * SpeechRecognition 인스턴스를 생성하고 이벤트를 바인딩한 뒤 시작합니다.
   */
  private _startRecognition(): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !this._isRunning) return;

    const rec: SpeechRecognitionInstance = new Ctor();
    rec.lang = this._lang;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    // iOS는 continuous:false로 설정하여 각 발화 후 재시작 패턴 적용
    rec.continuous = this._isIOS ? false : true;

    // Chrome 139+ on-device path (processLocally)
    if ('processLocally' in rec) {
      try { (rec as any).processLocally = true; } catch (_) {} // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    // Chrome 142+ contextual biasing (감귤 도메인 용어 우선순위 부여)
    // 구버전 Chrome/Safari에서는 'phrases' in rec 조건이 false → 무해하게 건너뜀
    const SpeechRecognitionPhrase = (window as any).SpeechRecognitionPhrase; // eslint-disable-line @typescript-eslint/no-explicit-any
    if ('phrases' in rec && SpeechRecognitionPhrase) {
      (rec as any).phrases = [ // eslint-disable-line @typescript-eslint/no-explicit-any
        new SpeechRecognitionPhrase('횡경', 9.0),
        new SpeechRecognitionPhrase('종경', 9.0),
        new SpeechRecognitionPhrase('조사나무', 9.0),
        new SpeechRecognitionPhrase('조사과실', 9.0),
        new SpeechRecognitionPhrase('과피두께', 8.0),
        new SpeechRecognitionPhrase('당도', 8.0),
        new SpeechRecognitionPhrase('산함량', 8.0),
        new SpeechRecognitionPhrase('과중', 7.0),
        new SpeechRecognitionPhrase('착색', 7.0),
        new SpeechRecognitionPhrase('비파괴', 7.0),
        new SpeechRecognitionPhrase('비고', 6.0),
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      this._handleResult(event);
    };

    rec.onspeechstart = () => {
      this.onSpeechStart?.();
    };

    rec.onend = () => {
      if (this._isRunning) {
        this._scheduleRestart();
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (event: any) => {
      this._handleError(event);
    };

    this._recognition = rec;

    try {
      rec.start();
    } catch (err) {
      // 이미 실행 중인 경우 등 무시 가능한 오류
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[SttService] recognition.start() 오류:', msg);
    }
  }

  /**
   * onresult 이벤트를 처리합니다.
   * isFinal이면 onResult 콜백, 아니면 onInterim 콜백을 호출합니다.
   * iOS 재시작 패턴: isFinal 수신 시 즉시 abort() 후 재시작.
   *
   * @param event SpeechRecognitionEvent
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handleResult(event: any): void {
    const resultList = event.results;
    const lastResult = resultList[resultList.length - 1];
    if (!lastResult) return;

    const isFinal = lastResult.isFinal;
    const transcript = lastResult[0]?.transcript ?? '';
    const confidence = lastResult[0]?.confidence ?? 0;

    if (isFinal) {
      // alternatives 수집
      const alternatives: string[] = [];
      for (let i = 0; i < lastResult.length; i++) {
        const alt = lastResult[i]?.transcript;
        if (alt) alternatives.push(alt);
      }

      const resultEvent: SttResultEvent = {
        transcript,
        isFinal: true,
        alternatives,
        confidence,
      };

      this.onResult?.(resultEvent);
      this._emitState('processing');

      // iOS 재시작 패턴: isFinal 수신 후 abort → start
      if (this._isIOS && this._isRunning) {
        this._clearRestartTimer();
        try {
          this._recognition?.abort();
        } catch {
          // 무시
        }
        this._scheduleRestart();
      }
    } else {
      this.onInterim?.(transcript);
      this._emitState('listening');
    }
  }

  /**
   * onerror 이벤트를 처리합니다.
   * 'not-allowed' 에러는 stop() 후 onError를 호출합니다.
   * 나머지는 재시작을 시도합니다.
   *
   * @param event SpeechRecognitionErrorEvent
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handleError(event: any): void {
    const code: string = event.error ?? '';

    if (code === 'not-allowed') {
      this.stop();
      this._emitError('마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해주세요.');
      return;
    }

    // 'aborted'는 내부적으로 abort() 호출 시 발생 — 재시작 불필요 (onend에서 처리)
    if (code === 'aborted') return;

    // 그 외 오류: 재시작 시도
    if (this._isRunning) {
      this._scheduleRestart();
    }
  }

  /**
   * RESTART_DELAY_MS 후 재시작을 예약합니다.
   */
  private _scheduleRestart(): void {
    this._clearRestartTimer();
    this._restartTimer = setTimeout(() => {
      if (this._isRunning) {
        this._startRecognition();
      }
    }, RESTART_DELAY_MS);
  }

  /**
   * 대기 중인 재시작 타이머를 취소합니다.
   */
  private _clearRestartTimer(): void {
    if (this._restartTimer !== null) {
      clearTimeout(this._restartTimer);
      this._restartTimer = null;
    }
  }

  /**
   * onStateChange 콜백을 호출합니다.
   *
   * @param state 새 STT 상태
   */
  private _emitState(state: SttState): void {
    this.onStateChange?.(state);
  }

  /**
   * onError 콜백을 호출합니다.
   *
   * @param msg 에러 메시지
   */
  private _emitError(msg: string): void {
    this.onError?.(msg);
  }
}
