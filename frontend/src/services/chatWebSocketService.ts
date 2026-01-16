/**
 * 채팅 스트리밍 WebSocket 서비스
 *
 * DI 패턴 적용 버전
 * - 내부적으로 createChatWebSocketService() 사용
 * - 기존 싱글톤 인터페이스 유지 (하위 호환성)
 */

import {
  createChatWebSocketService,
  IChatWebSocketService,
} from './createChatWebSocketService';
import { defaultWebSocketFactory } from '../types/websocket';

/**
 * 싱글톤 인스턴스
 *
 * 기본 WebSocket 팩토리 사용 (실제 브라우저 WebSocket)
 * 테스트에서는 createChatWebSocketService()를 직접 사용하여
 * Mock WebSocket 주입 가능
 */
export const chatWebSocketService: IChatWebSocketService =
  createChatWebSocketService(defaultWebSocketFactory);

export default chatWebSocketService;

// 타입 재내보내기
export type { IChatWebSocketService } from './createChatWebSocketService';
