/**
 * utils/formatFieldValue.ts — 필드 값 포맷 유틸
 *
 * 목적: 필드 키와 숫자값을 받아 해당 필드의 데이터 타입에 맞는
 *       표시 문자열(UI 및 TTS용)로 변환합니다.
 */

import { FIELD_DATA_TYPES } from '../types.js';

/**
 * 필드 키와 숫자값을 받아 해당 필드의 데이터 타입에 맞는 표시 문자열로 변환합니다.
 * 예: width, 200 → "200.0" (decimal places:1)
 *     treeNo, 3 → "3" (integer)
 *     titratableAcidity, 1.2 → "1.20" (decimal places:2)
 *
 * @param fieldKey 필드 키 (예: 'width', 'treeNo')
 * @param value 숫자값
 * @returns 포맷된 문자열
 */
export function formatFieldValue(fieldKey: string, value: number): string {
  const dataType = FIELD_DATA_TYPES[fieldKey];
  if (!dataType) return String(value);

  switch (dataType.type) {
    case 'integer':
      return String(Math.round(value));
    case 'decimal':
      return value.toFixed(dataType.places);
    case 'text':
      return String(value);
    default:
      return String(value);
  }
}

/**
 * 필드 키에 따른 TTS 읽기용 문자열을 반환합니다.
 * 예: "200.0" → "200.0", "3" → "3"
 * (SpeechSynthesis의 ko-KR이 소수점을 직접 읽으므로 별도 변환 불필요)
 *
 * @param fieldKey 필드 키 (예: 'width', 'treeNo')
 * @param value 숫자값
 * @returns TTS용 포맷된 문자열
 */
export function formatFieldValueForTts(fieldKey: string, value: number): string {
  return formatFieldValue(fieldKey, value);
}
