/**
 * 채팅 스트리밍 WebSocket 메시지 프로토콜 타입 정의
 *
 * 이 파일은 프론트엔드와 백엔드 간의 WebSocket 통신에 사용되는
 * 모든 메시지 타입을 정의합니다.
 */

import { Source } from './index';

// ============================================
// 클라이언트 → 서버 메시지 타입
// ============================================

/**
 * 클라이언트에서 서버로 전송하는 메시지
 */
export interface ChatWebSocketRequest {
  type: 'message';
  message_id: string;
  content: string;
  session_id: string;
}

// ============================================
// 서버 → 클라이언트 메시지 타입
// ============================================

/**
 * 스트리밍 시작 메시지
 * 서버가 응답 생성을 시작했음을 알림
 *
 * 백엔드 스키마: app/api/schemas/websocket.py::StreamStartEvent
 */
export interface StreamStartMessage {
  type: 'stream_start';
  message_id: string;
  session_id: string;
  timestamp: string; // ISO 8601 형식
}

/**
 * 스트리밍 토큰 메시지
 * LLM이 생성한 토큰 조각을 전달
 *
 * 백엔드 스키마: app/api/schemas/websocket.py::StreamTokenEvent
 */
export interface StreamTokenMessage {
  type: 'stream_token';
  message_id: string;
  token: string;
  index: number; // 토큰 인덱스 (0부터 시작)
}

/**
 * 스트리밍 소스 메시지
 * RAG 검색 결과 (참조 문서) 전달
 */
export interface StreamSourcesMessage {
  type: 'stream_sources';
  message_id: string;
  sources: Source[];
}

/**
 * 스트리밍 완료 메시지
 * 응답 생성이 완료되었음을 알림
 *
 * 백엔드 스키마: app/api/schemas/websocket.py::StreamEndEvent
 */
export interface StreamEndMessage {
  type: 'stream_end';
  message_id: string;
  total_tokens: number;
  processing_time_ms: number;
}

/**
 * 스트리밍 에러 메시지
 * 응답 생성 중 오류 발생
 *
 * 백엔드 스키마: app/api/schemas/websocket.py::WSStreamErrorEvent
 */
export interface StreamErrorMessage {
  type: 'stream_error';
  message_id: string;
  error_code: string; // 예: GEN-001, SEARCH-003, WS-001-INVALID_JSON
  message: string; // 사용자 친화적 에러 메시지
  solutions: string[]; // 해결 방법 목록
}

/**
 * 서버에서 클라이언트로 전송되는 모든 메시지 타입 (Union Type)
 */
export type ChatWebSocketResponse =
  | StreamStartMessage
  | StreamTokenMessage
  | StreamSourcesMessage
  | StreamEndMessage
  | StreamErrorMessage;

// ============================================
// 상태 타입
// ============================================

/**
 * 스트리밍 연결/처리 상태
 */
export type StreamingState = 'idle' | 'connecting' | 'streaming' | 'error';

/**
 * 스트리밍 중인 메시지의 상태
 * 토큰이 누적되면서 업데이트됨
 */
export interface StreamingMessage {
  /** 메시지 고유 ID */
  id: string;
  /** 누적된 응답 텍스트 */
  content: string;
  /** RAG 소스 (스트리밍 완료 전에 수신 가능) */
  sources?: Source[];
  /** 현재 스트리밍 상태 */
  state: StreamingState;
  /** 에러 발생 시 에러 메시지 */
  error?: string;
}

// ============================================
// 이벤트 타입 (서비스 내부용)
// ============================================

/**
 * WebSocket 연결 상태 이벤트 데이터
 */
export interface ConnectionEventData {
  connected: boolean;
}

/**
 * 재연결 실패 이벤트 데이터
 */
export interface ReconnectFailedEventData {
  attempts: number;
  maxAttempts: number;
}

/**
 * 이벤트 리스너 콜백 타입
 */
export type EventCallback = (data: unknown) => void;
