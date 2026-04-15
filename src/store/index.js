/**
 * store/index.ts — 기반 Observable 클래스 및 스토어 re-export
 *
 * 목적: 경량 옵저버 패턴 기반 상태 관리 기반 클래스를 정의합니다.
 *       state-management.md의 설계를 구현합니다.
 */
/**
 * 경량 옵저버 패턴 기반 상태 관리 클래스.
 * 컴포넌트는 subscribe()로 구독하고, 상태 변경 시 자동 알림을 받습니다.
 *
 * 사용 패턴:
 * - mount() 시 subscribe() 호출
 * - unmount() 시 반환된 unsubscribe 함수 호출 (메모리 누수 방지)
 */
export class Observable {
    state;
    listeners = new Set();
    constructor(initialState) {
        this.state = initialState;
    }
    /**
     * 현재 상태의 불변(frozen) 복사본을 반환합니다.
     * 직접 수정을 방지합니다.
     *
     * @returns Readonly<T>
     */
    getState() {
        return Object.freeze({ ...this.state });
    }
    /**
     * 상태를 부분 업데이트하고 모든 구독자에게 알립니다.
     * 서브클래스에서만 호출 가능합니다.
     *
     * @param partial 업데이트할 상태 일부
     */
    setState(partial) {
        this.state = { ...this.state, ...partial };
        const frozenState = this.getState();
        this.listeners.forEach((fn) => fn(frozenState));
    }
    /**
     * 상태 변경 구독자를 등록합니다.
     * 등록 즉시 현재 상태로 한 번 호출됩니다.
     *
     * @param fn 상태 변경 시 호출할 콜백
     * @returns unsubscribe 함수 (mount/unmount 시 호출)
     */
    subscribe(fn) {
        this.listeners.add(fn);
        fn(this.getState()); // 즉시 현재 상태로 초기 호출
        return () => this.listeners.delete(fn);
    }
}
// ─────────────────────────────────────────────
// 스토어 싱글턴 re-export
// ─────────────────────────────────────────────
export { appStore } from './AppStore.js';
export { surveyStore } from './SurveyStore.js';
export { voiceStore } from './VoiceStore.js';
export { syncStore } from './SyncStore.js';
