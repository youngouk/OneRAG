/**
 * WebSocket Provider 컴포넌트
 *
 * FeatureProvider, ConfigProvider와 동일한 패턴입니다.
 *
 * DI(Dependency Injection) 패턴을 적용하여:
 * - 프로덕션: 기본 WebSocket 팩토리 사용
 * - 테스트: factory prop으로 Mock 팩토리 주입
 *
 * @example
 * // 프로덕션
 * <WebSocketProvider>
 *   <App />
 * </WebSocketProvider>
 *
 * @example
 * // 테스트
 * const mockFactory: WebSocketFactory = (url) => createMockWebSocket(url);
 * <WebSocketProvider factory={mockFactory}>
 *   <ComponentUnderTest />
 * </WebSocketProvider>
 */

import React, { useMemo } from 'react';
import { WebSocketContext, WebSocketContextValue } from './WebSocketContext';
import type { WebSocketFactory, WebSocketConfig } from '../types/websocket';
import {
  defaultWebSocketFactory,
  defaultWebSocketConfig,
} from '../types/websocket';

/**
 * WebSocketProvider Props
 */
interface WebSocketProviderProps {
  /** 자식 컴포넌트 */
  children: React.ReactNode;

  /**
   * 커스텀 WebSocket 팩토리
   *
   * 테스트 시 Mock 팩토리를 주입할 수 있습니다.
   * 지정하지 않으면 defaultWebSocketFactory가 사용됩니다.
   */
  factory?: WebSocketFactory;

  /**
   * 커스텀 설정
   *
   * 일부 설정만 오버라이드할 수 있습니다.
   * 지정하지 않은 설정은 defaultWebSocketConfig 값이 사용됩니다.
   */
  config?: Partial<WebSocketConfig>;
}

/**
 * WebSocket Provider 컴포넌트
 *
 * WebSocket 관련 의존성을 Context를 통해 주입합니다.
 * 모든 자식 컴포넌트에서 useWebSocket 훅으로 접근할 수 있습니다.
 */
export function WebSocketProvider({
  children,
  factory,
  config,
}: WebSocketProviderProps) {
  // Context 값을 메모이제이션하여 불필요한 리렌더링 방지
  const value = useMemo<WebSocketContextValue>(
    () => ({
      createWebSocket: factory ?? defaultWebSocketFactory,
      config: {
        ...defaultWebSocketConfig,
        ...config,
      },
    }),
    [factory, config]
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
