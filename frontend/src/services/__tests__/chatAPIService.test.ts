/**
 * Chat API 서비스 팩토리 테스트
 *
 * createChatAPIService 함수의 동작을 검증합니다.
 * TDD 방식으로 작성된 테스트입니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { createChatAPIService } from '../chatAPIService';
import type { ChatAPIConfig } from '../../types/chatAPI';

// axios mock - defaults.headers.common 포함
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: vi.fn(),
      get: vi.fn(),
      defaults: {
        headers: {
          common: {},
        },
      },
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

describe('createChatAPIService', () => {
  const defaultConfig: ChatAPIConfig = {
    baseURL: 'http://localhost:8000',
    timeout: 30000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // localStorage mock
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('test-session-id');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('서비스 인스턴스 생성', () => {
    it('설정값으로 서비스 인스턴스를 생성해야 함', () => {
      const service = createChatAPIService(defaultConfig);

      expect(service).toBeDefined();
      expect(service.sendMessage).toBeDefined();
      expect(service.getChatHistory).toBeDefined();
      expect(service.startNewSession).toBeDefined();
      expect(service.getSessionInfo).toBeDefined();
    });

    it('axios.create를 올바른 설정으로 호출해야 함', () => {
      createChatAPIService(defaultConfig);

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://localhost:8000',
          timeout: 30000,
        })
      );
    });

    it('선택적 설정을 적용해야 함', () => {
      const configWithOptions: ChatAPIConfig = {
        ...defaultConfig,
        retryAttempts: 5,
        retryDelay: 2000,
        apiKey: 'test-api-key',
      };

      createChatAPIService(configWithOptions);

      expect(axios.create).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('메시지 전송 API를 호출해야 함', async () => {
      const mockResponse = {
        data: {
          answer: '테스트 응답',
          session_id: 'session-123',
          sources: [],
        },
      };

      const mockAxiosInstance = {
        post: vi.fn().mockResolvedValue(mockResponse),
        get: vi.fn(),
        defaults: { headers: { common: {} } },
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as never);

      const service = createChatAPIService(defaultConfig);
      const result = await service.sendMessage('안녕하세요', 'session-123');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          message: '안녕하세요',
          session_id: 'session-123',
        })
      );
      expect(result.data.answer).toBe('테스트 응답');
    });

    it('sessionId가 없으면 localStorage에서 가져와야 함', async () => {
      // localStorage mock을 동작하는 버전으로 교체
      const storage: Record<string, string> = {
        chatSessionId: 'stored-session-id',
      };
      const localStorageMock = {
        getItem: vi.fn((key: string) => storage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          storage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete storage[key];
        }),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      };
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
      });

      const mockAxiosInstance = {
        post: vi.fn().mockResolvedValue({ data: {} }),
        get: vi.fn(),
        defaults: { headers: { common: {} } },
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as never);

      const service = createChatAPIService(defaultConfig);
      await service.sendMessage('안녕하세요');

      expect(localStorageMock.getItem).toHaveBeenCalledWith('chatSessionId');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          session_id: 'stored-session-id',
        })
      );
    });
  });

  describe('getChatHistory', () => {
    it('채팅 히스토리 API를 호출해야 함', async () => {
      const mockResponse = {
        data: {
          messages: [
            { role: 'user', content: '안녕', timestamp: '2024-01-01' },
          ],
        },
      };

      const mockAxiosInstance = {
        post: vi.fn(),
        get: vi.fn().mockResolvedValue(mockResponse),
        defaults: { headers: { common: {} } },
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as never);

      const service = createChatAPIService(defaultConfig);
      const result = await service.getChatHistory('session-123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/chat/history/session-123'
      );
      expect(result.data.messages).toHaveLength(1);
    });
  });

  describe('startNewSession', () => {
    it('새 세션 생성 API를 호출해야 함', async () => {
      const mockResponse = {
        data: { session_id: 'new-session-456' },
      };

      const mockAxiosInstance = {
        post: vi.fn().mockResolvedValue(mockResponse),
        get: vi.fn(),
        defaults: { headers: { common: {} } },
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as never);

      const service = createChatAPIService(defaultConfig);
      const result = await service.startNewSession();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/chat/session',
        {},
        expect.objectContaining({ timeout: 30000 })
      );
      expect(result.data.session_id).toBe('new-session-456');
    });
  });

  describe('getSessionInfo', () => {
    it('세션 정보 조회 API를 호출해야 함', async () => {
      const mockResponse = {
        data: {
          session_id: 'session-123',
          created_at: '2024-01-01T00:00:00Z',
          message_count: 10,
        },
      };

      const mockAxiosInstance = {
        post: vi.fn(),
        get: vi.fn().mockResolvedValue(mockResponse),
        defaults: { headers: { common: {} } },
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as never);

      const service = createChatAPIService(defaultConfig);
      const result = await service.getSessionInfo('session-123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/chat/session/session-123/info'
      );
      expect(result.data.message_count).toBe(10);
    });
  });
});
