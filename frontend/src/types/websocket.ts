/**
 * WebSocket DI 패턴을 위한 타입 정의
 *
 * 기존 FeatureProvider, ConfigProvider와 동일한 패턴 적용
 * - 인터페이스 기반 추상화로 테스트 용이성 확보
 * - 팩토리 함수 타입으로 의존성 주입 지원
 * - 설정 타입으로 재연결 정책 관리
 *
 * @example
 * // 프로덕션: 실제 WebSocket 사용
 * const ws = defaultWebSocketFactory('ws://localhost:8000/ws/chat');
 *
 * // 테스트: Mock WebSocket 주입
 * const mockFactory: WebSocketFactory = () => createMockWebSocket();
 */

/**
 * WebSocket 인터페이스
 *
 * 표준 WebSocket API의 핵심 메서드만 추출하여 추상화합니다.
 * 이를 통해 테스트 시 Mock 객체 주입이 가능합니다.
 */
export interface IWebSocket {
  /**
   * 연결 상태
   * - 0: CONNECTING - 연결 시도 중
   * - 1: OPEN - 연결 완료
   * - 2: CLOSING - 종료 중
   * - 3: CLOSED - 종료됨
   */
  readonly readyState: number;

  /**
   * 데이터 전송
   * @param data - 전송할 데이터 (문자열, ArrayBuffer, Blob, ArrayBufferView)
   */
  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void;

  /**
   * 연결 종료
   * @param code - 종료 코드 (선택, 기본값: 1000)
   * @param reason - 종료 사유 (선택)
   */
  close(code?: number, reason?: string): void;

  /** 연결 성공 시 호출되는 핸들러 */
  onopen: ((event: Event) => void) | null;

  /** 연결 종료 시 호출되는 핸들러 */
  onclose: ((event: CloseEvent) => void) | null;

  /** 메시지 수신 시 호출되는 핸들러 */
  onmessage: ((event: MessageEvent) => void) | null;

  /** 에러 발생 시 호출되는 핸들러 */
  onerror: ((event: Event) => void) | null;
}

/**
 * WebSocket 상태 상수
 *
 * 표준 WebSocket.readyState 값과 동일합니다.
 * 상태 비교 시 매직 넘버 대신 이 상수를 사용하세요.
 *
 * @example
 * if (ws.readyState === WebSocketReadyState.OPEN) {
 *   ws.send(message);
 * }
 */
export const WebSocketReadyState = {
  /** 연결 시도 중 */
  CONNECTING: 0,
  /** 연결 완료, 통신 가능 */
  OPEN: 1,
  /** 종료 진행 중 */
  CLOSING: 2,
  /** 연결 종료됨 */
  CLOSED: 3,
} as const;

/**
 * WebSocket 상태 타입
 */
export type WebSocketReadyStateType =
  (typeof WebSocketReadyState)[keyof typeof WebSocketReadyState];

/**
 * WebSocket 팩토리 함수 타입
 *
 * DI 컨테이너에서 주입하는 핵심 타입입니다.
 * URL을 받아 IWebSocket 인스턴스를 반환합니다.
 *
 * @example
 * // 프로덕션
 * const factory: WebSocketFactory = (url) => new WebSocket(url);
 *
 * // 테스트
 * const mockFactory: WebSocketFactory = (url) => ({
 *   readyState: 0,
 *   send: vi.fn(),
 *   close: vi.fn(),
 *   onopen: null,
 *   onclose: null,
 *   onmessage: null,
 *   onerror: null,
 * });
 */
export type WebSocketFactory = (url: string) => IWebSocket;

/**
 * WebSocket 설정
 *
 * 재연결 정책 및 타임아웃 설정을 관리합니다.
 * 모든 설정은 선택적이며, 지정하지 않으면 defaultWebSocketConfig 값이 사용됩니다.
 */
export interface WebSocketConfig {
  /**
   * 최대 재연결 시도 횟수
   * @default 5
   */
  maxReconnectAttempts?: number;

  /**
   * 재연결 기본 간격 (밀리초)
   * 지수 백오프 적용 시 기본 간격으로 사용됩니다.
   * @default 3000
   */
  reconnectInterval?: number;

  /**
   * 연결 타임아웃 (밀리초)
   * 이 시간 내에 연결되지 않으면 에러로 처리됩니다.
   * @default 10000
   */
  connectionTimeout?: number;
}

/**
 * 기본 WebSocket 팩토리
 *
 * 실제 브라우저 WebSocket을 생성합니다.
 * 프로덕션 환경에서 사용됩니다.
 *
 * @param url - WebSocket 서버 URL (ws:// 또는 wss://)
 * @returns IWebSocket 인터페이스를 구현하는 WebSocket 인스턴스
 */
export const defaultWebSocketFactory: WebSocketFactory = (
  url: string
): IWebSocket => {
  return new WebSocket(url) as IWebSocket;
};

/**
 * 기본 WebSocket 설정
 *
 * 합리적인 기본값을 제공합니다.
 * - maxReconnectAttempts: 5회 (네트워크 일시 장애 대응)
 * - reconnectInterval: 3000ms (서버 부하 방지)
 * - connectionTimeout: 10000ms (느린 네트워크 대응)
 */
export const defaultWebSocketConfig: Required<WebSocketConfig> = {
  maxReconnectAttempts: 5,
  reconnectInterval: 3000,
  connectionTimeout: 10000,
};
