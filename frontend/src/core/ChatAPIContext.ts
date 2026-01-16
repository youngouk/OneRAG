/**
 * Chat API Context 정의
 *
 * FeatureContext, ConfigContext, WebSocketContext와 동일한 패턴입니다.
 * React Fast Refresh 호환성을 위해 별도 파일로 분리했습니다.
 *
 * DI(Dependency Injection) 패턴을 적용하여:
 * - 프로덕션: 실제 Chat API 서비스 사용
 * - 테스트: Mock 서비스 주입 가능
 */

import { createContext } from 'react';
import type { IChatAPIService, ChatAPIConfig } from '../types/chatAPI';

/**
 * ChatAPI Context 값 타입
 *
 * Provider가 제공하는 값의 구조를 정의합니다.
 */
export interface ChatAPIContextValue {
  /** Chat API 서비스 인스턴스 */
  service: IChatAPIService;
  /** 현재 설정 */
  config: ChatAPIConfig;
}

/**
 * ChatAPI Context
 *
 * undefined가 기본값이며, Provider 없이 사용 시 에러 발생합니다.
 * WebSocketContext와 동일한 패턴입니다.
 */
export const ChatAPIContext = createContext<ChatAPIContextValue | undefined>(undefined);

// React DevTools에서 Context 이름 표시
ChatAPIContext.displayName = 'ChatAPIContext';
