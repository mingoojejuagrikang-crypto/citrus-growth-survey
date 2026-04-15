/**
 * parser/normalizer.ts — 한국어 음성 인식 텍스트 정규화
 *
 * 목적: STT 원본 텍스트를 파싱 가능한 형태로 정규화합니다.
 *       - 한국어 숫자 → 아라비아 숫자 변환
 *       - "삼십오 점 일" → "35.1" (소수점 표현)
 *       - 한국어 조사 제거 ("과실이" → "과실")
 */
// ─────────────────────────────────────────────
// 한국어 숫자 매핑
// ─────────────────────────────────────────────
/** 단위 숫자 (일~구) */
const DIGIT_MAP = {
    영: 0,
    일: 1,
    이: 2,
    삼: 3,
    사: 4,
    오: 5,
    육: 6,
    칠: 7,
    팔: 8,
    구: 9,
};
/** 자릿수 단위 */
const UNIT_MAP = {
    십: 10,
    백: 100,
    천: 1000,
};
// ─────────────────────────────────────────────
// 조사 목록 (제거 대상)
// ─────────────────────────────────────────────
/** 제거할 한국어 조사 목록 (긴 것 먼저) */
const PARTICLES = [
    '번호는',
    '번호가',
    '번호를',
    '번호의',
    '이에요',
    '입니다',
    '이고요',
    '이고',
    '이에',
    '에서',
    '으로',
    '에게',
    '한테',
    '이다',
    '에요',
    '이야',
    '한데',
    '보다',
    '마다',
    '만큼',
    '처럼',
    '부터',
    '까지',
    '이랑',
    '이나',
    '이며',
    '에는',
    '에도',
    '에만',
    '에서',
    '이는',
    '이를',
    '이가',
    '이와',
    '이로',
    '이번',
    '에서는',
    '에서도',
    '으로는',
    '으로도',
    '한테서',
    '는',
    '은',
    '이',
    '가',
    '을',
    '를',
    '의',
    '와',
    '과',
    '로',
    '으',
    '도',
    '만',
    '나',
    '야',
    '아',
];
// ─────────────────────────────────────────────
// 함수 구현
// ─────────────────────────────────────────────
/**
 * 한국어 숫자 표현을 아라비아 숫자로 변환합니다.
 * 예: "삼십오" → "35", "이백십오" → "215", "일" → "1"
 * 아라비아 숫자가 이미 포함된 경우 해당 부분은 유지됩니다.
 *
 * @param text 변환할 텍스트
 * @returns 아라비아 숫자가 포함된 텍스트
 */
export function koreanToNumber(text) {
    // 이미 아라비아 숫자가 있으면 그대로 반환
    if (/\d/.test(text)) {
        return text;
    }
    // 한국어 숫자 패턴 분리하여 변환
    return text.replace(/[영일이삼사오육칠팔구십백천]+/g, (match) => {
        const num = parseKoreanInteger(match);
        return num !== null ? String(num) : match;
    });
}
/**
 * 한국어 정수 문자열을 숫자로 변환합니다.
 * 예: "삼십오" → 35, "이백십오" → 215
 *
 * @param text 한국어 숫자 문자열
 * @returns 숫자 또는 null (변환 불가 시)
 */
function parseKoreanInteger(text) {
    if (!text)
        return null;
    let result = 0;
    let current = 0;
    for (const char of text) {
        if (char in DIGIT_MAP) {
            current = DIGIT_MAP[char];
        }
        else if (char in UNIT_MAP) {
            const unit = UNIT_MAP[char];
            // "십", "백", "천" 앞에 숫자가 없으면 1로 취급 (예: "십" → 10)
            result += (current === 0 ? 1 : current) * unit;
            current = 0;
        }
        else {
            return null; // 변환 불가 문자
        }
    }
    result += current;
    return result > 0 ? result : null;
}
/**
 * 소수점 표현을 정규화합니다.
 * "삼십오 점 일" → "35.1"
 * "35 점 1" → "35.1"
 * "N점N" → "N.N"
 *
 * @param text 정규화할 텍스트
 * @returns 소수점이 '.'으로 변환된 텍스트
 */
export function normalizeDecimal(text) {
    // "숫자/공백 + 점/쩜 + 공백/숫자" 패턴을 "숫자.숫자"로 변환
    let result = text;
    // "N 점 N" 패턴 (공백 포함)
    result = result.replace(/(\d+)\s*[점쩜]\s*(\d+)/g, '$1.$2');
    // 한국어 숫자 + "점" + 한국어 숫자 패턴
    // 예: "삼십오 점 일" → 먼저 koreanToNumber로 변환 후 처리
    result = result.replace(/([영일이삼사오육칠팔구십백천]+)\s*[점쩜]\s*([영일이삼사오육칠팔구십백천]+)/g, (_, intPart, fracPart) => {
        const intNum = parseKoreanInteger(intPart);
        const fracNum = parseKoreanInteger(fracPart);
        if (intNum !== null && fracNum !== null) {
            return `${intNum}.${fracNum}`;
        }
        return _;
    });
    return result;
}
/**
 * 한국어 조사를 제거합니다.
 * "과실이" → "과실", "나무는" → "나무", "나무번호는" → "나무번호"
 *
 * @param text 조사를 제거할 텍스트 (단어 단위)
 * @returns 조사가 제거된 텍스트
 */
export function removeParticles(text) {
    let result = text.trim();
    // 긴 조사부터 순서대로 제거 (이미 정렬된 PARTICLES 배열 활용)
    for (const particle of PARTICLES) {
        if (result.endsWith(particle) && result.length > particle.length) {
            result = result.slice(0, result.length - particle.length);
            break; // 하나씩만 제거 (중첩 조사 방지)
        }
    }
    return result;
}
/**
 * STT 텍스트 전체 정규화 파이프라인.
 * 1. 소수점 표현 정규화 ("점" → ".")
 * 2. 한국어 숫자 → 아라비아 숫자
 * 3. 불필요한 공백 정리
 *
 * @param rawText STT 원본 텍스트
 * @returns 정규화된 텍스트
 */
export function normalize(rawText) {
    if (!rawText)
        return '';
    let result = rawText.trim().toLowerCase();
    // 1. 소수점 표현 정규화 (한국어 숫자 + 점 패턴 먼저 처리)
    result = normalizeDecimal(result);
    // 2. 남은 한국어 숫자를 아라비아 숫자로 변환
    result = koreanToNumber(result);
    // 3. 연속 공백 정리
    result = result.replace(/\s+/g, ' ').trim();
    return result;
}
/**
 * 토큰 단위로 조사를 제거합니다.
 * 공백으로 분리된 각 토큰에 removeParticles를 적용합니다.
 *
 * @param text 조사를 제거할 전체 텍스트
 * @returns 각 토큰에서 조사가 제거된 텍스트
 */
export function removeParticlesFromTokens(text) {
    return text
        .split(/\s+/)
        .map((token) => removeParticles(token))
        .join(' ');
}
