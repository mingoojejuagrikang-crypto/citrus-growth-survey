/**
 * services/IndexedDBService.ts — IndexedDB CRUD 서비스
 *
 * 목적: growthRecords/qualityRecords 스토어에 대한 CRUD 작업을 제공합니다.
 *       idb 8.0.3 기반. api-schema.json의 IndexedDBService 설계를 구현합니다.
 *
 * 에러: 모든 함수는 try/catch로 감싸고 DBError로 재throw합니다.
 */
import { getDB } from '../db/index.js';
import { nowIso } from '../utils/dateUtils.js';
// ─────────────────────────────────────────────
// 커스텀 에러 클래스
// ─────────────────────────────────────────────
export class DBError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'DBError';
    }
}
// ─────────────────────────────────────────────
// 내부 유틸리티
// ─────────────────────────────────────────────
/**
 * surveyType에 따라 스토어 이름을 반환합니다.
 *
 * @param type 'growth' | 'quality'
 * @returns 스토어 이름
 */
function getStoreName(type) {
    return type === 'growth' ? 'growthRecords' : 'qualityRecords';
}
// ─────────────────────────────────────────────
// CRUD 함수
// ─────────────────────────────────────────────
/**
 * 레코드를 IndexedDB에 저장합니다.
 * 중복 키가 존재하면 덮어씁니다(put). syncStatus는 항상 'pending'으로 설정됩니다.
 *
 * @param type 조사 유형 ('growth' | 'quality')
 * @param record 저장할 레코드
 * @returns Promise<void>
 * @throws DBError 쓰기 실패 시
 */
export async function saveRecord(type, record) {
    try {
        const db = await getDB();
        const storeName = getStoreName(type);
        const now = nowIso();
        const recordToSave = {
            ...record,
            syncStatus: 'pending',
            updatedAt: now,
        };
        await db.put(storeName, recordToSave);
    }
    catch (err) {
        throw new DBError(`레코드 저장 실패 (type=${type}, id=${record.id}): ${err instanceof Error ? err.message : String(err)}`, err);
    }
}
/**
 * ID로 단일 레코드를 조회합니다.
 *
 * @param type 조사 유형
 * @param id 레코드 ID
 * @returns Promise<GrowthRecord | QualityRecord | undefined>
 * @throws DBError 읽기 실패 시
 */
export async function getRecordById(type, id) {
    try {
        const db = await getDB();
        const storeName = getStoreName(type);
        return await db.get(storeName, id);
    }
    catch (err) {
        throw new DBError(`레코드 조회 실패 (type=${type}, id=${id}): ${err instanceof Error ? err.message : String(err)}`, err);
    }
}
/**
 * 조건에 맞는 레코드 목록을 조회합니다.
 * 필터 없으면 전체 반환합니다.
 *
 * @param type 조사 유형
 * @param filter 조회 필터 (syncStatus, sessionKey, surveyDate, farmerName)
 * @returns Promise<(GrowthRecord | QualityRecord)[]>
 * @throws DBError 읽기 실패 시
 */
export async function getRecords(type, filter) {
    try {
        const db = await getDB();
        const storeName = getStoreName(type);
        let records;
        // syncStatus 필터가 있으면 인덱스를 활용
        if (filter?.syncStatus !== undefined) {
            records = await db.getAllFromIndex(storeName, 'by-sync', filter.syncStatus);
        }
        else if (filter?.sessionKey !== undefined) {
            records = await db.getAllFromIndex(storeName, 'by-session', filter.sessionKey);
        }
        else {
            records = await db.getAll(storeName);
        }
        // 추가 필터 적용 (클라이언트 측)
        if (filter) {
            if (filter.surveyDate !== undefined) {
                records = records.filter((r) => r.surveyDate === filter.surveyDate);
            }
            if (filter.farmerName !== undefined) {
                records = records.filter((r) => r.farmerName === filter.farmerName);
            }
        }
        return records;
    }
    catch (err) {
        throw new DBError(`레코드 목록 조회 실패 (type=${type}): ${err instanceof Error ? err.message : String(err)}`, err);
    }
}
/**
 * 동기화 상태를 갱신합니다.
 * synced 상태로 변경 시 syncedAt도 현재 시각으로 업데이트합니다.
 *
 * @param type 조사 유형
 * @param id 레코드 ID
 * @param status 새 동기화 상태 ('synced' | 'error')
 * @returns Promise<void>
 * @throws DBError 읽기/쓰기 실패 시
 */
export async function updateSyncStatus(type, id, status) {
    try {
        const db = await getDB();
        const storeName = getStoreName(type);
        const record = await db.get(storeName, id);
        if (!record) {
            throw new DBError(`레코드를 찾을 수 없습니다 (type=${type}, id=${id})`);
        }
        const now = nowIso();
        const updated = {
            ...record,
            syncStatus: status,
            syncedAt: status === 'synced' ? now : record.syncedAt,
            updatedAt: now,
        };
        await db.put(storeName, updated);
    }
    catch (err) {
        if (err instanceof DBError)
            throw err;
        throw new DBError(`동기화 상태 갱신 실패 (type=${type}, id=${id}): ${err instanceof Error ? err.message : String(err)}`, err);
    }
}
/**
 * 레코드를 삭제합니다.
 *
 * @param type 조사 유형
 * @param id 삭제할 레코드 ID
 * @returns Promise<void>
 * @throws DBError 삭제 실패 시
 */
export async function deleteRecord(type, id) {
    try {
        const db = await getDB();
        const storeName = getStoreName(type);
        await db.delete(storeName, id);
    }
    catch (err) {
        throw new DBError(`레코드 삭제 실패 (type=${type}, id=${id}): ${err instanceof Error ? err.message : String(err)}`, err);
    }
}
/**
 * 미동기화(pending) 레코드 총 건수를 반환합니다.
 * SyncStore 업데이트 및 SyncStatusBar 표시에 사용됩니다.
 *
 * @returns Promise<number>
 * @throws DBError 읽기 실패 시
 */
export async function getPendingCount() {
    try {
        const db = await getDB();
        const [growthCount, qualityCount] = await Promise.all([
            db.countFromIndex('growthRecords', 'by-sync', 'pending'),
            db.countFromIndex('qualityRecords', 'by-sync', 'pending'),
        ]);
        return growthCount + qualityCount;
    }
    catch (err) {
        throw new DBError(`미동기화 건수 조회 실패: ${err instanceof Error ? err.message : String(err)}`, err);
    }
}
/**
 * 최근 N개 조사 세션 목록을 반환합니다.
 * sessionKey 기준 unique 목록. 이전 입력 재사용 UX(F012)에 사용됩니다.
 *
 * @param limit 최대 반환 건수 (기본 5)
 * @returns Promise<SessionSummary[]>
 * @throws DBError 읽기 실패 시
 */
export async function getRecentSessions(limit = 5) {
    try {
        const db = await getDB();
        // growth와 quality 모두 조회하여 합산 후 중복 제거
        const [growthRecords, qualityRecords] = await Promise.all([
            db.getAll('growthRecords'),
            db.getAll('qualityRecords'),
        ]);
        const allRecords = [...growthRecords, ...qualityRecords];
        // sessionKey 기준으로 가장 최신 레코드만 유지
        const sessionMap = new Map();
        for (const record of allRecords) {
            const existing = sessionMap.get(record.sessionKey);
            if (!existing || record.updatedAt > existing.updatedAt) {
                sessionMap.set(record.sessionKey, record);
            }
        }
        // updatedAt 기준 내림차순 정렬 후 limit 적용
        const sessions = Array.from(sessionMap.values())
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, limit)
            .map((r) => ({
            sessionKey: r.sessionKey,
            surveyDate: r.surveyDate,
            farmerName: r.farmerName,
            label: r.label,
            treatment: r.treatment,
            lastUpdatedAt: r.updatedAt,
        }));
        return sessions;
    }
    catch (err) {
        throw new DBError(`최근 세션 목록 조회 실패: ${err instanceof Error ? err.message : String(err)}`, err);
    }
}
/**
 * 미동기화(pending) 레코드 전체를 조회합니다.
 * SheetsService.syncPendingRecords()에서 사용됩니다.
 *
 * @returns Promise<{ growth: GrowthRecord[]; quality: QualityRecord[] }>
 * @throws DBError 읽기 실패 시
 */
export async function getPendingRecords() {
    try {
        const db = await getDB();
        const [growth, quality] = await Promise.all([
            db.getAllFromIndex('growthRecords', 'by-sync', 'pending'),
            db.getAllFromIndex('qualityRecords', 'by-sync', 'pending'),
        ]);
        return { growth, quality };
    }
    catch (err) {
        throw new DBError(`미동기화 레코드 조회 실패: ${err instanceof Error ? err.message : String(err)}`, err);
    }
}
