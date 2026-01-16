/**
 * Chat API 타입 정의 테스트
 *
 * IChatAPIService 인터페이스와 관련 타입들의 정의를 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import type {
  IChatAPIService,
  ChatAPIConfig,
  ChatAPIFactory,
  ChatAPIResponse,
  ChatAPISessionInfo,
  ChatAPIHistoryEntry,
} from '../chatAPI';

describe('Chat API 타입 정의', () => {
  describe('IChatAPIService 인터페이스', () => {
    it('sendMessage 메서드 시그니처가 정의되어야 함', () => {
      const mockService: IChatAPIService = {
        sendMessage: async () => ({
          data: {
            answer: '테스트 응답',
            session_id: 'test-session',
            sources: [],
          },
        }),
        getChatHistory: async () => ({ data: { messages: [] } }),
        startNewSession: async () => ({ data: { session_id: 'new-session' } }),
        getSessionInfo: async () => ({
          data: {
            session_id: 'test',
            created_at: '2024-01-01',
            message_count: 0,
          },
        }),
      };

      expect(mockService.sendMessage).toBeDefined();
      expect(typeof mockService.sendMessage).toBe('function');
    });

    it('getChatHistory 메서드 시그니처가 정의되어야 함', () => {
      const mockService: IChatAPIService = {
        sendMessage: async () => ({
          data: { answer: '', session_id: '', sources: [] },
        }),
        getChatHistory: async () => ({ data: { messages: [] } }),
        startNewSession: async () => ({ data: { session_id: '' } }),
        getSessionInfo: async () => ({
          data: { session_id: '', created_at: '', message_count: 0 },
        }),
      };

      expect(mockService.getChatHistory).toBeDefined();
      expect(typeof mockService.getChatHistory).toBe('function');
    });

    it('startNewSession 메서드 시그니처가 정의되어야 함', () => {
      const mockService: IChatAPIService = {
        sendMessage: async () => ({
          data: { answer: '', session_id: '', sources: [] },
        }),
        getChatHistory: async () => ({ data: { messages: [] } }),
        startNewSession: async () => ({ data: { session_id: 'new' } }),
        getSessionInfo: async () => ({
          data: { session_id: '', created_at: '', message_count: 0 },
        }),
      };

      expect(mockService.startNewSession).toBeDefined();
      expect(typeof mockService.startNewSession).toBe('function');
    });

    it('getSessionInfo 메서드 시그니처가 정의되어야 함', () => {
      const mockService: IChatAPIService = {
        sendMessage: async () => ({
          data: { answer: '', session_id: '', sources: [] },
        }),
        getChatHistory: async () => ({ data: { messages: [] } }),
        startNewSession: async () => ({ data: { session_id: '' } }),
        getSessionInfo: async () => ({
          data: {
            session_id: 'info',
            created_at: '2024-01-01',
            message_count: 5,
          },
        }),
      };

      expect(mockService.getSessionInfo).toBeDefined();
      expect(typeof mockService.getSessionInfo).toBe('function');
    });
  });

  describe('ChatAPIConfig 타입', () => {
    it('필수 속성들이 정의되어야 함', () => {
      const config: ChatAPIConfig = {
        baseURL: 'http://localhost:8000',
        timeout: 30000,
      };

      expect(config.baseURL).toBe('http://localhost:8000');
      expect(config.timeout).toBe(30000);
    });

    it('선택적 속성들이 허용되어야 함', () => {
      const config: ChatAPIConfig = {
        baseURL: 'http://localhost:8000',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
      };

      expect(config.retryAttempts).toBe(3);
      expect(config.retryDelay).toBe(1000);
    });
  });

  describe('ChatAPIFactory 타입', () => {
    it('팩토리 함수 시그니처가 정의되어야 함', () => {
      // 팩토리 함수가 config를 받아서 IChatAPIService를 반환하는지 검증
      const factory: ChatAPIFactory = (config) => {
        // config가 타입 체크되는지 확인 (baseURL은 필수)
        expect(config.baseURL).toBeDefined();

        return {
          sendMessage: async () => ({
            data: { answer: '', session_id: '', sources: [] },
          }),
          getChatHistory: async () => ({ data: { messages: [] } }),
          startNewSession: async () => ({ data: { session_id: '' } }),
          getSessionInfo: async () => ({
            data: { session_id: '', created_at: '', message_count: 0 },
          }),
        };
      };

      expect(typeof factory).toBe('function');

      const service = factory({ baseURL: 'http://test', timeout: 1000 });
      expect(service.sendMessage).toBeDefined();
    });
  });

  describe('응답 타입들', () => {
    it('ChatAPIResponse 타입이 올바른 구조를 가져야 함', () => {
      const response: ChatAPIResponse = {
        answer: '테스트 답변',
        session_id: 'session-123',
        sources: [{ title: '문서1', content: '내용' }],
      };

      expect(response.answer).toBeDefined();
      expect(response.session_id).toBeDefined();
      expect(response.sources).toBeDefined();
    });

    it('ChatAPISessionInfo 타입이 올바른 구조를 가져야 함', () => {
      const info: ChatAPISessionInfo = {
        session_id: 'session-123',
        created_at: '2024-01-01T00:00:00Z',
        message_count: 10,
      };

      expect(info.session_id).toBeDefined();
      expect(info.created_at).toBeDefined();
      expect(info.message_count).toBeDefined();
    });

    it('ChatAPIHistoryEntry 타입이 올바른 구조를 가져야 함', () => {
      const entry: ChatAPIHistoryEntry = {
        role: 'user',
        content: '질문입니다',
        timestamp: '2024-01-01T00:00:00Z',
      };

      expect(entry.role).toBeDefined();
      expect(entry.content).toBeDefined();
      expect(entry.timestamp).toBeDefined();
    });
  });
});
