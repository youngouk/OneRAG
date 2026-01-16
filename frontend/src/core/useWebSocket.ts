/**
 * WebSocket 커스텀 훅
 *
 * WebSocketProvider 컨텍스트에 접근하기 위한 훅들을 제공합니다.
 * React Fast Refresh 호환성을 위해 별도 파일로 분리했습니다.
 */

import { useContext } from 'react';
import { WebSocketContext, WebSocketContextValue } from './WebSocketContext';
import type { WebSocketFactory, WebSocketConfig } from '../types/websocket';

/**
 * WebSocket Context 사용 훅
 *
 * WebSocketProvider 내부에서만 사용할 수 있습니다.
 * Provider 외부에서 호출하면 에러가 발생합니다.
 *
 * @returns WebSocket 팩토리와 설정을 포함한 Context 값
 * @throws Provider 없이 사용 시 에러
 *
 * @example
 * function ChatComponent() {
 *   const { createWebSocket, config } = useWebSocket();
 *   const ws = createWebSocket('ws://localhost:8000/ws/chat');
 *   // ...
 * }
 */
export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext);

  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }

  return context;
}

/**
 * WebSocket 팩토리만 사용하는 훅
 *
 * 설정은 필요 없고 팩토리만 필요한 경우 사용합니다.
 *
 * @returns WebSocket 생성 팩토리 함수
 *
 * @example
 * function ChatComponent() {
 *   const createWebSocket = useWebSocketFactory();
 *   const ws = createWebSocket('ws://localhost:8000/ws/chat');
 * }
 */
export function useWebSocketFactory(): WebSocketFactory {
  return useWebSocket().createWebSocket;
}

/**
 * WebSocket 설정만 사용하는 훅
 *
 * 팩토리는 필요 없고 설정만 필요한 경우 사용합니다.
 *
 * @returns WebSocket 설정 (Required 타입)
 *
 * @example
 * function ReconnectStatus() {
 *   const config = useWebSocketConfig();
 *   return <span>최대 재연결 횟수: {config.maxReconnectAttempts}</span>;
 * }
 */
export function useWebSocketConfig(): Required<WebSocketConfig> {
  return useWebSocket().config;
}
