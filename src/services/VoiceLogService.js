/**
 * services/VoiceLogService.ts — STT 로그 및 오디오 blob 관리 서비스
 *
 * 목적: voiceLogs/voiceAudio 스토어에 대한 CRUD 및 내보내기 기능을 제공합니다.
 *       fflate를 사용한 ZIP 내보내기를 지원합니다.
 *
 * api-schema.json의 VoiceLogService 설계를 구현합니다.
 */
import { getDB } from '../db/index.js';
import { strToU8, zip } from 'fflate';
import { extractDatePrefix, nowIso } from '../utils/dateUtils.js';
// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
/** UUID v4 생성 (crypto.randomUUID 기반) */
function generateId() {
    return crypto.randomUUID();
}
// ─────────────────────────────────────────────
// 로그 저장
// ─────────────────────────────────────────────
/**
 * STT 인식 이벤트 로그를 voiceLogs 스토어에 저장합니다.
 * voiceLogEnabled 설정 확인은 호출자(SttService 등)에서 처리합니다.
 *
 * @param log id를 제외한 로그 데이터
 * @returns Promise<string> 생성된 id
 * @throws Error 저장 실패 시
 */
export async function saveLog(log) {
    try {
        const db = await getDB();
        const id = generateId();
        const record = { id, ...log };
        await db.add('voiceLogs', record);
        return id;
    }
    catch (err) {
        throw new Error(`음성 로그 저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
}
/**
 * 발화 구간 오디오 blob을 voiceAudio 스토어에 저장합니다.
 * audioRecordEnabled가 false이면 호출자에서 호출하지 않아야 합니다.
 *
 * @param audio id를 제외한 오디오 데이터
 * @returns Promise<string> 생성된 id
 * @throws Error 저장 실패 시
 */
export async function saveAudio(audio) {
    try {
        const db = await getDB();
        const id = generateId();
        const record = { id, ...audio };
        await db.add('voiceAudio', record);
        return id;
    }
    catch (err) {
        throw new Error(`오디오 저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
}
// ─────────────────────────────────────────────
// 로그 조회
// ─────────────────────────────────────────────
/**
 * 로그 목록을 조회합니다.
 * 날짜 범위, kind, session 필터를 지원합니다.
 *
 * @param filter 조회 필터 (dateFrom, dateTo, kind, session)
 * @returns Promise<VoiceLog[]> 최신순 정렬
 * @throws Error 조회 실패 시
 */
export async function getLogs(filter) {
    try {
        const db = await getDB();
        let logs;
        if (filter?.kind !== undefined) {
            // kind 필터 (by-status 인덱스 대신 전체 조회 후 필터)
            logs = await db.getAll('voiceLogs');
            logs = logs.filter((l) => l.kind === filter.kind);
        }
        else {
            logs = await db.getAll('voiceLogs');
        }
        // 날짜 범위 필터
        if (filter?.dateFrom !== undefined || filter?.dateTo !== undefined) {
            logs = logs.filter((l) => {
                const datePrefix = extractDatePrefix(l.ts);
                if (filter.dateFrom !== undefined && datePrefix < filter.dateFrom)
                    return false;
                if (filter.dateTo !== undefined && datePrefix > filter.dateTo)
                    return false;
                return true;
            });
        }
        // session 필터
        if (filter?.session !== undefined) {
            logs = logs.filter((l) => l.session === filter.session);
        }
        // 최신순 정렬
        logs.sort((a, b) => b.ts.localeCompare(a.ts));
        return logs;
    }
    catch (err) {
        throw new Error(`음성 로그 조회 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
}
// ─────────────────────────────────────────────
// 로그 삭제
// ─────────────────────────────────────────────
/**
 * 단일 로그를 삭제합니다.
 * audioFileId가 있으면 연결된 voiceAudio도 함께 삭제합니다.
 *
 * @param id 삭제할 로그 id
 * @returns Promise<void>
 * @throws Error 삭제 실패 시
 */
export async function deleteLog(id) {
    try {
        const db = await getDB();
        const log = await db.get('voiceLogs', id);
        if (!log)
            return;
        // 연결된 오디오 먼저 삭제
        if (log.audioFileId !== null) {
            await db.delete('voiceAudio', log.audioFileId);
        }
        await db.delete('voiceLogs', id);
    }
    catch (err) {
        throw new Error(`음성 로그 삭제 실패 (id=${id}): ${err instanceof Error ? err.message : String(err)}`);
    }
}
/**
 * 오디오 blob만 삭제합니다.
 * 로그 레코드는 유지하고 audioFileId를 null로 업데이트합니다.
 *
 * @param audioId 삭제할 voiceAudio id
 * @returns Promise<void>
 * @throws Error 삭제 실패 시
 */
export async function deleteAudio(audioId) {
    try {
        const db = await getDB();
        // 오디오 ID로 연결된 로그 찾아서 audioFileId 초기화
        const audioRecord = await db.get('voiceAudio', audioId);
        if (audioRecord) {
            const linkedLog = await db.get('voiceLogs', audioRecord.logId);
            if (linkedLog) {
                await db.put('voiceLogs', { ...linkedLog, audioFileId: null });
            }
        }
        await db.delete('voiceAudio', audioId);
    }
    catch (err) {
        throw new Error(`오디오 삭제 실패 (id=${audioId}): ${err instanceof Error ? err.message : String(err)}`);
    }
}
/**
 * 날짜 범위 내 로그를 일괄 삭제합니다.
 * 연결된 오디오도 함께 삭제합니다.
 *
 * @param dateFrom 시작 날짜 ('YYYY-MM-DD')
 * @param dateTo 종료 날짜 ('YYYY-MM-DD')
 * @returns Promise<number> 삭제된 로그 건수
 * @throws Error 삭제 실패 시
 */
export async function deleteLogsByDateRange(dateFrom, dateTo) {
    try {
        const db = await getDB();
        const logs = await getLogs({ dateFrom, dateTo });
        let deletedCount = 0;
        // 병렬 삭제 (부분 실패 허용)
        const results = await Promise.allSettled(logs.map(async (log) => {
            if (log.audioFileId !== null) {
                await db.delete('voiceAudio', log.audioFileId);
            }
            await db.delete('voiceLogs', log.id);
            deletedCount++;
        }));
        // 실패 항목 로깅
        results.forEach((result) => {
            if (result.status === 'rejected') {
                console.warn('[VoiceLogService] 일부 로그 삭제 실패:', result.reason);
            }
        });
        return deletedCount;
    }
    catch (err) {
        throw new Error(`날짜 범위 로그 삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
}
/**
 * voiceLogs + voiceAudio 스토어를 전체 삭제합니다.
 *
 * @returns Promise<void>
 * @throws Error 삭제 실패 시
 */
export async function deleteAllLogs() {
    try {
        const db = await getDB();
        await Promise.all([db.clear('voiceLogs'), db.clear('voiceAudio')]);
    }
    catch (err) {
        throw new Error(`전체 로그 삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
}
// ─────────────────────────────────────────────
// 내보내기
// ─────────────────────────────────────────────
/**
 * 로그를 JSON 문자열로 직렬화하여 반환합니다.
 * Blob URL 생성은 호출자 책임입니다.
 *
 * @param filter 내보낼 로그 필터
 * @returns Promise<string> JSON 문자열
 * @throws Error 직렬화 실패 시
 */
export async function exportLogs(filter) {
    try {
        const logs = await getLogs(filter);
        return JSON.stringify({
            exportedAt: nowIso(),
            count: logs.length,
            logs,
        }, null, 2);
    }
    catch (err) {
        throw new Error(`로그 JSON 내보내기 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
}
/**
 * 로그 JSON + 오디오 파일을 ZIP으로 묶어 Uint8Array를 반환합니다.
 * fflate를 사용합니다.
 *
 * @param filter 내보낼 로그 필터
 * @returns Promise<Uint8Array> ZIP 바이너리
 * @throws Error ZIP 생성 실패 시
 */
export async function exportLogsWithAudio(filter) {
    try {
        const db = await getDB();
        const logs = await getLogs(filter);
        // ZIP 파일 맵 구성
        const files = {};
        // 로그 JSON 추가
        const jsonStr = JSON.stringify({ exportedAt: nowIso(), count: logs.length, logs }, null, 2);
        files['voice-logs.json'] = strToU8(jsonStr);
        // 오디오 파일 추가
        for (const log of logs) {
            if (log.audioFileId !== null) {
                const audio = await db.get('voiceAudio', log.audioFileId);
                if (audio) {
                    const ext = audio.mimeType.includes('mp4') ? 'mp4' : 'webm';
                    const fileName = `audio/${log.id}.${ext}`;
                    const arrayBuffer = await audio.blob.arrayBuffer();
                    files[fileName] = new Uint8Array(arrayBuffer);
                }
            }
        }
        // fflate ZIP 생성 (Promise wrapping)
        const zipData = await new Promise((resolve, reject) => {
            zip(files, { level: 0 }, (err, data) => {
                if (err) {
                    reject(new Error(`ZIP 압축 실패: ${err.message}`));
                }
                else {
                    resolve(data);
                }
            });
        });
        return zipData;
    }
    catch (err) {
        throw new Error(`ZIP 내보내기 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
}
// ─────────────────────────────────────────────
// 통계
// ─────────────────────────────────────────────
/**
 * 날짜별 로그 통계를 반환합니다.
 * VoiceLogPage 목록 표시에 사용됩니다.
 *
 * @returns Promise<LogDateStat[]> 날짜 기준 내림차순 정렬
 * @throws Error 조회 실패 시
 */
export async function getLogStats() {
    try {
        const db = await getDB();
        const logs = await db.getAll('voiceLogs');
        const statsMap = new Map();
        for (const log of logs) {
            const date = extractDatePrefix(log.ts);
            if (!statsMap.has(date)) {
                statsMap.set(date, {
                    totalCount: 0,
                    okCount: 0,
                    warnCount: 0,
                    failCount: 0,
                    audioIds: new Set(),
                });
            }
            const stat = statsMap.get(date);
            stat.totalCount++;
            if (log.kind === 'ok')
                stat.okCount++;
            else if (log.kind === 'warn')
                stat.warnCount++;
            else if (log.kind === 'fail')
                stat.failCount++;
            if (log.audioFileId !== null)
                stat.audioIds.add(log.audioFileId);
        }
        return Array.from(statsMap.entries())
            .map(([date, stat]) => ({
            date,
            totalCount: stat.totalCount,
            okCount: stat.okCount,
            warnCount: stat.warnCount,
            failCount: stat.failCount,
            hasAudio: stat.audioIds.size > 0,
        }))
            .sort((a, b) => b.date.localeCompare(a.date));
    }
    catch (err) {
        throw new Error(`로그 통계 조회 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
}
/**
 * 저장소 사용량 통계를 반환합니다.
 * VoiceLogPage 저장소 관리 UI에서 사용됩니다.
 *
 * @returns Promise<{ logCount, audioCount, estimatedBytes }>
 */
export async function getStorageStats() {
    try {
        const db = await getDB();
        const [logCount, audioRecords] = await Promise.all([
            db.count('voiceLogs'),
            db.getAll('voiceAudio'),
        ]);
        let estimatedBytes = 0;
        for (const audio of audioRecords) {
            estimatedBytes += audio.blob.size;
        }
        return { logCount, audioCount: audioRecords.length, estimatedBytes };
    }
    catch (err) {
        throw new Error(`저장소 통계 조회 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
}
