/**
 * store/VoiceStore.ts — 음성 입력 상태 스토어
 *
 * 목적: STT 상태, TTS 재생 여부, 인식 결과를 관리합니다.
 *       state-management.md의 VoiceStore 설계를 구현합니다.
 */
import { Observable } from './index.js';
// ─────────────────────────────────────────────
// 초기 상태
// ─────────────────────────────────────────────
const initialVoiceState = {
    sttStatus: 'idle',
    isTtsSpeaking: false,
    pendingField: null,
    pendingValue: null,
    interimText: '',
    lastEchoText: '',
    isCorrection: false,
    errorMessage: null,
};
// ─────────────────────────────────────────────
// VoiceStore 클래스
// ─────────────────────────────────────────────
class VoiceStore extends Observable {
    constructor() {
        super(initialVoiceState);
    }
    /**
     * STT 상태를 업데이트합니다.
     * SttService.onStateChange 콜백에서 호출됩니다.
     *
     * @param status 'idle' | 'listening' | 'processing'
     */
    setSttStatus(status) {
        this.setState({ sttStatus: status, errorMessage: null });
    }
    /**
     * TTS 재생 상태를 업데이트합니다.
     * TtsService.onEnd 콜백에서 false로 설정됩니다.
     *
     * @param speaking TTS 재생 중이면 true
     */
    setTtsSpeaking(speaking) {
        this.setState({ isTtsSpeaking: speaking });
    }
    /**
     * STT 중간 결과(isFinal=false)를 업데이트합니다.
     * 화면에 실시간으로 표시됩니다.
     *
     * @param text 중간 인식 텍스트
     */
    setInterimText(text) {
        this.setState({ interimText: text });
    }
    /**
     * 최종 인식 결과를 적용합니다.
     * pendingField, pendingValue, isCorrection을 업데이트합니다.
     *
     * @param result 파서 결과 (ParseResult)
     */
    setRecognitionResult(result) {
        this.setState({
            pendingField: result.field,
            pendingValue: result.value,
            isCorrection: result.isCorrection,
            sttStatus: 'processing',
            interimText: '',
        });
    }
    /**
     * TTS 에코 텍스트를 설정합니다.
     * TtsService.speak() 호출 전에 lastEchoText를 업데이트합니다.
     *
     * @param text TTS로 읽을 텍스트
     */
    setEchoText(text) {
        this.setState({ lastEchoText: text, isTtsSpeaking: true });
    }
    /**
     * 인식 오류 메시지를 설정합니다.
     *
     * @param msg 오류 메시지 또는 null
     */
    setError(msg) {
        this.setState({
            errorMessage: msg,
            sttStatus: 'idle',
            interimText: '',
        });
    }
    /**
     * TTS 에코 완료 후 pending 상태를 초기화합니다.
     */
    clearPending() {
        this.setState({
            pendingField: null,
            pendingValue: null,
            isCorrection: false,
            isTtsSpeaking: false,
        });
    }
}
// ─────────────────────────────────────────────
// 싱글턴 인스턴스
// ─────────────────────────────────────────────
export const voiceStore = new VoiceStore();
