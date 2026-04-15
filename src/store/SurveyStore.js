/**
 * store/SurveyStore.ts — 조사 입력 상태 스토어
 *
 * 목적: 조사 유형, 입력 중 레코드, 세션 필드, 자동계산을 관리합니다.
 *       state-management.md의 SurveyStore 설계를 구현합니다.
 *
 * 자동계산:
 * - pericarpThicknessX4 = pericarpThickness * 4
 * - sugarAcidRatio = brix / acidContent
 */
import { Observable } from './index.js';
import { todayString } from '../utils/dateUtils.js';
// ─────────────────────────────────────────────
// 초기 상태
// ─────────────────────────────────────────────
function makeInitialSessionFields() {
    return {
        surveyDate: todayString(),
        baseDate: '',
        farmerName: '',
        label: '',
        treatment: '관행',
        treeNo: 1,
    };
}
const initialSurveyState = {
    surveyType: 'growth',
    currentRecord: {},
    lastField: null,
    sessionFields: makeInitialSessionFields(),
    isDirty: false,
};
// ─────────────────────────────────────────────
// SurveyStore 클래스
// ─────────────────────────────────────────────
class SurveyStore extends Observable {
    constructor() {
        super(initialSurveyState);
    }
    /**
     * 조사 유형을 전환합니다.
     * currentRecord를 초기화합니다.
     *
     * @param type 'growth' | 'quality'
     */
    setSurveyType(type) {
        this.setState({
            surveyType: type,
            currentRecord: {},
            isDirty: false,
        });
    }
    /**
     * 단일 필드 값을 업데이트합니다.
     * 자동계산 필드가 있으면 함께 업데이트합니다.
     * lastField와 isDirty도 업데이트합니다.
     *
     * @param field 필드 키 (예: 'width', 'brix')
     * @param value 업데이트할 값
     */
    updateField(field, value) {
        const state = this.getState();
        const updatedRecord = {
            ...state.currentRecord,
            [field]: value,
        };
        // 자동계산 트리거
        this.recalculate(updatedRecord);
        this.setState({
            currentRecord: updatedRecord,
            lastField: field,
            isDirty: true,
        });
    }
    /**
     * 세션 헤더 필드를 일괄 업데이트합니다.
     * 조사일자~조사나무 범위의 필드를 설정합니다.
     *
     * @param fields 업데이트할 세션 필드 (부분 업데이트 가능)
     */
    updateSessionFields(fields) {
        const state = this.getState();
        this.setState({
            sessionFields: { ...state.sessionFields, ...fields },
        });
    }
    /**
     * 포커스 항목(마지막 입력 항목)을 변경합니다.
     * 수정 모드 컨텍스트 유지에 사용됩니다.
     *
     * @param field 필드 키 또는 null
     */
    setLastField(field) {
        this.setState({ lastField: field });
    }
    /**
     * 최근 세션을 불러옵니다.
     * currentRecord는 유지하고 sessionFields만 교체합니다.
     *
     * @param session 불러올 세션 필드
     */
    loadSession(session) {
        this.setState({ sessionFields: session });
    }
    /**
     * 저장 후 상태를 초기화합니다.
     * fruitNo만 초기화하고, 세션 필드와 나머지 레코드는 유지합니다.
     * isDirty를 false로 설정합니다.
     */
    resetAfterSave() {
        const state = this.getState();
        const updatedRecord = { ...state.currentRecord };
        // fruitNo만 초기화 (다음 과실 입력 준비)
        delete updatedRecord['fruitNo'];
        this.setState({
            currentRecord: updatedRecord,
            isDirty: false,
        });
    }
    /**
     * 전체 상태를 초기화합니다.
     * 탭 전환 또는 새 세션 시작 시 사용합니다.
     */
    resetAll() {
        this.setState({
            currentRecord: {},
            lastField: null,
            sessionFields: makeInitialSessionFields(),
            isDirty: false,
        });
    }
    /**
     * 음성 인식 결과를 적용합니다.
     * isCorrection이면 lastField의 값을 덮어씁니다.
     *
     * @param result 파서 결과
     */
    applyVoiceResult(result) {
        const state = this.getState();
        const targetField = result.isCorrection ? state.lastField : result.field;
        if (targetField === null)
            return;
        const value = result.numericValue !== null ? result.numericValue : result.value;
        this.updateField(targetField, value);
    }
    // ─────────────────────────────────────────────
    // 자동계산 (내부 메서드)
    // ─────────────────────────────────────────────
    /**
     * 자동계산 필드를 업데이트합니다.
     * updateField() 내부에서 호출됩니다.
     *
     * 자동계산 규칙 (data-model.md 기준):
     * - pericarpThicknessX4: Math.round(pericarpThickness * 4 * 10) / 10
     * - sugarAcidRatio: Math.round(brix / acidContent * 100) / 100
     *
     * @param record 업데이트 중인 레코드 (mutable)
     */
    recalculate(record) {
        // 과피두께×4 자동계산
        if (record.pericarpThickness != null) {
            record.pericarpThicknessX4 =
                Math.round(record.pericarpThickness * 4 * 10) / 10;
        }
        else {
            record.pericarpThicknessX4 = null;
        }
        // 당산도 자동계산 (당도 ÷ 산함량)
        if (record.brix != null &&
            record.acidContent != null &&
            record.acidContent !== 0) {
            record.sugarAcidRatio =
                Math.round((record.brix / record.acidContent) * 100) / 100;
        }
        else {
            record.sugarAcidRatio = null;
        }
    }
    /**
     * 현재 레코드에서 GrowthRecord를 구성합니다.
     * 저장 전 레코드 완성에 사용됩니다.
     *
     * @param id 레코드 ID
     * @param sessionKey 세션 키
     * @param now ISO 8601 현재 시각
     * @returns Partial<GrowthRecord> 또는 Partial<QualityRecord>
     */
    buildRecord(id, sessionKey, now) {
        const state = this.getState();
        const base = {
            id,
            sessionKey,
            surveyDate: state.sessionFields.surveyDate,
            baseDate: state.sessionFields.baseDate || null,
            farmerName: state.sessionFields.farmerName,
            label: state.sessionFields.label,
            treatment: state.sessionFields.treatment,
            treeNo: state.sessionFields.treeNo,
            fruitNo: state.currentRecord.fruitNo ?? 0,
            width: state.currentRecord.width ?? null,
            height: state.currentRecord.height ?? null,
            remark: state.currentRecord.remark ?? '',
            syncStatus: 'pending',
            syncedAt: null,
            createdAt: now,
            updatedAt: now,
        };
        if (state.surveyType === 'quality') {
            const qRecord = state.currentRecord;
            return {
                ...base,
                fruitWeight: qRecord.fruitWeight ?? null,
                pericarpWeight: qRecord.pericarpWeight ?? null,
                pericarpThickness: qRecord.pericarpThickness ?? null,
                pericarpThicknessX4: qRecord.pericarpThicknessX4 ?? null,
                brix: qRecord.brix ?? null,
                titratableAcidity: qRecord.titratableAcidity ?? null,
                acidContent: qRecord.acidContent ?? null,
                sugarAcidRatio: qRecord.sugarAcidRatio ?? null,
                coloring: qRecord.coloring ?? null,
                nonDestructive: qRecord.nonDestructive ?? null,
            };
        }
        return base;
    }
}
// ─────────────────────────────────────────────
// 싱글턴 인스턴스
// ─────────────────────────────────────────────
export const surveyStore = new SurveyStore();
