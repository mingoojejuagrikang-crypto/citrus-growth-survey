/**
 * store/Observable.ts — 경량 옵저버 패턴 기반 클래스
 *
 * 목적: 순환 의존성 방지를 위해 index.ts에서 분리된 독립 파일입니다.
 *       각 스토어는 이 파일에서 직접 import합니다.
 */

type Listener<T> = (state: Readonly<T>) => void;

/**
 * 경량 옵저버 패턴 기반 상태 관리 클래스.
 * 컴포넌트는 subscribe()로 구독하고, 상태 변경 시 자동 알림을 받습니다.
 *
 * 사용 패턴:
 * - mount() 시 subscribe() 호출
 * - unmount() 시 반환된 unsubscribe 함수 호출 (메모리 누수 방지)
 */
export class Observable<T extends object> {
  private state: T;
  private listeners: Set<Listener<T>> = new Set();

  constructor(initialState: T) {
    this.state = initialState;
  }

  /**
   * 현재 상태의 불변(frozen) 복사본을 반환합니다.
   */
  getState(): Readonly<T> {
    return Object.freeze({ ...this.state });
  }

  /**
   * 상태를 부분 업데이트하고 모든 구독자에게 알립니다.
   */
  protected setState(partial: Partial<T>): void {
    this.state = { ...this.state, ...partial };
    const frozenState = this.getState();
    this.listeners.forEach((fn) => fn(frozenState));
  }

  /**
   * 상태 변경 구독자를 등록합니다.
   * 등록 즉시 현재 상태로 한 번 호출됩니다.
   *
   * @returns unsubscribe 함수
   */
  subscribe(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    fn(this.getState());
    return () => this.listeners.delete(fn);
  }
}
