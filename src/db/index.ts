/**
 * db/index.ts — IndexedDB 초기화
 *
 * 목적: idb 8.x를 사용하여 citrus-survey 데이터베이스를 초기화합니다.
 * 스토어: growthRecords, qualityRecords, settings, voiceLogs, voiceAudio, fieldPresets
 *
 * 반환값: 초기화된 IDBPDatabase 인스턴스 (싱글턴)
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type {
  GrowthRecord,
  QualityRecord,
  VoiceLog,
  VoiceAudio,
  FieldPreset,
} from '../types.js';

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

const DB_NAME = 'citrus-survey';
const DB_VERSION = 1;

// ─────────────────────────────────────────────
// DB 스키마 정의
// ─────────────────────────────────────────────

/**
 * IndexedDB 스키마.
 * idb DBSchema 인터페이스를 구현합니다.
 */
interface SurveyDBSchema extends DBSchema {
  growthRecords: {
    key: string;
    value: GrowthRecord;
    indexes: {
      'by-sync': string;
      'by-session': string;
    };
  };
  qualityRecords: {
    key: string;
    value: QualityRecord;
    indexes: {
      'by-sync': string;
      'by-session': string;
    };
  };
  settings: {
    key: string;
    value: {
      key: string;
      value: unknown;
    };
  };
  voiceLogs: {
    key: string;
    value: VoiceLog;
    indexes: {
      'by-date': string;
      'by-session': string;
      'by-status': string;
    };
  };
  voiceAudio: {
    key: string;
    value: VoiceAudio;
    indexes: {
      'by-log': string;
    };
  };
  fieldPresets: {
    key: string;
    value: FieldPreset;
  };
}

export type SurveyDB = IDBPDatabase<SurveyDBSchema>;

// ─────────────────────────────────────────────
// 싱글턴 DB 인스턴스
// ─────────────────────────────────────────────

let dbInstance: SurveyDB | null = null;

/**
 * IndexedDB 인스턴스를 반환합니다.
 * 최초 호출 시 openDB()로 초기화하며 이후에는 캐시된 인스턴스를 반환합니다.
 *
 * @returns Promise<SurveyDB> 초기화된 DB 인스턴스
 * @throws Error DB 열기 실패 시
 */
export async function getDB(): Promise<SurveyDB> {
  if (dbInstance !== null) {
    return dbInstance;
  }
  try {
    dbInstance = await openDB<SurveyDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion) {
        // 버전 0 → 1: 전체 스토어 생성
        if (oldVersion < 1) {
          // growthRecords
          const growthStore = db.createObjectStore('growthRecords', {
            keyPath: 'id',
          });
          growthStore.createIndex('by-sync', 'syncStatus');
          growthStore.createIndex('by-session', 'sessionKey');

          // qualityRecords
          const qualityStore = db.createObjectStore('qualityRecords', {
            keyPath: 'id',
          });
          qualityStore.createIndex('by-sync', 'syncStatus');
          qualityStore.createIndex('by-session', 'sessionKey');

          // settings (key-value 스토어)
          db.createObjectStore('settings', { keyPath: 'key' });

          // voiceLogs
          const voiceLogsStore = db.createObjectStore('voiceLogs', {
            keyPath: 'id',
          });
          // ts 날짜 prefix (YYYY-MM-DD) 인덱스
          voiceLogsStore.createIndex('by-date', 'ts');
          voiceLogsStore.createIndex('by-session', 'session');
          voiceLogsStore.createIndex('by-status', 'status');

          // voiceAudio
          const voiceAudioStore = db.createObjectStore('voiceAudio', {
            keyPath: 'id',
          });
          voiceAudioStore.createIndex('by-log', 'logId');

          // fieldPresets
          db.createObjectStore('fieldPresets', { keyPath: 'id' });
        }
      },
      blocked() {
        console.warn('[DB] 이전 버전의 연결이 열려 있어 업그레이드가 차단되었습니다.');
      },
      blocking() {
        // 현재 연결이 새 버전의 업그레이드를 막고 있으면 닫음
        dbInstance?.close();
        dbInstance = null;
      },
      terminated() {
        console.warn('[DB] 브라우저가 DB 연결을 강제 종료했습니다. 다음 요청 시 재연결합니다.');
        dbInstance = null;
      },
    });
    return dbInstance;
  } catch (err) {
    console.error('[DB] IndexedDB 초기화 실패:', err instanceof Error ? err.message : String(err));
    throw new Error(`IndexedDB 초기화 실패: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * DB를 초기화합니다. main.ts의 bootstrap()에서 앱 시작 시 1회 호출합니다.
 *
 * @returns Promise<void>
 */
export async function initDB(): Promise<void> {
  await getDB();
}
