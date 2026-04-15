/**
 * store/AppStore.ts — 앱 전역 상태 스토어
 *
 * 목적: 현재 페이지, 네트워크 상태, SW 업데이트 여부를 관리합니다.
 *       state-management.md의 AppStore 설계를 구현합니다.
 */
import { Observable } from './index.js';
// ─────────────────────────────────────────────
// 초기 상태
// ─────────────────────────────────────────────
const initialAppState = {
    currentPage: '#/settings',
    networkStatus: navigator.onLine ? 'online' : 'offline',
    hasSwUpdate: false,
    isInitialized: false,
};
// ─────────────────────────────────────────────
// AppStore 클래스
// ─────────────────────────────────────────────
class AppStore extends Observable {
    constructor() {
        super(initialAppState);
    }
    /**
     * 현재 페이지를 업데이트합니다.
     * hashchange 이벤트에서 호출됩니다.
     *
     * @param page 해시 경로 (예: '#/survey/growth')
     */
    navigate(page) {
        this.setState({ currentPage: page });
    }
    /**
     * 네트워크 상태를 업데이트합니다.
     * online/offline 이벤트 리스너에서 호출됩니다.
     *
     * @param status 'online' | 'offline'
     */
    setNetworkStatus(status) {
        this.setState({ networkStatus: status });
    }
    /**
     * Service Worker 업데이트 대기 여부를 설정합니다.
     * workbox waiting 이벤트에서 호출됩니다.
     *
     * @param has 업데이트 대기 중이면 true
     */
    setSwUpdate(has) {
        this.setState({ hasSwUpdate: has });
    }
    /**
     * DB 초기화 완료를 알립니다.
     * main.ts의 bootstrap() 완료 후 호출됩니다.
     */
    setInitialized() {
        this.setState({ isInitialized: true });
    }
}
// ─────────────────────────────────────────────
// 싱글턴 인스턴스
// ─────────────────────────────────────────────
export const appStore = new AppStore();
