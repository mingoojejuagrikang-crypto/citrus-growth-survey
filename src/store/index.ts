/**
 * store/index.ts — 기반 Observable 클래스 및 스토어 re-export
 *
 * 목적: 경량 옵저버 패턴 기반 상태 관리 기반 클래스를 정의합니다.
 *       state-management.md의 설계를 구현합니다.
 */

// ─────────────────────────────────────────────
// Observable 기반 클래스 re-export
// (순환 의존성 방지를 위해 Observable.ts에서 별도 정의)
// ─────────────────────────────────────────────

export { Observable } from './Observable.js';

// ─────────────────────────────────────────────
// 스토어 싱글턴 re-export
// ─────────────────────────────────────────────

export { appStore } from './AppStore.js';
export { surveyStore } from './SurveyStore.js';
export { voiceStore } from './VoiceStore.js';
export { syncStore } from './SyncStore.js';
