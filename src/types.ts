/**
 * types.ts — 프로젝트 전체 공유 TypeScript 인터페이스/타입 정의
 * data-model.md 기준으로 정의됩니다.
 */

// ─────────────────────────────────────────────
// 동기화 상태
// ─────────────────────────────────────────────

export type SyncStatus = 'pending' | 'synced' | 'error';

export type SurveyType = 'growth' | 'quality';

// ─────────────────────────────────────────────
// 비대조사 레코드 (GrowthRecord)
// ─────────────────────────────────────────────

/**
 * 비대조사 레코드.
 * id = "{surveyDate}_{farmerName}_{label}_{treatment}_{treeNo}_{fruitNo}" 형식의 결정론적 키.
 * sessionKey = "{surveyDate}_{farmerName}_{label}_{treatment}" 형식.
 */
export interface GrowthRecord {
  id: string;
  sessionKey: string;
  surveyDate: string;           // YYYY-MM-DD
  baseDate: string | null;      // 기준일자 (YYYY-MM-DD), 없으면 null
  farmerName: string;
  label: string;                // A | B | C
  treatment: string;            // 관행 | 시험
  treeNo: number;               // 조사나무 번호 (정수)
  fruitNo: number;              // 조사과실 번호 (1~5, 정수)
  width: number | null;         // 횡경 (mm, 소수점 1자리)
  height: number | null;        // 종경 (mm, 소수점 1자리)
  remark: string;               // 비고 (자유 텍스트, 기본값 "")
  syncStatus: SyncStatus;
  syncedAt: string | null;      // 동기화 완료 시각 (ISO 8601)
  createdAt: string;            // 생성 시각 (ISO 8601)
  updatedAt: string;            // 수정 시각 (ISO 8601)
}

// ─────────────────────────────────────────────
// 품질조사 레코드 (QualityRecord)
// ─────────────────────────────────────────────

/**
 * 품질조사 레코드. GrowthRecord를 확장하며 추가 필드가 있습니다.
 * pericarpThicknessX4: pericarpThickness * 4 (자동계산, 직접 입력 불가)
 * sugarAcidRatio: brix / acidContent (자동계산, 직접 입력 불가)
 */
export interface QualityRecord extends GrowthRecord {
  fruitWeight: number | null;           // 과중 (g)
  pericarpWeight: number | null;        // 과피중 (g)
  pericarpThickness: number | null;     // 과피두께 (mm, 소수점 1자리)
  pericarpThicknessX4: number | null;   // 과피두께×4 (자동계산: Math.round(pericarpThickness * 4 * 10) / 10)
  brix: number | null;                  // 당도 (°Bx, 소수점 1자리)
  titratableAcidity: number | null;     // 적정산도
  acidContent: number | null;           // 산함량 (%)
  sugarAcidRatio: number | null;        // 당산도 (자동계산: Math.round(brix / acidContent * 100) / 100)
  coloring: number | null;              // 착색 (정수)
  nonDestructive: number | null;        // 비파괴 (소수점 1자리)
}

// ─────────────────────────────────────────────
// 앱 기본값 설정 (AppDefaults)
// ─────────────────────────────────────────────

/**
 * 입력 화면에서 사용할 기본값 설정.
 * IndexedDB settings 스토어의 'defaults' 키에 저장됩니다.
 */
export interface AppDefaults {
  farmerNames: string[];          // 농가명 목록 (예: ["강남호", "양승보", "이원창"])
  labels: string[];               // 라벨 목록 (예: ["A", "B", "C"])
  treatments: string[];           // 처리 목록 (예: ["관행", "시험"])
  treeRange: { min: number; max: number }; // 조사나무 범위
  defaultFarmerName: string;      // 기본 선택 농가명
  defaultLabel: string;           // 기본 선택 라벨
  defaultTreatment: string;       // 기본 선택 처리
}

// ─────────────────────────────────────────────
// 음성 로그 (VoiceLog)
// ─────────────────────────────────────────────

/**
 * STT 이벤트 로그 레코드.
 * v5/v6 포맷 계승. IndexedDB voiceLogs 스토어에 저장.
 */
export interface VoiceLog {
  id: string;                   // UUID v4
  ts: string;                   // 이벤트 발생 시각 (ISO 8601)
  kind: 'ok' | 'warn' | 'fail'; // 인식 결과 분류
  rawText: string;              // STT 원본 텍스트
  alternatives?: string[];      // SpeechRecognitionResult alternatives
  parse: VoiceParseResult | null; // 파서 결과
  status: 'accepted' | 'corrected' | 'rejected' | 'skipped'; // 처리 상태
  message?: string;             // 사용자에게 표시된 TTS 메시지
  timing?: TimingInfo;          // 인식 소요 시간
  feedback?: 'positive' | 'negative' | null; // 사용자 피드백
  device?: DeviceInfo;
  session?: string;             // 조사 세션 키
  audioFileId: string | null;   // 연결된 voiceAudio.id (오디오 OFF 시 null)
}

/**
 * 파서 결과 (VoiceLog.parse 필드용).
 * data-model.md 기준 ParseResult.
 */
export interface VoiceParseResult {
  field: string | null;         // 인식된 항목명 (정규화 후)
  value: string | null;         // 인식된 값 (원본 보존)
  score: number;                // 신뢰도 0.0~1.0
  method: 'alias' | 'exact' | 'normalized' | 'value-only' | 'unknown';
}

/**
 * 인식 소요 시간 정보.
 */
export interface TimingInfo {
  startMs: number;              // recognition.start() 호출 시각
  resultMs: number;             // onresult 이벤트 시각
  durationMs: number;           // 발화 구간 길이 (추정)
}

/**
 * 디바이스 정보 스냅샷.
 */
export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;       // navigator.language
  isIOS: boolean;
  isAndroid: boolean;
  screenWidth: number;    // screen.width
  screenHeight: number;   // screen.height
  pixelRatio: number;     // window.devicePixelRatio
}

// ─────────────────────────────────────────────
// 오디오 레코드 (VoiceAudio)
// ─────────────────────────────────────────────

/**
 * 발화 구간 오디오 blob 레코드.
 * IndexedDB voiceAudio 스토어에 저장.
 */
export interface VoiceAudio {
  id: string;                   // UUID v4
  blob: Blob;                   // 오디오 데이터
  mimeType: string;             // "audio/webm;codecs=opus" 또는 "audio/mp4;codecs=mp4a.40.2"
  ts: string;                   // 녹음 시작 시각 (ISO 8601)
  logId: string;                // 연결된 voiceLogs.id
  durationMs?: number;          // 녹음 길이 (밀리초)
}

// ─────────────────────────────────────────────
// 필드 프리셋 (FieldPreset)
// ─────────────────────────────────────────────

/**
 * 사용자 정의 조사항목 세트.
 * IndexedDB fieldPresets 스토어에 저장.
 */
export interface FieldPreset {
  id: string;                         // UUID v4
  name: string;                       // 세트 이름 (예: "비대조사 기본")
  surveyType: SurveyType;             // 조사 유형
  fields: FieldDefinition[];          // 항목 정의 목록
  createdAt: string;                  // 생성 시각 (ISO 8601)
}

/**
 * 개별 조사항목 정의.
 */
export interface FieldDefinition {
  key: string;                        // 내부 식별자 (예: transverseDiameter)
  label: string;                      // 화면 표시명 (예: 횡경)
  inputType: 'integer' | 'decimal1' | 'text' | 'select' | 'auto';
  unit: string | null;                // 단위 표시 (mm, g, °Bx 등)
  required: boolean;
  validationRange: { min: number; max: number } | null;
  autoFormula: string | null;         // 자동계산 수식 문자열 (auto 타입만)
  selectOptions: string[] | null;     // select 타입 선택지
  order: number;                      // 표시 순서
}

// ─────────────────────────────────────────────
// 파서 결과 (ParseResult) — parser 모듈 반환값
// ─────────────────────────────────────────────

/**
 * STT 텍스트 파서 결과.
 * src/parser/parser.ts의 parse() 함수 반환값.
 */
export interface ParseResult {
  field: string | null;               // 인식된 항목명
  value: string | null;               // 인식된 값 (원본 문자열)
  numericValue: number | null;        // 숫자 변환된 값 (숫자 필드인 경우)
  score: number;                      // 신뢰도 0.0~1.0
  method: 'alias' | 'exact' | 'normalized' | 'value-only' | 'unknown';
  isCorrection: boolean;              // 값만 발화한 수정 모드
  warning: string | null;             // 9999 초과 등 경고 메시지
}

// ─────────────────────────────────────────────
// 세션 요약 (SessionSummary)
// ─────────────────────────────────────────────

/**
 * 조사 세션 요약 정보.
 * IndexedDBService.getRecentSessions() 반환값.
 */
export interface SessionSummary {
  sessionKey: string;
  surveyDate: string;
  farmerName: string;
  label: string;
  treatment: string;
  lastUpdatedAt: string;
}

// ─────────────────────────────────────────────
// 레코드 필터 (RecordFilter)
// ─────────────────────────────────────────────

/**
 * IndexedDBService.getRecords() 필터 옵션.
 */
export interface RecordFilter {
  syncStatus?: SyncStatus;
  sessionKey?: string;
  surveyDate?: string;
  farmerName?: string;
}

// ─────────────────────────────────────────────
// 동기화 결과 (SyncResult)
// ─────────────────────────────────────────────

/**
 * SheetsService.syncPendingRecords() 반환값.
 */
export interface SyncResult {
  successCount: number;
  failCount: number;
  errors: Array<{ recordId: string; message: string }>;
}

// ─────────────────────────────────────────────
// 음성 로그 필터 및 통계
// ─────────────────────────────────────────────

/**
 * VoiceLogService.getLogs() 필터 옵션.
 */
export interface LogFilter {
  dateFrom?: string;   // YYYY-MM-DD
  dateTo?: string;     // YYYY-MM-DD
  kind?: 'ok' | 'warn' | 'fail';
  session?: string;
}

/**
 * 날짜별 로그 통계.
 * VoiceLogService.getLogStats() 반환값.
 */
export interface LogDateStat {
  date: string;         // YYYY-MM-DD
  totalCount: number;
  okCount: number;
  warnCount: number;
  failCount: number;
  hasAudio: boolean;
}

// ─────────────────────────────────────────────
// STT 이벤트
// ─────────────────────────────────────────────

/**
 * SttService.onResult 콜백 이벤트.
 */
export interface SttResultEvent {
  transcript: string;           // rawText
  isFinal: boolean;
  alternatives: string[];
  confidence: number;
}

export type SttState = 'idle' | 'listening' | 'processing';

// ─────────────────────────────────────────────
// TTS 옵션
// ─────────────────────────────────────────────

/**
 * TtsService.speak() 옵션.
 */
export interface TtsOptions {
  rate?: number;     // 0.1~10, 기본 1.0
  pitch?: number;    // 0~2, 기본 1.0
  volume?: number;   // 0~1, 기본 1.0
  lang?: string;     // 기본 'ko-KR'
}

// ─────────────────────────────────────────────
// MediaRecorder 오디오 blob
// ─────────────────────────────────────────────

/**
 * MediaRecorderService.stopRecording() 반환값.
 */
export interface AudioBlob {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

// ─────────────────────────────────────────────
// Gemma 컨텍스트
// ─────────────────────────────────────────────

/**
 * GemmaService.generateSuggestions() 컨텍스트.
 */
export interface SurveyContext {
  surveyType: SurveyType;
  farmerName: string;
  surveyDate: string;
}

// ─────────────────────────────────────────────
// Store 상태 인터페이스
// ─────────────────────────────────────────────

export interface AppState {
  currentPage: string;
  networkStatus: 'online' | 'offline';
  hasSwUpdate: boolean;
  isInitialized: boolean;
}

export interface SessionFields {
  surveyDate: string;
  baseDate: string;
  farmerName: string;
  label: string;
  treatment: string;
  treeNo: number;
}

export interface SurveyState {
  surveyType: SurveyType;
  currentRecord: Partial<GrowthRecord | QualityRecord>;
  lastField: string | null;
  sessionFields: SessionFields;
  isDirty: boolean;
}

export interface VoiceState {
  sttStatus: SttState;
  isTtsSpeaking: boolean;
  pendingField: string | null;
  pendingValue: string | null;
  interimText: string;
  lastEchoText: string;
  isCorrection: boolean;
  errorMessage: string | null;
}

export interface SyncState {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastSyncResult: SyncResult | null;
  syncError: string | null;
}

// ─────────────────────────────────────────────
// 파서 컨텍스트
// ─────────────────────────────────────────────

/**
 * ParserService.parse() 컨텍스트.
 */
export interface ParserContext {
  lastField: string | null;
  surveyType: SurveyType;
  activeFields: string[];
}

// ─────────────────────────────────────────────
// 검증 결과
// ─────────────────────────────────────────────

/**
 * validateField() 반환값.
 */
export interface FieldValidationResult {
  valid: boolean;
  warning: boolean;
  message: string;
}

/**
 * validateRecord() 반환값.
 */
export interface RecordValidationResult {
  isValid: boolean;
  hasWarning: boolean;
  errors: string[];
  warnings: string[];
}
