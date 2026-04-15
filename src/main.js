/**
 * main.ts — 앱 진입점
 *
 * 목적: IndexedDB 초기화 → 설정 로드 → Store 초기화 → 라우터 마운트 → SW 등록
 *       state-management.md의 bootstrap() 패턴을 구현합니다.
 *
 * 라우팅:
 * - #/settings         → SettingsPage
 * - #/survey/growth    → SurveyInputPage(growth)
 * - #/survey/quality   → SurveyInputPage(quality)
 * - #/records          → RecordListPage
 * - #/voicelogs        → VoiceLogPage
 * - 기본 경로           → #/survey/growth
 */
import './styles/global.css';
import './styles/mobile.css';
import './styles/components.css';
import { initDB } from './db/index.js';
import { appStore, syncStore, surveyStore } from './store/index.js';
import { getDefaults } from './services/SettingsService.js';
import { getPendingCount } from './services/IndexedDBService.js';
import { TabBar } from './components/TabBar.js';
import { OfflineBanner } from './components/OfflineBanner.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { SurveyInputPage } from './pages/SurveyInputPage.js';
import { RecordListPage } from './pages/RecordListPage.js';
import { VoiceLogPage } from './pages/VoiceLogPage.js';
let currentPage = null;
let pageContainer = null;
/**
 * 현재 해시 경로에 맞는 페이지를 마운트합니다.
 * 이전 페이지는 언마운트합니다.
 */
async function route(hash) {
    if (!pageContainer)
        return;
    // 이전 페이지 언마운트
    if (currentPage) {
        currentPage.unmount();
        currentPage = null;
    }
    // 페이지 컨테이너 초기화
    pageContainer.innerHTML = '';
    // 해시 기반 라우팅
    let page;
    if (hash.startsWith('#/settings')) {
        const p = new SettingsPage();
        await p.mount(pageContainer);
        page = p;
    }
    else if (hash.startsWith('#/survey/quality')) {
        const p = new SurveyInputPage('quality');
        await p.mount(pageContainer);
        page = p;
    }
    else if (hash.startsWith('#/survey/growth') || hash === '#/survey' || hash === '') {
        const p = new SurveyInputPage('growth');
        await p.mount(pageContainer);
        page = p;
    }
    else if (hash.startsWith('#/records')) {
        const p = new RecordListPage();
        await p.mount(pageContainer);
        page = p;
    }
    else if (hash.startsWith('#/voicelogs')) {
        const p = new VoiceLogPage();
        p.mount(pageContainer);
        page = p;
    }
    else {
        // 알 수 없는 경로 → 기본 경로로 리다이렉트
        window.location.hash = '#/survey/growth';
        return;
    }
    currentPage = page;
}
// ─────────────────────────────────────────────
// 부트스트랩
// ─────────────────────────────────────────────
async function bootstrap() {
    const appEl = document.getElementById('app');
    if (!appEl) {
        console.error('[main] #app 요소를 찾을 수 없습니다.');
        return;
    }
    try {
        // 1. IndexedDB 초기화
        await initDB();
        // 2. 설정 로드 → SurveyStore 세션 필드 초기화
        const defaults = await getDefaults();
        surveyStore.updateSessionFields({
            farmerName: defaults.defaultFarmerName,
            label: defaults.defaultLabel,
            treatment: defaults.defaultTreatment,
        });
        // 3. 미동기화 건수 초기화
        const pendingCount = await getPendingCount();
        syncStore.setPendingCount(pendingCount);
        // 4. 네트워크 이벤트 등록
        window.addEventListener('online', () => {
            appStore.setNetworkStatus('online');
        });
        window.addEventListener('offline', () => {
            appStore.setNetworkStatus('offline');
        });
        // 5. 해시 라우터 이벤트 등록
        window.addEventListener('hashchange', () => {
            const hash = location.hash || '#/survey/growth';
            appStore.navigate(hash);
            route(hash);
        });
        // 6. 로딩 화면 제거
        const loadingEl = document.getElementById('loading');
        if (loadingEl)
            loadingEl.remove();
        // 7. 앱 레이아웃 구조 생성
        appEl.innerHTML = '';
        // 오프라인 배너
        const offlineBanner = new OfflineBanner();
        offlineBanner.mount(appEl);
        // 페이지 컨테이너
        pageContainer = document.createElement('div');
        pageContainer.id = 'page-container';
        pageContainer.style.cssText = `
      min-height: 100vh;
      padding-bottom: calc(var(--tab-bar-height) + env(safe-area-inset-bottom));
    `;
        appEl.appendChild(pageContainer);
        // 하단 탭바
        const tabBar = new TabBar();
        tabBar.mount(appEl);
        // 8. 초기 라우트 처리
        const initialHash = location.hash || '#/survey/growth';
        if (!location.hash) {
            window.location.hash = '#/survey/growth';
        }
        else {
            appStore.navigate(initialHash);
            await route(initialHash);
        }
        // 9. 초기화 완료 알림
        appStore.setInitialized();
        // 10. Service Worker 등록 (프로덕션 환경에서만)
        if ('serviceWorker' in navigator && import.meta.env.PROD) {
            try {
                const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
                if (import.meta.env.DEV) {
                    console.info('[SW] 등록 성공:', reg.scope);
                }
            }
            catch (swErr) {
                if (import.meta.env.DEV) {
                    console.warn('[SW] 등록 실패:', swErr);
                }
            }
        }
    }
    catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[main] 앱 초기화 실패:', errMsg);
        const appDiv = document.getElementById('app');
        if (appDiv) {
            appDiv.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: sans-serif;
          color: #c62828;
          padding: 24px;
          text-align: center;
          gap: 16px;
        ">
          <div style="font-size: 48px;">⚠️</div>
          <div style="font-size: 18px; font-weight: 600;">앱 초기화에 실패했습니다</div>
          <div style="font-size: 14px; color: #757575;">${errMsg}</div>
          <button onclick="location.reload()" style="
            height: 44px;
            padding: 0 24px;
            background: #2e7d32;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 8px;
          ">
            새로고침
          </button>
        </div>
      `;
        }
    }
}
bootstrap();
