/**
 * WebSocket Context 정의
 *
 * FeatureContext, ConfigContext와 동일한 패턴입니다.
 * React Fast Refresh 호환성을 위해 별도 파일로 분리했습니다.
 *
 * DI(Dependency Injection) 패턴을 적용하여:
 * - 프로덕션: 실제 WebSocket 사용
 * - 테스트: Mock WebSocket 주입 가능
 */

import { createContext } from 'react';
import type { WebSocketFactory, WebSocketConfig } from '../types/websocket';

/**
 * WebSocket Context 값 타입
 *
 * Provider가 제공하는 값의 구조를 정의합니다.
 */
export interface WebSocketContextValue {
  /**
   * WebSocket 생성 팩토리
   *
   * URL을 받아 IWebSocket 인스턴스를 반환합니다.
   * 테스트 시 Mock 팩토리로 교체할 수 있습니다.
   */
  createWebSocket: WebSocketFactory;

  /**
   * WebSocket 설정
   *
   * 재연결 정책, 타임아웃 등의 설정입니다.
   * Required 타입으로 모든 속성이 정의되어 있습니다.
   */
  config: Required<WebSocketConfig>;
}

/**
 * WebSocket Context
 *
 * undefined 기본값으로 생성하여 Provider 없이 사용 시 에러를 발생시킵니다.
 * 이는 FeatureContext, ConfigContext와 동일한 패턴입니다.
 */
export const WebSocketContext = createContext<WebSocketContextValue | undefined>(
  undefined
);

// React DevTools에서 Context 이름 표시
WebSocketContext.displayName = 'WebSocketContext';
