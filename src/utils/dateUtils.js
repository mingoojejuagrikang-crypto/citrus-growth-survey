/**
 * utils/dateUtils.ts — 날짜 포맷 유틸리티
 *
 * 목적: 날짜 문자열 생성 및 포맷 변환 함수를 제공합니다.
 */
// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
// ─────────────────────────────────────────────
// 함수 구현
// ─────────────────────────────────────────────
/**
 * Date 객체를 'YYYY-MM-DD' 형식 문자열로 변환합니다.
 * 로컬 타임존 기준입니다.
 *
 * @param date 변환할 Date 객체
 * @returns 'YYYY-MM-DD' 형식 문자열
 */
export function toDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
/**
 * 오늘 날짜를 'YYYY-MM-DD' 형식 문자열로 반환합니다.
 * 로컬 타임존 기준입니다.
 *
 * @returns 오늘 날짜 'YYYY-MM-DD' 문자열
 */
export function todayString() {
    return toDateString(new Date());
}
/**
 * 'YYYY-MM-DD' 형식 날짜 문자열을 'MM/DD(요일)' 형식으로 변환합니다.
 * 예: '2026-04-15' → '04/15(수)'
 *
 * @param dateStr 'YYYY-MM-DD' 형식 날짜 문자열
 * @returns 'MM/DD(요일)' 형식 문자열. 유효하지 않으면 원본 반환.
 */
export function formatDisplayDate(dateStr) {
    if (!dateStr || dateStr.length < 10) {
        return dateStr;
    }
    try {
        // 로컬 타임존으로 파싱 (YYYY-MM-DD 형식은 UTC로 파싱되므로 직접 분해)
        const [year, month, day] = dateStr.split('-').map(Number);
        if (!year || !month || !day)
            return dateStr;
        const date = new Date(year, month - 1, day);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const weekday = WEEKDAY_NAMES[date.getDay()];
        return `${mm}/${dd}(${weekday})`;
    }
    catch {
        return dateStr;
    }
}
/**
 * ISO 8601 문자열을 'YYYY-MM-DD' 날짜 prefix로 추출합니다.
 * voiceLogs의 ts 필드 날짜 인덱스 생성에 사용됩니다.
 *
 * @param isoString ISO 8601 형식 문자열
 * @returns 'YYYY-MM-DD' 날짜 문자열
 */
export function extractDatePrefix(isoString) {
    return isoString.slice(0, 10);
}
/**
 * 현재 시각을 ISO 8601 형식으로 반환합니다.
 *
 * @returns ISO 8601 문자열 (예: '2026-04-15T09:30:00.000Z')
 */
export function nowIso() {
    return new Date().toISOString();
}
/**
 * 두 날짜 문자열(YYYY-MM-DD) 사이에 있는지 확인합니다.
 *
 * @param dateStr 확인할 날짜 ('YYYY-MM-DD')
 * @param from 시작 날짜 ('YYYY-MM-DD'), undefined면 무조건 통과
 * @param to 종료 날짜 ('YYYY-MM-DD'), undefined면 무조건 통과
 * @returns 범위 내이면 true
 */
export function isInDateRange(dateStr, from, to) {
    if (from !== undefined && dateStr < from)
        return false;
    if (to !== undefined && dateStr > to)
        return false;
    return true;
}
