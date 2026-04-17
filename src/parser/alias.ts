/**
 * parser/alias.ts — 음성 인식 alias 사전
 *
 * 목적: STT 오인식 패턴을 정규 항목명으로 매핑합니다.
 *       v5/v6 음성 로그에서 확인된 오인식 패턴을 포함합니다.
 *
 * 사용법: FIELD_ALIASES[필드키] → alias 배열
 *        resolveAlias(text) → 정규 항목명
 */

// ─────────────────────────────────────────────
// 필드별 alias 사전
// ─────────────────────────────────────────────

/**
 * 필드 키별 음성 인식 alias 목록.
 * 로그 기반 오인식 패턴이 포함되어 있습니다:
 * - '형경', '황경', '생경', '빙빙경', '변경', '안경', '챙겨', '행경' → 횡경 (transverseDiameter)
 * - '존경', '동경', '은경', '신경', '홍경', '민경', '보경', '성경', '진경' → 종경 (longitudinalDiameter)
 * - '거실', '마실사' → 과실 (fruitNo)
 */
export const FIELD_ALIASES: Record<string, string[]> = {
  // 횡경 — 로그 확인 오인식: 형경, 황경, 생경, 빙빙경, 변경, 안경, 챙겨, 행경
  width: [
    '횡경',
    '형경',
    '황경',
    '횡 경',
    '생경',
    '빙빙경',
    '변경',
    '안경',
    '챙겨',
    '행경',
  ],

  // 종경 — 로그 확인 오인식: 존경, 동경, 은경, 신경, 홍경, 민경, 보경, 성경, 진경
  height: ['종경', '중경', '종 경', '존경', '동경', '은경', '신경', '홍경', '민경', '보경', '성경', '진경'],

  // 조사나무
  treeNo: [
    '조사나무',
    '나무',
    '나무번호',
    '조사 나무',
    '나무가',
    '나무는',
    '나무를',
    '나무번',
  ],

  // 조사과실 — 로그 확인 오인식: 거실, 마실사
  fruitNo: [
    '조사과실',
    '과실',
    '과실번호',
    '거실',
    '마실사',
    '과실이',
    '과실을',
    '과실은',
    '과실의',
    '과실번',
  ],

  // 농가명
  farmerName: ['농가', '농가명'],

  // 조사일자
  surveyDate: ['조사일자', '조사일', '날짜'],

  // 기준일자
  baseDate: ['기준일자', '기준일'],

  // 라벨
  label: ['라벨'],

  // 처리
  treatment: ['처리', '처리구'],

  // 과중
  fruitWeight: ['과중', '과일 무게', '과일무게'],

  // 과피중
  pericarpWeight: ['과피중', '껍질 무게', '껍질무게'],

  // 과피두께
  pericarpThickness: ['과피두께', '껍질두께', '과피 두께', '껍질 두께'],

  // 당도
  brix: ['당도', '브릭스', '브릭', '당'],

  // 적정산도
  titratableAcidity: ['적정', '적정산도'],

  // 산함량
  acidContent: ['산함량', '산', '산도'],

  // 착색
  coloring: ['착색'],

  // 비파괴
  nonDestructive: ['비파괴'],

  // 비고
  remark: ['비고', '메모', '노트'],
};

// ─────────────────────────────────────────────
// 역방향 매핑 (alias 텍스트 → 필드 키)
// ─────────────────────────────────────────────

/**
 * alias 텍스트 → 필드 키 역방향 매핑.
 * 빠른 조회를 위해 모듈 로드 시 1회 생성합니다.
 */
const ALIAS_TO_FIELD: Map<string, string> = new Map();

for (const [fieldKey, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_FIELD.set(alias, fieldKey);
  }
}

// ─────────────────────────────────────────────
// 함수 구현
// ─────────────────────────────────────────────

/**
 * alias 텍스트를 정규 필드 키로 변환합니다.
 * 매칭되지 않으면 원본 텍스트를 반환합니다.
 *
 * @param text 음성 인식 텍스트 (정규화 후)
 * @returns 필드 키 (예: 'width') 또는 원본 텍스트
 *
 * @example
 * resolveAlias('형경') → 'width'
 * resolveAlias('거실') → 'fruitNo'
 * resolveAlias('종경') → 'height'
 */
export function resolveAlias(text: string): string {
  return ALIAS_TO_FIELD.get(text) ?? text;
}

/**
 * 주어진 텍스트가 알려진 alias인지 확인합니다.
 *
 * @param text 확인할 텍스트
 * @returns alias에 등록된 텍스트이면 true
 */
export function isKnownAlias(text: string): boolean {
  return ALIAS_TO_FIELD.has(text);
}

/**
 * 필드 키에 해당하는 모든 alias 목록을 반환합니다.
 *
 * @param fieldKey 필드 키 (예: 'width')
 * @returns alias 배열. 없으면 빈 배열.
 */
export function getAliasesForField(fieldKey: string): string[] {
  return FIELD_ALIASES[fieldKey] ?? [];
}
