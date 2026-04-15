/**
 * utils/deviceDetect.ts — 디바이스/환경 감지 유틸리티
 *
 * 목적: iOS/Android 환경 감지, MediaRecorder MIME 타입 체크,
 *       Web Speech API 지원 여부 확인 함수를 제공합니다.
 *
 * 참고: tech-report.md 섹션 3 (모바일 호환성) 및 섹션 7 (Gemma iOS 비활성화 패턴) 기준.
 */
// ─────────────────────────────────────────────
// MediaRecorder 지원 MIME 타입 우선순위 (iOS 우선)
// ─────────────────────────────────────────────
const AUDIO_MIME_TYPES = [
    'audio/webm;codecs=opus', // Android Chrome 우선
    'audio/mp4;codecs=mp4a.40.2', // iOS Safari
    'audio/mp4',
    'audio/aac',
];
// ─────────────────────────────────────────────
// 환경 감지 함수
// ─────────────────────────────────────────────
/**
 * 현재 환경이 iOS(iPhone/iPad/iPod 또는 iPad OS)인지 확인합니다.
 * tech-report.md 섹션 7의 패턴을 사용합니다.
 *
 * @returns iOS이면 true
 */
export function isIOS() {
    // iPad OS는 navigator.platform이 'MacIntel'이지만 maxTouchPoints > 1
    return (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
}
/**
 * 현재 환경이 Android인지 확인합니다.
 *
 * @returns Android이면 true
 */
export function isAndroid() {
    return /Android/.test(navigator.userAgent);
}
/**
 * 현재 환경에서 지원되는 오디오 MIME 타입을 반환합니다.
 * MediaRecorder.isTypeSupported()로 런타임 체크를 수행합니다.
 * tech-report.md 섹션 8의 getSupportedMimeType() 패턴 기준.
 *
 * @returns 지원되는 MIME 타입 문자열. 없으면 빈 문자열.
 */
export function getSupportedAudioMimeType() {
    if (typeof MediaRecorder === 'undefined') {
        return '';
    }
    return AUDIO_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}
/**
 * Web Speech API (SpeechRecognition)가 지원되는지 확인합니다.
 * tech-report.md 기준: window.SpeechRecognition || window.webkitSpeechRecognition
 *
 * @returns 지원되면 true
 */
export function supportsWebSpeech() {
    return ('SpeechRecognition' in window ||
        'webkitSpeechRecognition' in window);
}
/**
 * MediaRecorder API가 지원되는지 확인합니다.
 *
 * @returns 지원되면 true
 */
export function supportsMediaRecorder() {
    return typeof MediaRecorder !== 'undefined' && getSupportedAudioMimeType() !== '';
}
/**
 * 디바이스 정보 스냅샷을 반환합니다.
 * VoiceLog.device 필드에 저장됩니다.
 *
 * @returns DeviceInfo 객체
 */
export function getDeviceInfo() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        isIOS: isIOS(),
        isAndroid: isAndroid(),
    };
}
