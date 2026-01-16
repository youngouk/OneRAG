/**
 * ChatAPI Context/Provider 테스트
 *
 * ChatAPIContext, ChatAPIProvider, useChatAPI 훅의 동작을 검증합니다.
 * WebSocketProvider.test.tsx와 동일한 패턴입니다.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import { ChatAPIProvider } from '../ChatAPIProvider';
import { useChatAPI, useChatAPIService } from '../useChatAPI';
import type { IChatAPIService, ChatAPIConfig } from '../../types/chatAPI';
import type { ReactNode } from 'react';

/**
 * Mock 서비스 생성 헬퍼
 *
 * IChatAPIService 인터페이스를 완전히 구현하는 Mock 객체를 반환합니다.
 */
function createMockChatAPIService(): IChatAPIService {
  return {
    sendMessage: vi.fn().mockResolvedValue({
      data: { answer: 'mock answer', session_id: 'mock-session', sources: [] },
    }),
    getChatHistory: vi.fn().mockResolvedValue({
      data: { messages: [] },
    }),
    startNewSession: vi.fn().mockResolvedValue({
      data: { session_id: 'new-session' },
    }),
    getSessionInfo: vi.fn().mockResolvedValue({
      data: { session_id: 'mock-session', created_at: '2024-01-01', message_count: 0 },
    }),
  };
}

describe('ChatAPIContext', () => {
  describe('ChatAPIProvider', () => {
    it('children을 렌더링해야 함', () => {
      const mockFactory = vi.fn().mockReturnValue(createMockChatAPIService());

      render(
        <ChatAPIProvider createService={mockFactory} config={{ baseURL: 'http://test', timeout: 1000 }}>
          <div data-testid="child">Child Component</div>
        </ChatAPIProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('서비스 팩토리를 config와 함께 호출해야 함', () => {
      const mockFactory = vi.fn().mockReturnValue(createMockChatAPIService());
      const config: ChatAPIConfig = { baseURL: 'http://localhost:8000', timeout: 30000 };

      render(
        <ChatAPIProvider createService={mockFactory} config={config}>
          <div>Test</div>
        </ChatAPIProvider>
      );

      expect(mockFactory).toHaveBeenCalledWith(config);
    });
  });

  describe('useChatAPI 훅', () => {
    it('Provider 내에서 context 값을 반환해야 함', () => {
      const mockService = createMockChatAPIService();
      const mockFactory = vi.fn().mockReturnValue(mockService);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <ChatAPIProvider createService={mockFactory} config={{ baseURL: 'http://test', timeout: 1000 }}>
          {children}
        </ChatAPIProvider>
      );

      const { result } = renderHook(() => useChatAPI(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.service).toBe(mockService);
    });

    it('Provider 없이 사용하면 에러를 throw해야 함', () => {
      // React 18에서는 renderHook이 에러를 throw하면 콘솔에 에러가 출력됨
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useChatAPI());
      }).toThrow('useChatAPI must be used within a ChatAPIProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('useChatAPIService 훅', () => {
    it('서비스 인스턴스를 직접 반환해야 함', () => {
      const mockService = createMockChatAPIService();
      const mockFactory = vi.fn().mockReturnValue(mockService);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <ChatAPIProvider createService={mockFactory} config={{ baseURL: 'http://test', timeout: 1000 }}>
          {children}
        </ChatAPIProvider>
      );

      const { result } = renderHook(() => useChatAPIService(), { wrapper });

      expect(result.current).toBe(mockService);
      expect(result.current.sendMessage).toBeDefined();
    });
  });

  describe('config 변경', () => {
    it('config가 변경되면 새 서비스를 생성해야 함', () => {
      const mockFactory = vi.fn().mockReturnValue(createMockChatAPIService());

      const { rerender } = render(
        <ChatAPIProvider
          createService={mockFactory}
          config={{ baseURL: 'http://test1', timeout: 1000 }}
        >
          <div>Test</div>
        </ChatAPIProvider>
      );

      expect(mockFactory).toHaveBeenCalledTimes(1);

      rerender(
        <ChatAPIProvider
          createService={mockFactory}
          config={{ baseURL: 'http://test2', timeout: 2000 }}
        >
          <div>Test</div>
        </ChatAPIProvider>
      );

      // config 변경 시 새로운 서비스 생성
      expect(mockFactory).toHaveBeenCalledTimes(2);
    });
  });
});
