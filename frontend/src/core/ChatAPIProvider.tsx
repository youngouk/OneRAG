/**
 * Chat API Provider 컴포넌트
 *
 * FeatureProvider, ConfigProvider, WebSocketProvider와 동일한 패턴입니다.
 *
 * DI(Dependency Injection) 패턴을 적용하여:
 * - 프로덕션: 실제 createChatAPIService 사용
 * - 테스트: createService prop으로 Mock 팩토리 주입
 *
 * @example
 * // 프로덕션
 * <ChatAPIProvider createService={createChatAPIService} config={defaultChatAPIConfig}>
 *   <App />
 * </ChatAPIProvider>
 *
 * @example
 * // 테스트
 * const mockFactory = createMockChatAPIFactory();
 * <ChatAPIProvider createService={mockFactory} config={testConfig}>
 *   <ComponentUnderTest />
 * </ChatAPIProvider>
 */

import React, { useMemo } from 'react';
import { ChatAPIContext, ChatAPIContextValue } from './ChatAPIContext';
import type { ChatAPIConfig, ChatAPIFactory } from '../types/chatAPI';

/**
 * ChatAPI Provider Props
 */
export interface ChatAPIProviderProps {
  /** 자식 컴포넌트 */
  children: React.ReactNode;
  /** 서비스 생성 함수 (팩토리) */
  createService: ChatAPIFactory;
  /** Chat API 설정 */
  config: ChatAPIConfig;
}

/**
 * ChatAPIProvider 컴포넌트
 *
 * Chat API 서비스를 자식 컴포넌트에 제공하는 Provider입니다.
 * WebSocketProvider와 동일한 패턴으로 설계되었습니다.
 *
 * @param props - Provider props
 */
export function ChatAPIProvider({
  children,
  createService,
  config,
}: ChatAPIProviderProps) {
  // config가 변경될 때만 서비스를 재생성
  // useMemo의 의존성 배열에 config 객체의 각 필드를 명시적으로 나열하여
  // 참조 동등성이 아닌 값 동등성으로 비교
  const service = useMemo(
    () => createService(config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createService, config.baseURL, config.timeout, config.apiKey, config.retryAttempts, config.retryDelay]
  );

  // Context 값 메모이제이션
  const value = useMemo<ChatAPIContextValue>(
    () => ({ service, config }),
    [service, config]
  );

  return (
    <ChatAPIContext.Provider value={value}>
      {children}
    </ChatAPIContext.Provider>
  );
}
