/**
 * utils/validation.ts — 필드 유효성 검사 및 이상치 범위 체크
 *
 * 목적: 숫자 필드의 정상 범위를 체크하여 이상치 경고를 반환합니다.
 *       경고가 있어도 저장은 가능합니다 (soft warning).
 *       범위 기준: project-plan.json의 validation_ranges 참조.
 */

import type {
  GrowthRecord,
  QualityRecord,
  FieldValidationResult,
  RecordValidationResult,
} from '../types.js';

// ─────────────────────────────────────────────
// 이상치 범위 상수 (project-plan.json validation_ranges 기준)
// ─────────────────────────────────────────────

const VALIDATION_RANGES: Record<string, [number, number]> = {
  width: [33.4, 84.5],              // 횡경 (mm)
  height: [30.4, 68.6],             // 종경 (mm)
  fruitWeight: [27.0, 228.9],       // 과중 (g)
  pericarpThickness: [1.3, 4.0],    // 과피두께 (mm)
  brix: [7.2, 16.4],                // 당도 (°Bx)
  acidContent: [0.54, 3.94],        // 산함량 (%)
};

/** 음성 오인식 방지용 최대 숫자 임계값 */
const VOICE_MAX_NUMBER_THRESHOLD = 9999;

/** 필드 표시명 매핑 */
const FIELD_DISPLAY_NAMES: Record<string, string> = {
  width: '횡경',
  height: '종경',
  fruitWeight: '과중',
  pericarpThickness: '과피두께',
  brix: '당도',
  acidContent: '산함량',
};

/** 필드 단위 매핑 */
const FIELD_UNITS: Record<string, string> = {
  width: 'mm',
  height: 'mm',
  fruitWeight: 'g',
  pericarpThickness: 'mm',
  brix: '°Bx',
  acidContent: '%',
};

// ─────────────────────────────────────────────
// 함수 구현
// ─────────────────────────────────────────────

/**
 * 단일 필드의 값을 검증합니다.
 * - valid: 형식이 올바른지 (NaN, Infinity 불허)
 * - warning: 이상치 범위 초과 여부 (저장 가능)
 *
 * @param key 필드 내부 키 (예: 'width', 'brix')
 * @param value 검증할 숫자 값
 * @returns FieldValidationResult
 */
export function validateField(key: string, value: number): FieldValidationResult {
  // 숫자 유효성 체크
  if (!isFinite(value) || isNaN(value)) {
    return {
      valid: false,
      warning: false,
      message: `${FIELD_DISPLAY_NAMES[key] ?? key}: 유효한 숫자가 아닙니다.`,
    };
  }

  // 음성 오인식 방지: 9999 초과 경고
  if (value > VOICE_MAX_NUMBER_THRESHOLD) {
    return {
      valid: true,
      warning: true,
      message: `${FIELD_DISPLAY_NAMES[key] ?? key}: 값이 ${VOICE_MAX_NUMBER_THRESHOLD}을 초과합니다. 음성 오인식을 확인하세요.`,
    };
  }

  const range = VALIDATION_RANGES[key];
  if (range === undefined) {
    // 이상치 범위가 정의되지 않은 필드는 통과
    return { valid: true, warning: false, message: '' };
  }

  const [min, max] = range;
  const unit = FIELD_UNITS[key] ?? '';
  const displayName = FIELD_DISPLAY_NAMES[key] ?? key;

  if (value < min || value > max) {
    return {
      valid: true,
      warning: true,
      message: `${displayName}: 정상 범위(${min}~${max}${unit})를 벗어난 값입니다. 확인 후 저장하세요.`,
    };
  }

  return { valid: true, warning: false, message: '' };
}

/**
 * 레코드 전체를 검증합니다.
 * 필수 필드 누락 여부와 이상치 경고를 모두 확인합니다.
 *
 * @param record GrowthRecord 또는 QualityRecord의 부분 객체
 * @returns RecordValidationResult
 */
export function validateRecord(
  record: Partial<GrowthRecord | QualityRecord>,
): RecordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 필수 필드 누락 체크
  const requiredFields: Array<{ key: keyof GrowthRecord; label: string }> = [
    { key: 'surveyDate', label: '조사일자' },
    { key: 'farmerName', label: '농가명' },
    { key: 'treatment', label: '처리' },
    { key: 'treeNo', label: '조사나무' },
    { key: 'fruitNo', label: '조사과실' },
  ];

  for (const { key, label } of requiredFields) {
    const val = record[key];
    if (val === undefined || val === null || val === '') {
      errors.push(`${label}은(는) 필수 입력 항목입니다.`);
    }
  }

  // 이상치 범위 체크 (값이 존재하는 경우에만)
  const numericFields: string[] = ['width', 'height', 'fruitWeight', 'pericarpThickness', 'brix', 'acidContent'];

  for (const key of numericFields) {
    const val = (record as Record<string, unknown>)[key];
    if (val !== null && val !== undefined && typeof val === 'number') {
      const result = validateField(key, val);
      if (!result.valid) {
        errors.push(result.message);
      } else if (result.warning) {
        warnings.push(result.message);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    hasWarning: warnings.length > 0,
    errors,
    warnings,
  };
}

/**
 * 숫자가 음성 오인식 경고 대상인지 확인합니다.
 *
 * @param value 확인할 숫자
 * @returns 9999 초과 시 true
 */
export function isVoiceOverflowWarning(value: number): boolean {
  return value > VOICE_MAX_NUMBER_THRESHOLD;
}

/**
 * 필드 키에 대한 이상치 범위를 반환합니다.
 * 정의되지 않은 키는 null을 반환합니다.
 *
 * @param key 필드 내부 키
 * @returns [min, max] 또는 null
 */
export function getValidationRange(key: string): [number, number] | null {
  return VALIDATION_RANGES[key] ?? null;
}
