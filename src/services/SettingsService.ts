/**
 * services/SettingsService.ts — 앱 설정 CRUD 서비스
 *
 * 목적: IndexedDB settings 스토어에 대한 키-값 읽기/쓰기를 제공합니다.
 *       api-schema.json의 SettingsService 설계를 구현합니다.
 *
 * 기본값:
 * - farmerNames: ['강남호', '양승보', '이원창'] (기존 엑셀 데이터 기반)
 * - labels: ['A', 'B', 'C']
 * - treatments: ['관행', '시험']
 * - defaultTreeRange: { min: 1, max: 3 }
 * - defaultFruitRange: 5
 */

import { getDB } from '../db/index.js';
import type { AppDefaults } from '../types.js';

// ─────────────────────────────────────────────
// 상수 — 기본 설정값
// ─────────────────────────────────────────────

const DEFAULT_FARMER_NAMES = ['강남호', '양승보', '이원창'];
const DEFAULT_LABELS = ['A', 'B', 'C'];
const DEFAULT_TREATMENTS = ['관행', '시험'];
const DEFAULT_TREE_RANGE = { min: 1, max: 3 };

/**
 * 앱 기본값 설정의 초기 기본값.
 */
const DEFAULT_APP_DEFAULTS: AppDefaults = {
  farmerNames: DEFAULT_FARMER_NAMES,
  labels: DEFAULT_LABELS,
  treatments: DEFAULT_TREATMENTS,
  treeRange: DEFAULT_TREE_RANGE,
  defaultFarmerName: DEFAULT_FARMER_NAMES[0] ?? '',
  defaultLabel: DEFAULT_LABELS[0] ?? 'A',
  defaultTreatment: DEFAULT_TREATMENTS[0] ?? '관행',
};

// ─────────────────────────────────────────────
// 설정 기본값 상수 맵
// ─────────────────────────────────────────────

const SETTING_DEFAULTS: Record<string, unknown> = {
  ttsEnabled: true,
  gemmaEnabled: false,
  audioRecordEnabled: true,
  voiceLogEnabled: true,
  fieldPresets: [],
  activeGrowthPreset: 'default',
  activeQualityPreset: 'default',
};

// ─────────────────────────────────────────────
// 함수 구현
// ─────────────────────────────────────────────

/**
 * 설정값을 조회합니다.
 * 존재하지 않으면 defaultValue를 반환합니다.
 *
 * @param key 설정 키 (예: 'ttsEnabled')
 * @param defaultValue 기본값
 * @returns Promise<T>
 * @throws Error 읽기 실패 시
 */
export async function get<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const db = await getDB();
    const entry = await db.get('settings', key);
    if (entry === undefined) {
      return defaultValue;
    }
    return entry.value as T;
  } catch (err) {
    throw new Error(
      `설정 조회 실패 (key=${key}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * 설정값을 저장합니다.
 *
 * @param key 설정 키
 * @param value 저장할 값
 * @returns Promise<void>
 * @throws Error 저장 실패 시
 */
export async function set(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDB();
    await db.put('settings', { key, value });
  } catch (err) {
    throw new Error(
      `설정 저장 실패 (key=${key}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * AppDefaults 전체를 조회합니다.
 * 저장된 값이 없으면 기본값을 반환합니다.
 *
 * @returns Promise<AppDefaults>
 * @throws Error 읽기 실패 시
 */
export async function getDefaults(): Promise<AppDefaults> {
  return get<AppDefaults>('defaults', DEFAULT_APP_DEFAULTS);
}

/**
 * AppDefaults를 저장합니다.
 *
 * @param defaults 저장할 AppDefaults 객체
 * @returns Promise<void>
 * @throws Error 저장 실패 시
 */
export async function saveDefaults(defaults: AppDefaults): Promise<void> {
  return set('defaults', defaults);
}

/**
 * 모든 설정값을 기본값으로 초기화합니다.
 * settings 스토어를 비우고 기본값으로 채웁니다.
 *
 * @returns Promise<void>
 * @throws Error 초기화 실패 시
 */
export async function resetToDefaults(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('settings');

    // 기본값 일괄 저장
    const puts: Promise<string>[] = [
      db.put('settings', { key: 'defaults', value: DEFAULT_APP_DEFAULTS }),
      ...Object.entries(SETTING_DEFAULTS).map(([key, value]) =>
        db.put('settings', { key, value }),
      ),
    ];
    await Promise.all(puts);
  } catch (err) {
    throw new Error(
      `설정 초기화 실패: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * AppDefaults의 정적 기본값을 반환합니다. (동기 함수)
 * DB 접근 없이 초기 렌더링에 사용됩니다.
 *
 * @returns AppDefaults 기본값
 */
export function getDefaultAppDefaults(): AppDefaults {
  return { ...DEFAULT_APP_DEFAULTS };
}
