/**
 * parser/parser.ts — STT 결과 텍스트 파서
 *
 * 목적: 음성 인식 원본 텍스트에서 항목명과 값을 추출합니다.
 *
 * 파싱 로직:
 * 1. normalize(rawText)로 텍스트 정규화
 * 2. 9999 초과 숫자 → warning
 * 3. 알려진 항목명 없이 숫자만 → isCorrection: true, field = lastField
 * 4. alias 사전으로 필드 매칭 (matchScore 계산)
 * 5. 값 추출 (숫자/텍스트)
 *
 * @param rawText STT 원본 텍스트
 * @param context ParserContext (lastField, surveyType, activeFields)
 * @returns ParseResult
 */

import type { ParseResult, ParserContext } from '../types.js';
import { normalize, removeParticles } from './normalizer.js';
import { resolveAlias, isKnownAlias, FIELD_ALIASES } from './alias.js';

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

/** 음성 오인식 방지 숫자 임계값 */
const OVERFLOW_THRESHOLD = 9999;

/** alias 매칭 시 점수 */
const SCORE_EXACT = 1.0;
const SCORE_ALIAS = 0.9;
const SCORE_NORMALIZED = 0.7;
const SCORE_VALUE_ONLY = 0.5;
const SCORE_UNKNOWN = 0.0;

// ─────────────────────────────────────────────
// 내부 유틸리티
// ─────────────────────────────────────────────

/**
 * 텍스트에서 숫자를 추출합니다.
 * 소수점 포함 숫자를 추출합니다.
 *
 * @param text 정규화된 텍스트
 * @returns 추출된 숫자 문자열 또는 null
 */
function extractNumber(text: string): string | null {
  const match = text.match(/\d+(?:\.\d+)?/);
  return match ? match[0] : null;
}

/**
 * 텍스트가 숫자만으로 구성되어 있는지 확인합니다.
 * (공백과 소수점 허용)
 *
 * @param text 확인할 텍스트
 * @returns 숫자만 있으면 true
 */
function isNumberOnly(text: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(text.trim());
}

/**
 * 정규화된 텍스트에서 항목명 토큰과 값을 분리합니다.
 * 예: "횡경 35.1" → { fieldPart: "횡경", valuePart: "35.1" }
 *
 * @param normalized 정규화된 텍스트
 * @returns { fieldPart, valuePart }
 */
function splitFieldAndValue(normalized: string): {
  fieldPart: string;
  valuePart: string;
} {
  // 숫자가 포함된 경우: 마지막 숫자 앞까지가 항목명
  const numberMatch = normalized.match(/^(.*?)\s*(\d+(?:\.\d+)?)\s*$/);
  if (numberMatch) {
    return {
      fieldPart: numberMatch[1]?.trim() ?? '',
      valuePart: numberMatch[2] ?? '',
    };
  }
  return { fieldPart: normalized.trim(), valuePart: '' };
}

/**
 * 텍스트 토큰과 alias 사전을 비교하여 가장 잘 매칭되는 필드 키를 찾습니다.
 *
 * @param tokens 텍스트 토큰 배열
 * @returns { fieldKey, score, method } 또는 null
 */
function matchFieldFromTokens(
  tokens: string[],
): { fieldKey: string; score: number; method: ParseResult['method'] } | null {
  // 각 토큰에 대해 조사 제거 후 alias 매칭
  for (const token of tokens) {
    const cleaned = removeParticles(token);

    // 1. 정확 일치 (alias 원본 그대로)
    if (isKnownAlias(cleaned)) {
      const fieldKey = resolveAlias(cleaned);
      return { fieldKey, score: SCORE_ALIAS, method: 'alias' };
    }

    // 2. 정확 일치 (필드 키 그대로)
    if (cleaned in FIELD_ALIASES) {
      return { fieldKey: cleaned, score: SCORE_EXACT, method: 'exact' };
    }

    // 3. 소문자 정규화 후 재시도
    const lowerCleaned = cleaned.toLowerCase();
    if (isKnownAlias(lowerCleaned)) {
      const fieldKey = resolveAlias(lowerCleaned);
      return { fieldKey, score: SCORE_NORMALIZED, method: 'normalized' };
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// 메인 파서
// ─────────────────────────────────────────────

/**
 * STT 원본 텍스트에서 항목명과 값을 추출합니다.
 *
 * @param rawText STT 원본 텍스트
 * @param context 파서 컨텍스트 (lastField, surveyType, activeFields)
 * @returns ParseResult
 */
export function parse(rawText: string, context: ParserContext): ParseResult {
  const { lastField } = context;

  // 1. 정규화
  const normalized = normalize(rawText);

  if (!normalized) {
    return {
      field: null,
      value: null,
      numericValue: null,
      score: SCORE_UNKNOWN,
      method: 'unknown',
      isCorrection: false,
      warning: null,
    };
  }

  // 2. 숫자만 있는 경우 → 수정 모드 (isCorrection)
  if (isNumberOnly(normalized)) {
    const numStr = extractNumber(normalized);
    const numValue = numStr !== null ? parseFloat(numStr) : null;
    const warning = numValue !== null && numValue > OVERFLOW_THRESHOLD
      ? `인식된 값 ${numValue}이 ${OVERFLOW_THRESHOLD}을 초과합니다. 음성 오인식을 확인하세요.`
      : null;

    return {
      field: lastField,
      value: numStr,
      numericValue: numValue,
      score: SCORE_VALUE_ONLY,
      method: 'value-only',
      isCorrection: lastField !== null,
      warning,
    };
  }

  // 3. 항목명 + 값 분리
  const { fieldPart, valuePart } = splitFieldAndValue(normalized);
  const tokens = fieldPart.split(/\s+/).filter((t) => t.length > 0);

  // 4. alias 사전으로 필드 매칭
  const match = matchFieldFromTokens(tokens);

  if (match === null) {
    // 매칭 실패 — 텍스트 전체에서 숫자 추출 시도
    const numStr = extractNumber(normalized);
    const numValue = numStr !== null ? parseFloat(numStr) : null;
    const warning = numValue !== null && numValue > OVERFLOW_THRESHOLD
      ? `인식된 값 ${numValue}이 ${OVERFLOW_THRESHOLD}을 초과합니다.`
      : null;

    return {
      field: null,
      value: numStr ?? normalized,
      numericValue: numValue,
      score: SCORE_UNKNOWN,
      method: 'unknown',
      isCorrection: false,
      warning,
    };
  }

  // 5. 값 추출
  const valueStr = valuePart !== '' ? valuePart : extractNumber(normalized);
  const numericValue = valueStr !== null ? parseFloat(valueStr) : null;
  const warning = numericValue !== null && numericValue > OVERFLOW_THRESHOLD
    ? `인식된 값 ${numericValue}이 ${OVERFLOW_THRESHOLD}을 초과합니다. 음성 오인식을 확인하세요.`
    : null;

  return {
    field: match.fieldKey,
    value: valueStr,
    numericValue,
    score: match.score,
    method: match.method,
    isCorrection: false,
    warning,
  };
}

/**
 * STT 텍스트를 정규화합니다. (ParserService re-export용)
 *
 * @param text 정규화할 텍스트
 * @returns 정규화된 텍스트
 */
export { normalize } from './normalizer.js';

/**
 * alias 텍스트를 필드 키로 변환합니다. (ParserService re-export용)
 *
 * @param text alias 텍스트
 * @returns 필드 키
 */
export { resolveAlias } from './alias.js';

/**
 * 한국어 조사를 제거합니다. (ParserService re-export용)
 *
 * @param text 조사를 제거할 텍스트
 * @returns 조사 제거된 텍스트
 */
export { removeParticles } from './normalizer.js';
