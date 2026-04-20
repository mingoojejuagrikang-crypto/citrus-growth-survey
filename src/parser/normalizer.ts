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
const DIGIT_MAP: Record<string, number> = {
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
const UNIT_MAP: Record<string, number> = {
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
  '시',
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
] as const;

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
export function koreanToNumber(text: string): string {
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
function parseKoreanInteger(text: string): number | null {
  if (!text) return null;

  let result = 0;
  let current = 0;

  for (const char of text) {
    if (char in DIGIT_MAP) {
      current = DIGIT_MAP[char]!;
    } else if (char in UNIT_MAP) {
      const unit = UNIT_MAP[char]!;
      // "십", "백", "천" 앞에 숫자가 없으면 1로 취급 (예: "십" → 10)
      result += (current === 0 ? 1 : current) * unit;
      current = 0;
    } else {
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
export function normalizeDecimal(text: string): string {
  // "숫자/공백 + 점/쩜 + 공백/숫자" 패턴을 "숫자.숫자"로 변환
  let result = text;

  // "N 점 N" 패턴 (공백 포함)
  result = result.replace(/(\d+)\s*[점쩜]\s*(\d+)/g, '$1.$2');

  // 한국어 숫자 + "점" + 한국어 숫자 패턴
  // 예: "삼십오 점 일" → 먼저 koreanToNumber로 변환 후 처리
  result = result.replace(
    /([영일이삼사오육칠팔구십백천]+)\s*[점쩜]\s*([영일이삼사오육칠팔구십백천]+)/g,
    (_, intPart: string, fracPart: string) => {
      const intNum = parseKoreanInteger(intPart);
      const fracNum = parseKoreanInteger(fracPart);
      if (intNum !== null && fracNum !== null) {
        return `${intNum}.${fracNum}`;
      }
      return _;
    },
  );

  return result;
}

/**
 * 한국어 조사를 제거합니다.
 * "과실이" → "과실", "나무는" → "나무", "나무번호는" → "나무번호"
 *
 * @param text 조사를 제거할 텍스트 (단어 단위)
 * @returns 조사가 제거된 텍스트
 */
export function removeParticles(text: string): string {
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

/** 비정상 대형 숫자로 판단하는 임계값 (9999 초과) */
const ABNORMAL_NUMBER_THRESHOLD = 9999;

/** 앞 노이즈로 판단하는 최소 자릿수 (5자리 이상) */
const LEADING_NOISE_MIN_DIGITS = 5;

/**
 * STT 텍스트 전체 정규화 파이프라인.
 * 1. 콤마 포함 숫자 처리 (STT 오인식 천문학적 숫자 정정)
 * 2. 앞에 붙은 비정상 대형 숫자 노이즈 제거
 * 3. 소수점 표현 정규화 ("점" → ".")
 * 3-1. 숫자 앞 단독 '이' 토큰 제거 ("이 155.5" → "155.5")
 * 4. 한국어 숫자 → 아라비아 숫자
 * 5. 불필요한 공백 정리
 *
 * @param rawText STT 원본 텍스트
 * @returns 정규화된 텍스트
 */
export function normalize(rawText: string): string {
  if (!rawText) return '';

  let result = rawText.trim().toLowerCase();

  // 0. STT 오전사 고정 치환 (알려진 패턴)
  // "과시리" = STT가 "과실이"(과실+2)를 오전사하는 패턴
  // 한국어는 \b 경계가 동작하지 않으므로 공백/문자열 시작-끝 경계를 명시하여
  // "조사과시리" 같은 긴 텍스트 내에서 phantom "2" 주입을 방지
  result = result.replace(/(^|\s)과시리($|\s)/g, '$1과실 2$2');
  result = result.replace(/(^|\s)과시이($|\s)/g, '$1과실 2$2');

  // 1. 콤마 포함 숫자 처리
  //    "10,000,000,000,000,199.9" → "199.9" (비정상 대형 → 마지막 유효 소수 추출)
  //    "1,234" → "1234" (일반 천단위 구분자)
  result = result.replace(/\d{1,3}(,\d{3})+(\.\d+)?/g, (match) => {
    const parts = match.split(',');
    const lastPart = parts.at(-1) ?? match;
    const middleParts = parts.slice(1, -1);

    // STT 노이즈 패턴 판별: 중간 파트가 모두 "000"이고 마지막 파트가 유효 숫자일 때만 추출
    // 예: "10,000,000,000,000,199.9" → middle=['000','000','000','000'] → "199.9"
    // 반면 "10,199.9" → middle=[] (length 0) → 일반 천단위로 처리
    const looksLikeSttNoise =
      parts.length >= 3 &&
      middleParts.length > 0 &&
      middleParts.every((p) => p === '000') &&
      /^\d+(?:\.\d+)?$/.test(lastPart) &&
      parseFloat(lastPart) <= ABNORMAL_NUMBER_THRESHOLD;

    if (looksLikeSttNoise) return lastPart;
    return match.replace(/,/g, '');
  });

  // 2. 앞에 붙은 비정상 대형 숫자 노이즈 제거
  //    예: "1000000000004 나무 오" → "나무 오"
  //    (5자리 이상 단독 숫자가 문장 맨 앞에 있으면 제거)
  const leadingNoisePattern = new RegExp(`^\\d{${LEADING_NOISE_MIN_DIGITS},}\\s+`);
  result = result.replace(leadingNoisePattern, '');

  // 3-0. 점/쩜 전후 공백 분리 한국어 숫자 토큰 병합
  // "이백 이십 이 점 이" → "이백이십이점이" → normalizeDecimal이 222.2로 변환
  const KO_NUM_CHARS = '영일이삼사오육칠팔구십백천';
  const koNumRun = `[${KO_NUM_CHARS}]+`;
  result = result.replace(
    new RegExp(
      `(${koNumRun}(?:\\s+${koNumRun})*)\\s*[점쩜]\\s*(${koNumRun}(?:\\s+${koNumRun})*)`,
      'g'
    ),
    (_, intPart: string, fracPart: string) => {
      const intCompact = intPart.replace(/\s+/g, '');
      const fracCompact = fracPart.replace(/\s+/g, '');
      return `${intCompact}점${fracCompact}`;
    }
  );

  // 3. 소수점 표현 정규화 (한국어 숫자 + 점 패턴 먼저 처리)
  result = normalizeDecimal(result);

  // 3-1. "나무다" → "나무 4" (STT가 '사'를 '다'로 오인식하는 패턴 처리)
  //      '다' 단독 변환 시 "다른", "다음" 등 오처리 위험이 있으므로 "나무" 뒤에 한정
  result = result.replace(/나무\s*다(?=\s|$)/g, '나무 4');

  // 3-2. 숫자 앞에 붙은 단독 '이' 토큰 제거
  //      STT가 "종경 155.5"를 "존경이 155.5"로 출력하면 removeParticles 후
  //      "이 155.5" 처럼 단독 '이'가 남는 경우를 처리합니다.
  //      예: "이 155.5" → "155.5", "존경이 이 155.5" → "존경이 155.5"
  //      (※ \b는 한국어에서 동작하지 않으므로 앞 공백/문장시작 기준 매칭)
  result = result.replace(/(^|\s)이\s+(?=\d)/g, '$1');

  // 4. 남은 한국어 숫자를 아라비아 숫자로 변환
  result = koreanToNumber(result);

  // 5. 연속 공백 정리
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
export function removeParticlesFromTokens(text: string): string {
  return text
    .split(/\s+/)
    .map((token) => removeParticles(token))
    .join(' ');
}
