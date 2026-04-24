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
import { FIELD_VALUE_RANGES, FIELD_DATA_TYPES } from '../types.js';
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
const SCORE_ALT_FALLBACK = 0.8;
const SCORE_NORMALIZED = 0.7;
const SCORE_VALUE_ONLY = 0.5;
const SCORE_UNKNOWN = 0.0;

/** F031: 수정 의도를 나타내는 프리픽스 목록 (lowercase, 트레일링 공백 포함) */
const CORRECTION_PREFIXES = ['수정 ', '아니 ', '아니야 ', '아니요 '] as const;

/** F035-이슈#4: 가이드 모드 스킵 명령어 목록 (정확히 일치해야 함) */
const SKIP_COMMANDS: ReadonlySet<string> = new Set(['다음', '패스', '스킵', '건너뛰기']);

// ─────────────────────────────────────────────
// F025: 범위 검사
// ─────────────────────────────────────────────

/**
 * 필드 값이 FIELD_VALUE_RANGES 내에 있는지 검사합니다.
 *
 * @param field 필드 키
 * @param numericValue 검사할 숫자 값
 * @returns 범위 내이거나 해당 필드에 범위 정의가 없으면 true
 */
function isInRange(field: string, numericValue: number): boolean {
  const range = FIELD_VALUE_RANGES[field];
  if (!range) return true; // 범위 정의 없는 필드는 통과
  return numericValue >= range[0] && numericValue <= range[1];
}

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
 * @param activeFields 현재 활성 필드 키 목록 (R3 컨텍스트 바이어싱)
 * @returns { fieldKey, score, method, matchedIdx } 또는 null
 */
function matchFieldFromTokens(
  tokens: string[],
  activeFields: string[] = [],
): { fieldKey: string; score: number; method: ParseResult['method']; matchedIdx: number } | null {
  /** R3: 활성 필드에 해당하면 점수에 +0.05 보너스 (1.0 초과 방지) */
  const applyActiveBonus = (fieldKey: string, baseScore: number): number =>
    activeFields.includes(fieldKey) ? Math.min(baseScore + 0.05, 1.0) : baseScore;

  // 각 토큰에 대해 조사 제거 후 alias 매칭
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const cleaned = removeParticles(token);

    // 1. 정확 일치 (alias 원본 그대로)
    if (isKnownAlias(cleaned)) {
      const fieldKey = resolveAlias(cleaned);
      return { fieldKey, score: applyActiveBonus(fieldKey, SCORE_ALIAS), method: 'alias', matchedIdx: i };
    }

    // 2. 정확 일치 (필드 키 그대로)
    if (cleaned in FIELD_ALIASES) {
      return { fieldKey: cleaned, score: applyActiveBonus(cleaned, SCORE_EXACT), method: 'exact', matchedIdx: i };
    }

    // 3. 소문자 정규화 후 재시도
    const lowerCleaned = cleaned.toLowerCase();
    if (isKnownAlias(lowerCleaned)) {
      const fieldKey = resolveAlias(lowerCleaned);
      return { fieldKey, score: applyActiveBonus(fieldKey, SCORE_NORMALIZED), method: 'normalized', matchedIdx: i };
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
export function parse(rawText: string, context: ParserContext, alternatives: string[] = []): ParseResult {
  const { lastField, activeFields } = context;

  // F035-이슈#4: 스킵 명령 감지 (정확 일치, 대소문자 무시)
  // normalize() 호출 전에 trim().toLowerCase()로 비교하여 "다음", "패스", "스킵", "건너뛰기" 감지
  const rawTrimmedLower = rawText.trim().toLowerCase();
  if (SKIP_COMMANDS.has(rawTrimmedLower)) {
    return {
      field: null,
      value: null,
      numericValue: null,
      score: 0,
      method: 'skip-command',
      isCorrection: false,
      hasCorrectionPrefix: false,
      isFieldOnly: false,
      isSkipCommand: true,
      warning: null,
    };
  }

  // F031: 수정 프리픽스 감지
  // 파서가 이미 모르는 토큰("수정", "아니")을 스킵하므로 필드+값 추출은 정상 동작.
  // 여기서는 플래그만 설정하고, 프리픽스 제거는 하지 않는다.
  let hasCorrectionPrefix = false;
  const rawLower = rawTrimmedLower;
  for (const prefix of CORRECTION_PREFIXES) {
    if (rawLower.startsWith(prefix)) {
      hasCorrectionPrefix = true;
      break;
    }
  }

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
      hasCorrectionPrefix: false,
      isFieldOnly: false,
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
      hasCorrectionPrefix: false,
      isFieldOnly: false,
    };
  }

  // 3. 항목명 + 값 분리
  const { fieldPart, valuePart } = splitFieldAndValue(normalized);
  const tokens = fieldPart.split(/\s+/).filter((t) => t.length > 0);

  // 4. alias 사전으로 필드 매칭 (R3: 활성 필드 바이어싱 포함)
  const match = matchFieldFromTokens(tokens, activeFields);

  if (match === null) {
    // alternatives fallback (PI-003): rawText 매칭 실패 시 상위 3개 alternatives로 재시도
    // F025: 범위 검사를 통과하는 첫 번째 alternative를 채택합니다.
    //       범위 초과 결과는 firstAltResult에 보관하여 모두 실패 시 outOfRange 반환용으로 사용합니다.
    let firstAltResult: ParseResult | null = null;
    let firstAltIndex = -1;

    for (let altIdx = 0; altIdx < Math.min(alternatives.length, 3); altIdx++) {
      const alt = alternatives[altIdx]!;
      if (alt === rawText) continue;
      const altNorm = normalize(alt);
      if (!altNorm) continue;
      const { fieldPart: altFP, valuePart: altVP } = splitFieldAndValue(altNorm);
      const altTokens = altFP.split(/\s+/).filter((t) => t.length > 0);
      const altMatch = matchFieldFromTokens(altTokens, activeFields);
      if (altMatch !== null) {
        const valueStr = altVP !== '' ? altVP : extractNumber(altNorm);
        const numericValue = valueStr !== null ? parseFloat(valueStr) : null;
        const warning = numericValue !== null && numericValue > OVERFLOW_THRESHOLD
          ? `인식된 값 ${numericValue}이 ${OVERFLOW_THRESHOLD}을 초과합니다.`
          : null;
        const candidate: ParseResult = {
          field: altMatch.fieldKey,
          value: valueStr,
          numericValue,
          score: SCORE_ALT_FALLBACK,
          method: 'alt-fallback',
          isCorrection: false,
          warning,
          selectedAltIndex: altIdx,
          hasCorrectionPrefix,
          isFieldOnly: false,
        };

        // F025: 범위 검사
        const inRange = numericValue !== null
          ? isInRange(altMatch.fieldKey, numericValue)
          : true; // 숫자 없으면 범위 검사 생략

        if (inRange) {
          return candidate;
        }

        // 범위 초과: 첫 번째 alt-match를 보관 (모두 실패 시 outOfRange 반환용)
        if (firstAltResult === null) {
          firstAltResult = candidate;
          firstAltIndex = altIdx;
        }
      }
    }

    // alt-match가 있었지만 모두 범위 초과
    if (firstAltResult !== null) {
      return { ...firstAltResult, selectedAltIndex: firstAltIndex, outOfRange: true, isFieldOnly: false };
    }

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
      hasCorrectionPrefix,
      isFieldOnly: false,
    };
  }

  // 5. 값 추출
  const valueStr = valuePart !== '' ? valuePart : extractNumber(normalized);
  const numericValue = valueStr !== null ? parseFloat(valueStr) : null;
  const warning = numericValue !== null && numericValue > OVERFLOW_THRESHOLD
    ? `인식된 값 ${numericValue}이 ${OVERFLOW_THRESHOLD}을 초과합니다. 음성 오인식을 확인하세요.`
    : null;

  // 5-a. 숫자 없는 텍스트 필드 (label, treatment 등): 필드 토큰 이후 잔여 텍스트를 값으로 사용
  let finalValueStr: string | null = valueStr;
  if (finalValueStr === null && match.matchedIdx < tokens.length - 1) {
    finalValueStr = tokens.slice(match.matchedIdx + 1).join(' ').trim() || null;
  }

  // 5-a. 이후: F034 — 항목명만 인식 여부 (값 없음)
  const isFieldOnly = finalValueStr === null;

  // F035-이슈#3: 데이터형 검증 — 정수/실수 필드에 비숫자 값이 들어오면
  //   (1) alternatives에 같은 필드의 유효한 숫자 값이 있으면 alt-fallback 채택
  //   (2) 없으면 isFieldOnly로 폴백하여 재시도 유도
  // Codex MEDIUM #4: alt 복구 루트가 막히던 문제 수정 (예: "나무 다" + alt "나무 4")
  if (!isFieldOnly) {
    const dataType = FIELD_DATA_TYPES[match.fieldKey]?.type;
    const isMismatch =
      (dataType === 'integer' && (numericValue === null || !Number.isInteger(numericValue))) ||
      (dataType === 'decimal' && numericValue === null);

    if (isMismatch) {
      // alternatives에서 같은 필드의 유효 숫자 탐색
      for (let altIdx = 0; altIdx < Math.min(alternatives.length, 3); altIdx++) {
        const alt = alternatives[altIdx]!;
        if (alt === rawText) continue;
        const altNorm = normalize(alt);
        if (!altNorm) continue;
        const { fieldPart: altFP, valuePart: altVP } = splitFieldAndValue(altNorm);
        const altTokens = altFP.split(/\s+/).filter((t) => t.length > 0);
        const altMatch = matchFieldFromTokens(altTokens, activeFields);
        if (altMatch !== null && altMatch.fieldKey === match.fieldKey) {
          const altValueStr = altVP !== '' ? altVP : extractNumber(altNorm);
          const altNumericValue = altValueStr !== null ? parseFloat(altValueStr) : null;
          const altValid =
            (dataType === 'integer' && altNumericValue !== null && Number.isInteger(altNumericValue)) ||
            (dataType === 'decimal' && altNumericValue !== null);
          if (altValid) {
            const altInRange = isInRange(altMatch.fieldKey, altNumericValue!);
            if (altInRange) {
              return {
                field: altMatch.fieldKey,
                value: altValueStr,
                numericValue: altNumericValue,
                score: SCORE_ALT_FALLBACK,
                method: 'alt-fallback',
                isCorrection: false,
                warning: null,
                selectedAltIndex: altIdx,
                hasCorrectionPrefix,
                isFieldOnly: false,
              };
            }
          }
        }
      }

      // alt 복구 실패 → isFieldOnly로 폴백하여 재시도 유도
      return {
        field: match.fieldKey,
        value: null,
        numericValue: null,
        score: match.score,
        method: match.method,
        isCorrection: false,
        warning: 'data-type-mismatch',
        hasCorrectionPrefix,
        isFieldOnly: true,
      };
    }
  }

  // F025: 범위 검사 (primary 결과)
  const primaryInRange = numericValue !== null
    ? isInRange(match.fieldKey, numericValue)
    : true; // 숫자 없으면 범위 검사 생략

  if (primaryInRange) {
    return {
      field: match.fieldKey,
      value: finalValueStr,
      numericValue,
      score: match.score,
      method: match.method,
      isCorrection: false,
      warning,
      hasCorrectionPrefix,
      isFieldOnly,
    };
  }

  // F025: primary 범위 초과 → alternatives에서 동일 필드의 범위 내 값 탐색
  for (let altIdx = 0; altIdx < Math.min(alternatives.length, 3); altIdx++) {
    const alt = alternatives[altIdx]!;
    if (alt === rawText) continue;
    const altNorm = normalize(alt);
    if (!altNorm) continue;
    const { fieldPart: altFP, valuePart: altVP } = splitFieldAndValue(altNorm);
    const altTokens = altFP.split(/\s+/).filter((t) => t.length > 0);
    const altMatch = matchFieldFromTokens(altTokens, activeFields);
    if (altMatch !== null && altMatch.fieldKey === match.fieldKey) {
      const altValueStr = altVP !== '' ? altVP : extractNumber(altNorm);
      const altNumericValue = altValueStr !== null ? parseFloat(altValueStr) : null;
      const altInRange = altNumericValue !== null
        ? isInRange(altMatch.fieldKey, altNumericValue)
        : false;
      if (altInRange) {
        const altWarning = altNumericValue !== null && altNumericValue > OVERFLOW_THRESHOLD
          ? `인식된 값 ${altNumericValue}이 ${OVERFLOW_THRESHOLD}을 초과합니다.`
          : null;
        return {
          field: altMatch.fieldKey,
          value: altValueStr,
          numericValue: altNumericValue,
          score: SCORE_ALT_FALLBACK,
          method: 'alt-fallback',
          isCorrection: false,
          warning: altWarning,
          selectedAltIndex: altIdx,
          hasCorrectionPrefix,
          isFieldOnly: false,
        };
      }
    }
  }

  // F025: 모든 alternatives 소진 — 원본 결과를 outOfRange 플래그와 함께 반환
  return {
    field: match.fieldKey,
    value: finalValueStr,
    numericValue,
    score: match.score,
    method: match.method,
    isCorrection: false,
    warning,
    outOfRange: true,
    selectedAltIndex: -1,
    hasCorrectionPrefix,
    isFieldOnly: false,
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
