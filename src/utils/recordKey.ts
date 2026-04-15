/**
 * utils/recordKey.ts — 레코드 식별 키 생성 유틸리티
 *
 * 목적: 조사일자+농가명+라벨+처리+조사나무+조사과실 6개 필드를 결합하여
 *       결정론적(deterministic) ID와 세션 키를 생성합니다.
 */

import type { GrowthRecord } from '../types.js';

// ─────────────────────────────────────────────
// 레코드 식별에 필요한 최소 필드 타입
// ─────────────────────────────────────────────

export interface RecordKeyFields {
  surveyDate: string;
  farmerName: string;
  label: string;
  treatment: string;
  treeNo: number;
  fruitNo: number;
}

export interface SessionKeyFields {
  surveyDate: string;
  farmerName: string;
  label: string;
  treatment: string;
}

// ─────────────────────────────────────────────
// 구분자 상수
// ─────────────────────────────────────────────

const KEY_SEPARATOR = '_';

// ─────────────────────────────────────────────
// 함수 구현
// ─────────────────────────────────────────────

/**
 * 레코드 식별 키를 생성합니다.
 * 형식: "{surveyDate}_{farmerName}_{label}_{treatment}_{treeNo}_{fruitNo}"
 *
 * @param fields 레코드 식별에 필요한 6개 필드
 * @returns 결정론적 레코드 ID 문자열
 */
export function makeRecordId(fields: RecordKeyFields): string {
  const { surveyDate, farmerName, label, treatment, treeNo, fruitNo } = fields;
  return [surveyDate, farmerName, label, treatment, String(treeNo), String(fruitNo)].join(
    KEY_SEPARATOR,
  );
}

/**
 * 세션 키를 생성합니다.
 * 형식: "{surveyDate}_{farmerName}_{label}_{treatment}"
 * 세션 = 조사일자+농가명+라벨+처리의 고유 조합.
 *
 * @param fields 세션 식별에 필요한 4개 필드
 * @returns 결정론적 세션 키 문자열
 */
export function makeSessionKey(fields: SessionKeyFields): string {
  const { surveyDate, farmerName, label, treatment } = fields;
  return [surveyDate, farmerName, label, treatment].join(KEY_SEPARATOR);
}

/**
 * 두 레코드의 식별 키가 동일한지 비교합니다.
 *
 * @param a 첫 번째 레코드 식별 필드
 * @param b 두 번째 레코드 식별 필드
 * @returns 동일하면 true
 */
export function isSameRecord(a: RecordKeyFields, b: RecordKeyFields): boolean {
  return makeRecordId(a) === makeRecordId(b);
}

/**
 * GrowthRecord 또는 QualityRecord를 위한 ID와 세션 키를 생성합니다.
 * 신규 레코드 생성 시 사용합니다.
 *
 * @param fields 레코드 기본 필드
 * @returns { id, sessionKey }
 */
export function buildRecordKeys(
  fields: RecordKeyFields,
): Pick<GrowthRecord, 'id' | 'sessionKey'> {
  return {
    id: makeRecordId(fields),
    sessionKey: makeSessionKey(fields),
  };
}
