/**
 * 테스트 유틸리티 모듈
 *
 * 테스트에서 사용하는 공통 Mock 클래스 및 헬퍼 함수 제공
 *
 * @example
 * import { MockWebSocket, createMockWebSocketFactory } from '@/test-utils';
 * import { MockChatAPIService, createMockChatAPIFactory } from '@/test-utils';
 */

// WebSocket Mock
export { MockWebSocket, createMockWebSocketFactory } from './MockWebSocket';

// Chat API Mock
export { MockChatAPIService, createMockChatAPIFactory } from './MockChatAPIService';
