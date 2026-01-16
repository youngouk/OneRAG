# Chat API DI 패턴 적용 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Chat API 서비스에 DI(Dependency Injection) 패턴을 적용하여 테스트 가능성을 높이고, 기존 WebSocketProvider와 동일한 구조로 통합

**Architecture:** 기존 `chatAPI` 전역 객체를 `IChatAPIService` 인터페이스 기반의 팩토리 패턴으로 리팩토링. `ChatAPIContext` + `ChatAPIProvider`로 DI 컨테이너 구성. 기존 코드와 100% 호환 유지.

**Tech Stack:** React 19, TypeScript, Axios, Vitest, React Testing Library

---

## 참조 파일 (기존 WebSocket DI 패턴)

구현 시 아래 파일들을 참조하여 동일한 패턴 적용:
- `src/types/websocket.ts` - 타입 정의 패턴
- `src/core/WebSocketContext.ts` - Context 정의 패턴
- `src/core/WebSocketProvider.tsx` - Provider 구현 패턴
- `src/core/useWebSocket.ts` - Hook 구현 패턴

---

## Task 1: 타입 정의 (IChatAPIService 인터페이스)

**Files:**
- Create: `src/types/chatAPI.ts`
- Test: `src/types/__tests__/chatAPI.test.ts`

**Step 1: 테스트 파일 작성**

```typescript
// src/types/__tests__/chatAPI.test.ts
import { describe, it, expect, vi } from 'vitest';
import type {
  IChatAPIService,
  ChatAPIConfig,
  ChatAPIFactory,
} from '../chatAPI';
import {
  DEFAULT_CHAT_API_CONFIG,
} from '../chatAPI';

describe('Chat API 타입 정의', () => {
  describe('IChatAPIService 인터페이스', () => {
    it('sendMessage 메서드 시그니처가 올바르다', () => {
      const mockService: IChatAPIService = {
        sendMessage: vi.fn().mockResolvedValue({
          answer: '테스트 응답',
          session_id: 'test-session',
          sources: [],
        }),
        getChatHistory: vi.fn(),
        startNewSession: vi.fn(),
        getSessionInfo: vi.fn(),
      };

      expect(mockService.sendMessage).toBeDefined();
      expect(typeof mockService.sendMessage).toBe('function');
    });

    it('getChatHistory 메서드 시그니처가 올바르다', () => {
      const mockService: IChatAPIService = {
        sendMessage: vi.fn(),
        getChatHistory: vi.fn().mockResolvedValue({ messages: [] }),
        startNewSession: vi.fn(),
        getSessionInfo: vi.fn(),
      };

      expect(mockService.getChatHistory).toBeDefined();
    });

    it('startNewSession 메서드 시그니처가 올바르다', () => {
      const mockService: IChatAPIService = {
        sendMessage: vi.fn(),
        getChatHistory: vi.fn(),
        startNewSession: vi.fn().mockResolvedValue({ session_id: 'new-session' }),
        getSessionInfo: vi.fn(),
      };

      expect(mockService.startNewSession).toBeDefined();
    });

    it('getSessionInfo 메서드 시그니처가 올바르다', () => {
      const mockService: IChatAPIService = {
        sendMessage: vi.fn(),
        getChatHistory: vi.fn(),
        startNewSession: vi.fn(),
        getSessionInfo: vi.fn().mockResolvedValue({
          session_id: 'test',
          messageCount: 0,
        }),
      };

      expect(mockService.getSessionInfo).toBeDefined();
    });
  });

  describe('ChatAPIConfig', () => {
    it('기본 설정값이 정의되어 있다', () => {
      expect(DEFAULT_CHAT_API_CONFIG).toBeDefined();
      expect(DEFAULT_CHAT_API_CONFIG.timeout).toBe(300000);
      expect(DEFAULT_CHAT_API_CONFIG.retries).toBe(3);
    });

    it('기본 설정은 모든 필수 속성을 포함한다', () => {
      expect(DEFAULT_CHAT_API_CONFIG.timeout).toBeGreaterThan(0);
      expect(DEFAULT_CHAT_API_CONFIG.retries).toBeGreaterThanOrEqual(0);
      expect(typeof DEFAULT_CHAT_API_CONFIG.baseURL).toBe('string');
    });
  });

  describe('ChatAPIFactory', () => {
    it('팩토리 함수 타입이 올바르다', () => {
      const mockFactory: ChatAPIFactory = (config) => ({
        sendMessage: vi.fn(),
        getChatHistory: vi.fn(),
        startNewSession: vi.fn(),
        getSessionInfo: vi.fn(),
      });

      const service = mockFactory({ timeout: 5000 });
      expect(service).toBeDefined();
      expect(service.sendMessage).toBeDefined();
    });
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

```bash
cd frontend && npm run test -- src/types/__tests__/chatAPI.test.ts
```

Expected: FAIL - 모듈을 찾을 수 없음

**Step 3: 타입 정의 파일 구현**

```typescript
// src/types/chatAPI.ts
/**
 * Chat API 타입 정의
 *
 * DI(Dependency Injection) 패턴을 위한 인터페이스와 타입 정의
 * WebSocket DI 패턴과 동일한 구조로 설계
 *
 * @example
 * import type { IChatAPIService, ChatAPIConfig } from '@/types/chatAPI';
 */

import type {
  ChatResponse,
  ChatHistoryEntry,
  SessionInfo,
} from './index';

// ============================================================================
// 서비스 인터페이스
// ============================================================================

/**
 * Chat API 서비스 인터페이스
 *
 * 모든 Chat API 구현체가 따라야 하는 계약
 * 테스트 시 Mock 서비스로 교체 가능
 */
export interface IChatAPIService {
  /**
   * 메시지 전송
   * @param message - 전송할 메시지 내용
   * @param sessionId - 세션 ID (선택, 없으면 localStorage에서 조회)
   * @returns 응답 데이터
   */
  sendMessage(message: string, sessionId?: string): Promise<ChatResponse>;

  /**
   * 채팅 기록 조회
   * @param sessionId - 세션 ID
   * @returns 채팅 기록 목록
   */
  getChatHistory(sessionId: string): Promise<{ messages: ChatHistoryEntry[] }>;

  /**
   * 새 세션 시작
   * @returns 새로 생성된 세션 ID
   */
  startNewSession(): Promise<{ session_id: string }>;

  /**
   * 세션 정보 조회
   * @param sessionId - 세션 ID
   * @returns 세션 상세 정보
   */
  getSessionInfo(sessionId: string): Promise<SessionInfo>;
}

// ============================================================================
// 설정 타입
// ============================================================================

/**
 * Chat API 설정
 *
 * API 연결 및 재시도 정책 설정
 */
export interface ChatAPIConfig {
  /** API 기본 URL */
  baseURL?: string;
  /** 요청 타임아웃 (ms) */
  timeout?: number;
  /** 재시도 횟수 */
  retries?: number;
  /** 재시도 간격 (ms) */
  retryDelay?: number;
}

/**
 * 기본 Chat API 설정
 *
 * 환경변수 또는 런타임 설정이 없을 때 사용되는 기본값
 */
export const DEFAULT_CHAT_API_CONFIG: Required<ChatAPIConfig> = {
  baseURL: typeof window !== 'undefined'
    ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
    : 'http://localhost:8000',
  timeout: 300000, // 5분 (대용량 문서 처리 대응)
  retries: 3,
  retryDelay: 1000,
};

// ============================================================================
// 팩토리 타입
// ============================================================================

/**
 * Chat API 서비스 팩토리 함수 타입
 *
 * 설정을 받아 IChatAPIService 인스턴스를 생성
 * DI 컨테이너에서 사용
 */
export type ChatAPIFactory = (config?: Partial<ChatAPIConfig>) => IChatAPIService;
```

**Step 4: 테스트 실행하여 통과 확인**

```bash
cd frontend && npm run test -- src/types/__tests__/chatAPI.test.ts
```

Expected: PASS

**Step 5: 커밋**

```bash
git add frontend/src/types/chatAPI.ts frontend/src/types/__tests__/chatAPI.test.ts
git commit -m "기능: Chat API DI 패턴을 위한 타입 정의 추가

- IChatAPIService 인터페이스 정의
- ChatAPIConfig 설정 타입 정의
- ChatAPIFactory 팩토리 타입 정의
- DEFAULT_CHAT_API_CONFIG 기본값 정의

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: 서비스 팩토리 함수 구현 (createChatAPIService)

**Files:**
- Create: `src/services/createChatAPIService.ts`
- Test: `src/services/__tests__/createChatAPIService.test.ts`

**Step 1: 테스트 파일 작성**

```typescript
// src/services/__tests__/createChatAPIService.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChatAPIService } from '../createChatAPIService';
import type { IChatAPIService } from '../../types/chatAPI';

// axios 모킹
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

describe('createChatAPIService', () => {
  let service: IChatAPIService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createChatAPIService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('팩토리 함수', () => {
    it('기본 설정으로 서비스를 생성한다', () => {
      expect(service).toBeDefined();
      expect(service.sendMessage).toBeDefined();
      expect(service.getChatHistory).toBeDefined();
      expect(service.startNewSession).toBeDefined();
      expect(service.getSessionInfo).toBeDefined();
    });

    it('커스텀 설정으로 서비스를 생성한다', () => {
      const customService = createChatAPIService({
        baseURL: 'https://custom-api.example.com',
        timeout: 60000,
      });

      expect(customService).toBeDefined();
      expect(customService.sendMessage).toBeDefined();
    });

    it('여러 번 호출해도 독립적인 인스턴스를 반환한다', () => {
      const service1 = createChatAPIService();
      const service2 = createChatAPIService();

      expect(service1).not.toBe(service2);
    });
  });

  describe('IChatAPIService 인터페이스 구현', () => {
    it('sendMessage는 함수다', () => {
      expect(typeof service.sendMessage).toBe('function');
    });

    it('getChatHistory는 함수다', () => {
      expect(typeof service.getChatHistory).toBe('function');
    });

    it('startNewSession는 함수다', () => {
      expect(typeof service.startNewSession).toBe('function');
    });

    it('getSessionInfo는 함수다', () => {
      expect(typeof service.getSessionInfo).toBe('function');
    });
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

```bash
cd frontend && npm run test -- src/services/__tests__/createChatAPIService.test.ts
```

Expected: FAIL - 모듈을 찾을 수 없음

**Step 3: 서비스 팩토리 구현**

```typescript
// src/services/createChatAPIService.ts
/**
 * Chat API 서비스 팩토리
 *
 * DI(Dependency Injection) 패턴을 위한 Chat API 서비스 팩토리 함수
 * 기존 chatAPI 객체와 동일한 기능을 제공하면서 주입 가능한 구조
 *
 * @example
 * // 프로덕션
 * const chatAPI = createChatAPIService();
 *
 * // 테스트
 * const mockChatAPI = createChatAPIService({ baseURL: 'http://mock' });
 */

import axios, { type AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import type {
  IChatAPIService,
  ChatAPIConfig,
} from '../types/chatAPI';
import { DEFAULT_CHAT_API_CONFIG } from '../types/chatAPI';
import type {
  ChatResponse,
  ChatHistoryEntry,
  SessionInfo,
} from '../types';
import { logger } from '../utils/logger';

/**
 * Axios 인스턴스 생성 및 설정
 */
function createAxiosInstance(config: Required<ChatAPIConfig>): AxiosInstance {
  const instance = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: false,
  });

  // 재시도 설정
  axiosRetry(instance, {
    retries: config.retries,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 429 ||
        (error.response?.status !== undefined && error.response.status >= 500)
      );
    },
    onRetry: (retryCount, error) => {
      logger.warn(`Chat API 재시도 (${retryCount}/${config.retries}):`, {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
      });
    },
  });

  // Request Interceptor: API Key, JWT, 세션 ID 추가
  instance.interceptors.request.use(
    (reqConfig) => {
      // API Key 추가
      const apiKey =
        import.meta.env.VITE_API_KEY ||
        (typeof window !== 'undefined' && window.RUNTIME_CONFIG?.API_KEY);
      if (apiKey) {
        reqConfig.headers['X-API-Key'] = apiKey;
      }

      // JWT Access Token 추가
      const tokens = localStorage.getItem('auth_tokens');
      if (tokens) {
        try {
          const { accessToken } = JSON.parse(tokens);
          if (accessToken) {
            reqConfig.headers.Authorization = `Bearer ${accessToken}`;
          }
        } catch (error) {
          logger.warn('JWT 토큰 파싱 실패:', error);
        }
      }

      // 세션 ID 추가 (새 세션 생성 요청 제외)
      const isNewSessionRequest =
        reqConfig.url === '/api/chat/session' &&
        reqConfig.method?.toLowerCase() === 'post';
      if (!isNewSessionRequest) {
        const sessionId = localStorage.getItem('chatSessionId');
        if (sessionId) {
          reqConfig.headers['X-Session-Id'] = sessionId;
        }
      }

      return reqConfig;
    },
    (error) => Promise.reject(error)
  );

  return instance;
}

/**
 * Chat API 서비스 팩토리 함수
 *
 * @param config - 선택적 설정 오버라이드
 * @returns IChatAPIService 구현체
 */
export function createChatAPIService(
  config?: Partial<ChatAPIConfig>
): IChatAPIService {
  // 설정 병합
  const mergedConfig: Required<ChatAPIConfig> = {
    ...DEFAULT_CHAT_API_CONFIG,
    ...config,
  };

  // Axios 인스턴스 생성
  const api = createAxiosInstance(mergedConfig);

  // IChatAPIService 구현
  return {
    async sendMessage(
      message: string,
      sessionId?: string
    ): Promise<ChatResponse> {
      const response = await api.post<ChatResponse>('/api/chat', {
        message,
        session_id: sessionId || localStorage.getItem('chatSessionId'),
      });
      return response.data;
    },

    async getChatHistory(
      sessionId: string
    ): Promise<{ messages: ChatHistoryEntry[] }> {
      const response = await api.get<{ messages: ChatHistoryEntry[] }>(
        `/api/chat/history/${sessionId}`
      );
      return response.data;
    },

    async startNewSession(): Promise<{ session_id: string }> {
      logger.log('새 세션 생성 요청:', { baseURL: mergedConfig.baseURL });
      const response = await api.post<{ session_id: string }>(
        '/api/chat/session',
        {},
        { timeout: 30000 }
      );
      return response.data;
    },

    async getSessionInfo(sessionId: string): Promise<SessionInfo> {
      const response = await api.get<SessionInfo>(
        `/api/chat/session/${sessionId}/info`
      );
      return response.data;
    },
  };
}

/**
 * 기본 Chat API 서비스 인스턴스
 *
 * 기존 코드 호환성을 위한 싱글톤 인스턴스
 * 새 코드는 createChatAPIService() 팩토리 사용 권장
 */
export const defaultChatAPIService = createChatAPIService();
```

**Step 4: 테스트 실행하여 통과 확인**

```bash
cd frontend && npm run test -- src/services/__tests__/createChatAPIService.test.ts
```

Expected: PASS

**Step 5: 커밋**

```bash
git add frontend/src/services/createChatAPIService.ts frontend/src/services/__tests__/createChatAPIService.test.ts
git commit -m "기능: Chat API 서비스 팩토리 함수 구현

- createChatAPIService() 팩토리 함수 구현
- Axios 인스턴스 설정 (재시도, 인터셉터)
- IChatAPIService 인터페이스 구현
- 기존 chatAPI와 동일한 API 제공

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Context 및 Provider 구현 (ChatAPIContext, ChatAPIProvider)

**Files:**
- Create: `src/core/ChatAPIContext.ts`
- Create: `src/core/ChatAPIProvider.tsx`
- Create: `src/core/useChatAPI.ts`
- Test: `src/core/__tests__/ChatAPIProvider.test.tsx`

**Step 1: 테스트 파일 작성**

```typescript
// src/core/__tests__/ChatAPIProvider.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import React from 'react';
import { ChatAPIProvider } from '../ChatAPIProvider';
import { useChatAPI, useChatAPIService } from '../useChatAPI';
import type { IChatAPIService } from '../../types/chatAPI';

// Mock 서비스 생성 헬퍼
const createMockChatAPIService = (): IChatAPIService => ({
  sendMessage: vi.fn().mockResolvedValue({
    answer: 'Mock 응답',
    session_id: 'mock-session',
    sources: [],
  }),
  getChatHistory: vi.fn().mockResolvedValue({ messages: [] }),
  startNewSession: vi.fn().mockResolvedValue({ session_id: 'new-mock-session' }),
  getSessionInfo: vi.fn().mockResolvedValue({
    session_id: 'mock-session',
    messageCount: 0,
  }),
});

describe('ChatAPIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('기본 동작', () => {
    it('children을 렌더링한다', () => {
      render(
        <ChatAPIProvider>
          <div data-testid="child">테스트 자식</div>
        </ChatAPIProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('기본 서비스를 제공한다', () => {
      const TestComponent = () => {
        const { chatAPI } = useChatAPI();
        return <div data-testid="has-api">{chatAPI ? 'yes' : 'no'}</div>;
      };

      render(
        <ChatAPIProvider>
          <TestComponent />
        </ChatAPIProvider>
      );

      expect(screen.getByTestId('has-api')).toHaveTextContent('yes');
    });
  });

  describe('커스텀 서비스 주입', () => {
    it('커스텀 서비스를 주입할 수 있다', () => {
      const mockService = createMockChatAPIService();

      const TestComponent = () => {
        const { chatAPI } = useChatAPI();
        return <div data-testid="service">{chatAPI === mockService ? 'mock' : 'default'}</div>;
      };

      render(
        <ChatAPIProvider service={mockService}>
          <TestComponent />
        </ChatAPIProvider>
      );

      expect(screen.getByTestId('service')).toHaveTextContent('mock');
    });

    it('주입된 서비스의 메서드를 호출할 수 있다', async () => {
      const mockService = createMockChatAPIService();

      const TestComponent = () => {
        const { chatAPI } = useChatAPI();
        React.useEffect(() => {
          chatAPI.sendMessage('테스트');
        }, [chatAPI]);
        return null;
      };

      render(
        <ChatAPIProvider service={mockService}>
          <TestComponent />
        </ChatAPIProvider>
      );

      expect(mockService.sendMessage).toHaveBeenCalledWith('테스트');
    });
  });

  describe('커스텀 설정', () => {
    it('커스텀 baseURL을 설정할 수 있다', () => {
      render(
        <ChatAPIProvider config={{ baseURL: 'https://custom.api.com' }}>
          <div data-testid="child">테스트</div>
        </ChatAPIProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });
});

describe('useChatAPI', () => {
  it('Provider 없이 사용하면 에러를 발생시킨다', () => {
    // 에러 로그 억제
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useChatAPI());
    }).toThrow('useChatAPI must be used within ChatAPIProvider');

    consoleSpy.mockRestore();
  });

  it('Provider 내에서 정상 동작한다', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ChatAPIProvider>{children}</ChatAPIProvider>
    );

    const { result } = renderHook(() => useChatAPI(), { wrapper });

    expect(result.current.chatAPI).toBeDefined();
    expect(result.current.config).toBeDefined();
  });
});

describe('useChatAPIService', () => {
  it('서비스만 반환한다', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ChatAPIProvider>{children}</ChatAPIProvider>
    );

    const { result } = renderHook(() => useChatAPIService(), { wrapper });

    expect(result.current).toBeDefined();
    expect(typeof result.current.sendMessage).toBe('function');
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

```bash
cd frontend && npm run test -- src/core/__tests__/ChatAPIProvider.test.tsx
```

Expected: FAIL - 모듈을 찾을 수 없음

**Step 3: Context 파일 구현**

```typescript
// src/core/ChatAPIContext.ts
/**
 * Chat API Context 정의
 *
 * WebSocketContext, ConfigContext와 동일한 패턴입니다.
 * React Fast Refresh 호환성을 위해 별도 파일로 분리했습니다.
 *
 * DI(Dependency Injection) 패턴을 적용하여:
 * - 프로덕션: 실제 Chat API 서비스 사용
 * - 테스트: Mock 서비스 주입 가능
 */

import { createContext } from 'react';
import type { IChatAPIService, ChatAPIConfig } from '../types/chatAPI';

/**
 * Chat API Context 값 타입
 *
 * Provider가 제공하는 값의 구조를 정의합니다.
 */
export interface ChatAPIContextValue {
  /**
   * Chat API 서비스
   *
   * IChatAPIService 인터페이스를 구현한 서비스 인스턴스
   * 테스트 시 Mock 서비스로 교체할 수 있습니다.
   */
  chatAPI: IChatAPIService;

  /**
   * Chat API 설정
   *
   * baseURL, timeout, retries 등의 설정입니다.
   * Required 타입으로 모든 속성이 정의되어 있습니다.
   */
  config: Required<ChatAPIConfig>;
}

/**
 * Chat API Context
 *
 * undefined 기본값으로 생성하여 Provider 없이 사용 시 에러를 발생시킵니다.
 * 이는 WebSocketContext, ConfigContext와 동일한 패턴입니다.
 */
export const ChatAPIContext = createContext<ChatAPIContextValue | undefined>(
  undefined
);

// React DevTools에서 Context 이름 표시
ChatAPIContext.displayName = 'ChatAPIContext';
```

**Step 4: Provider 파일 구현**

```typescript
// src/core/ChatAPIProvider.tsx
/**
 * Chat API Provider
 *
 * Chat API 서비스를 DI(Dependency Injection) 패턴으로 제공하는 Provider
 * WebSocketProvider와 동일한 패턴으로 구현
 *
 * @example
 * // 프로덕션
 * <ChatAPIProvider>
 *   <App />
 * </ChatAPIProvider>
 *
 * // 테스트
 * <ChatAPIProvider service={mockChatAPIService}>
 *   <ComponentUnderTest />
 * </ChatAPIProvider>
 */

import React, { useMemo, type ReactNode } from 'react';
import { ChatAPIContext, type ChatAPIContextValue } from './ChatAPIContext';
import { createChatAPIService } from '../services/createChatAPIService';
import type { IChatAPIService, ChatAPIConfig } from '../types/chatAPI';
import { DEFAULT_CHAT_API_CONFIG } from '../types/chatAPI';

/**
 * ChatAPIProvider Props
 */
interface ChatAPIProviderProps {
  /** 자식 컴포넌트 */
  children: ReactNode;

  /**
   * 커스텀 Chat API 서비스 (선택)
   *
   * 테스트 시 Mock 서비스를 주입할 때 사용합니다.
   * 제공하지 않으면 createChatAPIService()로 생성합니다.
   */
  service?: IChatAPIService;

  /**
   * Chat API 설정 (선택)
   *
   * baseURL, timeout, retries 등을 오버라이드할 때 사용합니다.
   */
  config?: Partial<ChatAPIConfig>;
}

/**
 * Chat API Provider 컴포넌트
 *
 * @param props - Provider props
 */
export function ChatAPIProvider({
  children,
  service,
  config,
}: ChatAPIProviderProps): React.ReactElement {
  // 설정 병합
  const mergedConfig = useMemo<Required<ChatAPIConfig>>(
    () => ({
      ...DEFAULT_CHAT_API_CONFIG,
      ...config,
    }),
    [config]
  );

  // Context 값 메모이제이션
  const contextValue = useMemo<ChatAPIContextValue>(() => {
    // 커스텀 서비스가 제공되면 사용, 아니면 팩토리로 생성
    const chatAPI = service ?? createChatAPIService(mergedConfig);

    return {
      chatAPI,
      config: mergedConfig,
    };
  }, [service, mergedConfig]);

  return (
    <ChatAPIContext.Provider value={contextValue}>
      {children}
    </ChatAPIContext.Provider>
  );
}

// React DevTools에서 컴포넌트 이름 표시
ChatAPIProvider.displayName = 'ChatAPIProvider';
```

**Step 5: Hook 파일 구현**

```typescript
// src/core/useChatAPI.ts
/**
 * Chat API 훅
 *
 * ChatAPIProvider에서 제공하는 Chat API 서비스에 접근하는 훅
 * WebSocket 훅(useWebSocket)과 동일한 패턴으로 구현
 *
 * @example
 * const { chatAPI, config } = useChatAPI();
 * const response = await chatAPI.sendMessage('안녕하세요');
 */

import { useContext } from 'react';
import { ChatAPIContext, type ChatAPIContextValue } from './ChatAPIContext';
import type { IChatAPIService, ChatAPIConfig } from '../types/chatAPI';

/**
 * Chat API Context 전체 값 반환
 *
 * @throws Provider 없이 사용 시 에러 발생
 * @returns Chat API 서비스와 설정
 */
export function useChatAPI(): ChatAPIContextValue {
  const context = useContext(ChatAPIContext);

  if (context === undefined) {
    throw new Error('useChatAPI must be used within ChatAPIProvider');
  }

  return context;
}

/**
 * Chat API 서비스만 반환
 *
 * @throws Provider 없이 사용 시 에러 발생
 * @returns Chat API 서비스
 */
export function useChatAPIService(): IChatAPIService {
  const { chatAPI } = useChatAPI();
  return chatAPI;
}

/**
 * Chat API 설정만 반환
 *
 * @throws Provider 없이 사용 시 에러 발생
 * @returns Chat API 설정
 */
export function useChatAPIConfig(): Required<ChatAPIConfig> {
  const { config } = useChatAPI();
  return config;
}
```

**Step 6: 테스트 실행하여 통과 확인**

```bash
cd frontend && npm run test -- src/core/__tests__/ChatAPIProvider.test.tsx
```

Expected: PASS

**Step 7: 커밋**

```bash
git add frontend/src/core/ChatAPIContext.ts frontend/src/core/ChatAPIProvider.tsx frontend/src/core/useChatAPI.ts frontend/src/core/__tests__/ChatAPIProvider.test.tsx
git commit -m "기능: Chat API Context 및 Provider 구현

- ChatAPIContext 정의 (WebSocketContext 패턴)
- ChatAPIProvider 구현 (서비스/설정 DI 지원)
- useChatAPI, useChatAPIService, useChatAPIConfig 훅 구현
- Provider 테스트 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Core 모듈 내보내기 업데이트

**Files:**
- Modify: `src/core/index.ts`
- Modify: `src/types/index.ts`

**Step 1: core/index.ts 업데이트**

```typescript
// src/core/index.ts에 아래 내용 추가
// (기존 내용 유지하고 아래 추가)

// Chat API 관련 (DI 패턴)
export { ChatAPIContext } from './ChatAPIContext';
export type { ChatAPIContextValue } from './ChatAPIContext';
export { ChatAPIProvider } from './ChatAPIProvider';
export {
  useChatAPI,
  useChatAPIService,
  useChatAPIConfig,
} from './useChatAPI';
```

**Step 2: types/index.ts 업데이트**

```typescript
// src/types/index.ts에 아래 내용 추가
// (기존 내용 유지하고 아래 추가)

// Chat API DI 패턴 타입
export type {
  IChatAPIService,
  ChatAPIConfig,
  ChatAPIFactory,
} from './chatAPI';
export { DEFAULT_CHAT_API_CONFIG } from './chatAPI';
```

**Step 3: TypeScript 타입 검사**

```bash
cd frontend && npm run lint
```

Expected: 에러 없음

**Step 4: 커밋**

```bash
git add frontend/src/core/index.ts frontend/src/types/index.ts
git commit -m "리팩터: Chat API DI 모듈 내보내기 추가

- core/index.ts에 ChatAPI 관련 내보내기 추가
- types/index.ts에 ChatAPI 타입 내보내기 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: App.tsx에 ChatAPIProvider 통합

**Files:**
- Modify: `src/App.tsx`
- Test: `src/__tests__/App.integration.test.tsx` (선택)

**Step 1: App.tsx 수정**

```typescript
// src/App.tsx에서 import 추가
import { ChatAPIProvider } from './core/ChatAPIProvider';

// Provider 계층에 ChatAPIProvider 추가 (WebSocketProvider 다음)
function App() {
  return (
    <ConfigProvider>
      <FeatureProvider>
        <WebSocketProvider>
          <ChatAPIProvider>  {/* 추가 */}
            <Router>
              <AppRoutes />
            </Router>
          </ChatAPIProvider>  {/* 추가 */}
        </WebSocketProvider>
      </FeatureProvider>
    </ConfigProvider>
  );
}
```

**Step 2: 빌드 테스트**

```bash
cd frontend && npm run build
```

Expected: 빌드 성공

**Step 3: 전체 테스트 실행**

```bash
cd frontend && npm run test:run
```

Expected: 모든 테스트 통과

**Step 4: 커밋**

```bash
git add frontend/src/App.tsx
git commit -m "기능: App.tsx에 ChatAPIProvider 통합

- Provider 계층에 ChatAPIProvider 추가
- ConfigProvider > FeatureProvider > WebSocketProvider > ChatAPIProvider 순서

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: useChatSession 훅 DI 버전 구현

**Files:**
- Create: `src/hooks/chat/useChatSessionWithDI.ts`
- Test: `src/hooks/chat/__tests__/useChatSessionWithDI.test.ts`

**Step 1: 테스트 파일 작성**

```typescript
// src/hooks/chat/__tests__/useChatSessionWithDI.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useChatSessionWithDI } from '../useChatSessionWithDI';
import { ChatAPIProvider } from '../../../core/ChatAPIProvider';
import type { IChatAPIService } from '../../../types/chatAPI';

// Mock 서비스 생성
const createMockService = (): IChatAPIService => ({
  sendMessage: vi.fn(),
  getChatHistory: vi.fn().mockResolvedValue({ messages: [] }),
  startNewSession: vi.fn().mockResolvedValue({ session_id: 'new-session-123' }),
  getSessionInfo: vi.fn(),
});

describe('useChatSessionWithDI', () => {
  let mockService: IChatAPIService;
  let mockShowToast: ReturnType<typeof vi.fn>;
  let mockSetMessages: ReturnType<typeof vi.fn>;
  let mockSetApiLogs: ReturnType<typeof vi.fn>;
  let mockSetSessionInfo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockService = createMockService();
    mockShowToast = vi.fn();
    mockSetMessages = vi.fn();
    mockSetApiLogs = vi.fn();
    mockSetSessionInfo = vi.fn();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ChatAPIProvider service={mockService}>{children}</ChatAPIProvider>
  );

  const defaultOptions = {
    showToast: mockShowToast,
    setMessages: mockSetMessages,
    setApiLogs: mockSetApiLogs,
    setSessionInfo: mockSetSessionInfo,
  };

  describe('세션 초기화', () => {
    it('저장된 세션 ID가 없으면 새 세션을 생성한다', async () => {
      const { result } = renderHook(
        () => useChatSessionWithDI(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSessionInitialized).toBe(true);
      });

      expect(mockService.startNewSession).toHaveBeenCalled();
      expect(result.current.sessionId).toBe('new-session-123');
    });

    it('저장된 세션 ID가 있으면 채팅 기록을 로드한다', async () => {
      localStorage.setItem('chatSessionId', 'existing-session');

      const { result } = renderHook(
        () => useChatSessionWithDI(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSessionInitialized).toBe(true);
      });

      expect(mockService.getChatHistory).toHaveBeenCalledWith('existing-session');
    });

    it('fallback 세션이면 새 세션을 생성한다', async () => {
      localStorage.setItem('chatSessionId', 'fallback-old-session');

      const { result } = renderHook(
        () => useChatSessionWithDI(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSessionInitialized).toBe(true);
      });

      expect(mockService.startNewSession).toHaveBeenCalled();
    });
  });

  describe('새 세션 시작', () => {
    it('handleNewSession 호출 시 새 세션을 생성한다', async () => {
      const { result } = renderHook(
        () => useChatSessionWithDI(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSessionInitialized).toBe(true);
      });

      await act(async () => {
        await result.current.handleNewSession();
      });

      // 초기화 + handleNewSession = 2번 호출
      expect(mockService.startNewSession).toHaveBeenCalledTimes(2);
      expect(mockSetMessages).toHaveBeenCalledWith([]);
    });
  });

  describe('에러 처리', () => {
    it('세션 생성 실패 시 fallback 세션을 사용한다', async () => {
      mockService.startNewSession = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(
        () => useChatSessionWithDI(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSessionInitialized).toBe(true);
      });

      expect(result.current.sessionId).toMatch(/^fallback-/);
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning' })
      );
    });
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

```bash
cd frontend && npm run test -- src/hooks/chat/__tests__/useChatSessionWithDI.test.ts
```

Expected: FAIL - 모듈을 찾을 수 없음

**Step 3: DI 버전 훅 구현**

```typescript
// src/hooks/chat/useChatSessionWithDI.ts
/**
 * 채팅 세션 관리 훅 (DI 버전)
 *
 * useChatSession의 DI 패턴 적용 버전
 * ChatAPIProvider에서 주입받은 서비스를 사용합니다.
 *
 * @example
 * const { sessionId, handleNewSession } = useChatSessionWithDI({
 *   showToast,
 *   setMessages,
 *   setApiLogs,
 *   setSessionInfo,
 * });
 */

import { useState, useCallback, useEffect } from 'react';
import { useChatAPIService } from '../../core/useChatAPI';
import { logger } from '../../utils/logger';
import type {
  ChatMessage,
  ApiLog,
  SessionInfo,
  ChatTabProps,
} from '../../types/chat';
import { mapHistoryEntryToChatMessage } from '../../utils/chat/mappers';

interface UseChatSessionWithDIOptions {
  showToast: ChatTabProps['showToast'];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setApiLogs: React.Dispatch<React.SetStateAction<ApiLog[]>>;
  setSessionInfo: React.Dispatch<React.SetStateAction<SessionInfo | null>>;
}

export function useChatSessionWithDI({
  showToast,
  setMessages,
  setApiLogs,
  setSessionInfo,
}: UseChatSessionWithDIOptions) {
  const chatAPI = useChatAPIService();
  const [sessionId, setSessionId] = useState<string>('');
  const [isSessionInitialized, setIsSessionInitialized] = useState<boolean>(false);

  const synchronizeSessionId = useCallback(
    (newSessionId: string, context: string = '') => {
      if (newSessionId && newSessionId !== sessionId) {
        logger.log(`세션 동기화 (${context}):`, {
          from: sessionId,
          to: newSessionId,
          context,
        });

        setSessionId(newSessionId);
        localStorage.setItem('chatSessionId', newSessionId);

        if (context.includes('불일치') || context.includes('복구')) {
          showToast({
            type: 'info',
            message: `세션이 동기화되었습니다. (${context})`,
          });
        }
        return true;
      }
      return false;
    },
    [sessionId, showToast]
  );

  const initializeSession = useCallback(async () => {
    if (isSessionInitialized) {
      logger.log('세션 초기화 이미 완료됨, 스킵');
      return;
    }

    let storedSessionId = localStorage.getItem('chatSessionId');
    if (storedSessionId && storedSessionId.startsWith('fallback-')) {
      logger.log('fallback 세션 감지, 백엔드 세션 생성을 재시도합니다:', storedSessionId);
      localStorage.removeItem('chatSessionId');
      storedSessionId = null;
    }

    try {
      if (storedSessionId) {
        logger.log('저장된 세션 ID로 초기화:', storedSessionId);
        setSessionId(storedSessionId);

        try {
          const historyData = await chatAPI.getChatHistory(storedSessionId);
          if (historyData.messages.length > 0) {
            const lastMessage = historyData.messages[historyData.messages.length - 1];
            const historySessionId = lastMessage?.session_id;

            if (historySessionId) {
              synchronizeSessionId(historySessionId, '기록 로드 시 불일치');
            }
          }

          const historyMessages = Array.isArray(historyData.messages)
            ? historyData.messages.map((msg, index) =>
                mapHistoryEntryToChatMessage(msg, index)
              )
            : [];

          setMessages(historyMessages);
          setIsSessionInitialized(true);
        } catch (historyError) {
          logger.warn('채팅 기록을 불러올 수 없습니다:', historyError);
          await createNewSession();
        }
      } else {
        await createNewSession();
      }
    } catch (error) {
      logger.error('세션 초기화 실패:', error);
      createFallbackSession();
    }
  }, [chatAPI, isSessionInitialized, setMessages, synchronizeSessionId]);

  const createNewSession = async () => {
    const startTime = Date.now();
    const requestLog: ApiLog = {
      id: `session-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'request',
      method: 'POST',
      endpoint: '/api/chat/session',
      data: {},
    };
    setApiLogs((prev) => [...prev, requestLog]);

    try {
      const response = await chatAPI.startNewSession();
      const duration = Date.now() - startTime;
      const newSessionId = response.session_id;

      const responseLog: ApiLog = {
        id: `session-res-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'response',
        method: 'POST',
        endpoint: '/api/chat/session',
        data: response,
        status: 200,
        duration,
      };
      setApiLogs((prev) => [...prev, responseLog]);

      setSessionId(newSessionId);
      localStorage.setItem('chatSessionId', newSessionId);
      setIsSessionInitialized(true);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorLog: ApiLog = {
        id: `session-err-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'response',
        method: 'POST',
        endpoint: '/api/chat/session',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        status: 0,
        duration,
      };
      setApiLogs((prev) => [...prev, errorLog]);

      createFallbackSession();
    }
  };

  const createFallbackSession = () => {
    const fallbackSessionId = `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    setSessionId(fallbackSessionId);
    localStorage.setItem('chatSessionId', fallbackSessionId);
    setIsSessionInitialized(true);

    showToast({
      type: 'warning',
      message: '백엔드 연결 실패. 오프라인 모드로 동작합니다.',
    });
  };

  useEffect(() => {
    if (!isSessionInitialized) {
      initializeSession();
    }
  }, [isSessionInitialized, initializeSession]);

  const handleNewSession = useCallback(async () => {
    try {
      logger.log('새 세션 시작 요청');
      const response = await chatAPI.startNewSession();
      const newSessionId = response.session_id;

      setSessionId(newSessionId);
      localStorage.setItem('chatSessionId', newSessionId);
      setMessages([]);
      setSessionInfo(null);

      showToast({
        type: 'success',
        message: '새로운 대화를 시작합니다.',
      });
    } catch (error) {
      logger.error('새 세션 시작 실패:', error);
      const fallbackSessionId = `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      setSessionId(fallbackSessionId);
      localStorage.setItem('chatSessionId', fallbackSessionId);
      setMessages([]);
      setSessionInfo(null);

      showToast({
        type: 'warning',
        message: '백엔드 연결 실패. 오프라인 모드로 새 세션을 시작합니다.',
      });
    }
  }, [chatAPI, showToast, setMessages, setSessionInfo]);

  return {
    sessionId,
    isSessionInitialized,
    synchronizeSessionId,
    handleNewSession,
  };
}
```

**Step 4: 테스트 실행하여 통과 확인**

```bash
cd frontend && npm run test -- src/hooks/chat/__tests__/useChatSessionWithDI.test.ts
```

Expected: PASS

**Step 5: 커밋**

```bash
git add frontend/src/hooks/chat/useChatSessionWithDI.ts frontend/src/hooks/chat/__tests__/useChatSessionWithDI.test.ts
git commit -m "기능: useChatSessionWithDI 훅 구현

- useChatSession의 DI 버전 구현
- ChatAPIProvider에서 주입받은 서비스 사용
- 기존 로직 100% 호환 유지
- 테스트 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: hooks/chat/index.ts 내보내기 업데이트

**Files:**
- Modify: `src/hooks/chat/index.ts`

**Step 1: index.ts 업데이트**

```typescript
// src/hooks/chat/index.ts에 아래 추가
export { useChatSessionWithDI } from './useChatSessionWithDI';
```

**Step 2: TypeScript 검사**

```bash
cd frontend && npm run lint
```

Expected: 에러 없음

**Step 3: 커밋**

```bash
git add frontend/src/hooks/chat/index.ts
git commit -m "리팩터: useChatSessionWithDI 내보내기 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: MockChatAPIService 테스트 유틸리티 추가

**Files:**
- Create: `src/test-utils/MockChatAPIService.ts`
- Modify: `src/test-utils/index.ts`

**Step 1: Mock 서비스 구현**

```typescript
// src/test-utils/MockChatAPIService.ts
/**
 * MockChatAPIService - 테스트용 Chat API Mock 서비스
 *
 * DI 패턴으로 주입하여 Chat API 동작을 시뮬레이션합니다.
 *
 * @example
 * const mockService = new MockChatAPIService();
 * render(
 *   <ChatAPIProvider service={mockService}>
 *     <ComponentUnderTest />
 *   </ChatAPIProvider>
 * );
 *
 * // 응답 설정
 * mockService.setNextResponse('sendMessage', { answer: '테스트' });
 *
 * // 호출 검증
 * expect(mockService.sendMessage).toHaveBeenCalledWith('안녕');
 */

import { vi } from 'vitest';
import type { IChatAPIService } from '../types/chatAPI';
import type { ChatResponse, ChatHistoryEntry, SessionInfo } from '../types';

/**
 * 테스트용 Mock Chat API 서비스
 */
export class MockChatAPIService implements IChatAPIService {
  /** 응답 큐 (메서드별) */
  private responseQueue: Map<string, unknown[]> = new Map();

  /** sendMessage Mock 함수 */
  sendMessage = vi.fn(
    async (message: string, sessionId?: string): Promise<ChatResponse> => {
      const response = this.getNextResponse<ChatResponse>('sendMessage');
      return (
        response ?? {
          answer: `Mock 응답: ${message}`,
          session_id: sessionId || 'mock-session',
          sources: [],
          tokens_used: 100,
          processing_time: 0.5,
        }
      );
    }
  );

  /** getChatHistory Mock 함수 */
  getChatHistory = vi.fn(
    async (sessionId: string): Promise<{ messages: ChatHistoryEntry[] }> => {
      const response = this.getNextResponse<{ messages: ChatHistoryEntry[] }>(
        'getChatHistory'
      );
      return response ?? { messages: [] };
    }
  );

  /** startNewSession Mock 함수 */
  startNewSession = vi.fn(async (): Promise<{ session_id: string }> => {
    const response = this.getNextResponse<{ session_id: string }>(
      'startNewSession'
    );
    return response ?? { session_id: `mock-session-${Date.now()}` };
  });

  /** getSessionInfo Mock 함수 */
  getSessionInfo = vi.fn(async (sessionId: string): Promise<SessionInfo> => {
    const response = this.getNextResponse<SessionInfo>('getSessionInfo');
    return (
      response ?? {
        session_id: sessionId,
        messageCount: 0,
        tokensUsed: 0,
        processingTime: 0,
        timestamp: new Date().toISOString(),
      }
    );
  });

  // ============================================================================
  // 테스트 헬퍼 메서드
  // ============================================================================

  /**
   * 다음 응답 설정
   *
   * @param method - 메서드 이름
   * @param response - 반환할 응답
   */
  setNextResponse<T>(method: keyof IChatAPIService, response: T): void {
    const queue = this.responseQueue.get(method) ?? [];
    queue.push(response);
    this.responseQueue.set(method, queue);
  }

  /**
   * 에러 응답 설정
   *
   * @param method - 메서드 이름
   * @param error - 발생시킬 에러
   */
  setNextError(method: keyof IChatAPIService, error: Error): void {
    const mockFn = this[method] as ReturnType<typeof vi.fn>;
    mockFn.mockRejectedValueOnce(error);
  }

  /**
   * 모든 Mock 초기화
   */
  reset(): void {
    this.sendMessage.mockClear();
    this.getChatHistory.mockClear();
    this.startNewSession.mockClear();
    this.getSessionInfo.mockClear();
    this.responseQueue.clear();
  }

  // ============================================================================
  // Private 메서드
  // ============================================================================

  private getNextResponse<T>(method: string): T | undefined {
    const queue = this.responseQueue.get(method);
    if (queue && queue.length > 0) {
      return queue.shift() as T;
    }
    return undefined;
  }
}

/**
 * MockChatAPIService 팩토리 함수
 *
 * @returns 새로운 MockChatAPIService 인스턴스
 */
export function createMockChatAPIService(): MockChatAPIService {
  return new MockChatAPIService();
}
```

**Step 2: test-utils/index.ts 업데이트**

```typescript
// src/test-utils/index.ts 내용 추가
export { MockChatAPIService, createMockChatAPIService } from './MockChatAPIService';
```

**Step 3: 테스트 실행**

```bash
cd frontend && npm run test:run
```

Expected: 모든 테스트 통과

**Step 4: 커밋**

```bash
git add frontend/src/test-utils/MockChatAPIService.ts frontend/src/test-utils/index.ts
git commit -m "기능: MockChatAPIService 테스트 유틸리티 추가

- IChatAPIService Mock 구현
- 응답 설정, 에러 시뮬레이션 헬퍼
- test-utils에서 내보내기

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: 전체 검증 및 문서 업데이트

**Files:**
- 전체 테스트 실행
- 빌드 검증
- TypeScript 타입 검사

**Step 1: 전체 테스트 실행**

```bash
cd frontend && npm run test:run
```

Expected: 모든 테스트 통과

**Step 2: TypeScript 검사**

```bash
cd frontend && npm run lint
```

Expected: 에러 없음

**Step 3: 프로덕션 빌드**

```bash
cd frontend && npm run build
```

Expected: 빌드 성공

**Step 4: 최종 커밋**

```bash
git add -A
git commit -m "문서: Chat API DI 패턴 구현 완료

- 전체 테스트 통과 확인
- 빌드 검증 완료
- TypeScript 타입 검사 통과

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## 요약

### 생성되는 파일 (8개)

| 파일 | 설명 |
|------|------|
| `src/types/chatAPI.ts` | 타입 정의 |
| `src/types/__tests__/chatAPI.test.ts` | 타입 테스트 |
| `src/services/createChatAPIService.ts` | 서비스 팩토리 |
| `src/services/__tests__/createChatAPIService.test.ts` | 팩토리 테스트 |
| `src/core/ChatAPIContext.ts` | Context 정의 |
| `src/core/ChatAPIProvider.tsx` | Provider 구현 |
| `src/core/useChatAPI.ts` | Hook 구현 |
| `src/core/__tests__/ChatAPIProvider.test.tsx` | Provider 테스트 |
| `src/hooks/chat/useChatSessionWithDI.ts` | 세션 훅 DI 버전 |
| `src/hooks/chat/__tests__/useChatSessionWithDI.test.ts` | 세션 훅 테스트 |
| `src/test-utils/MockChatAPIService.ts` | Mock 유틸리티 |

### 수정되는 파일 (4개)

| 파일 | 변경 내용 |
|------|----------|
| `src/App.tsx` | ChatAPIProvider 추가 |
| `src/core/index.ts` | ChatAPI 내보내기 추가 |
| `src/types/index.ts` | ChatAPI 타입 내보내기 추가 |
| `src/hooks/chat/index.ts` | DI 훅 내보내기 추가 |
| `src/test-utils/index.ts` | MockChatAPIService 내보내기 추가 |

### Provider 계층 구조 (최종)

```
<ConfigProvider>           // 1. 런타임 설정
  <FeatureProvider>        // 2. Feature 플래그
    <WebSocketProvider>    // 3. WebSocket DI
      <ChatAPIProvider>    // 4. Chat API DI ← 신규
        <Router>
          <AppRoutes />
        </Router>
      </ChatAPIProvider>
    </WebSocketProvider>
  </FeatureProvider>
</ConfigProvider>
```

---

## 예상 소요 시간

| Task | 예상 시간 |
|------|----------|
| Task 1: 타입 정의 | 15분 |
| Task 2: 서비스 팩토리 | 20분 |
| Task 3: Context/Provider | 25분 |
| Task 4: 내보내기 업데이트 | 5분 |
| Task 5: App.tsx 통합 | 10분 |
| Task 6: useChatSessionWithDI | 25분 |
| Task 7: hooks 내보내기 | 5분 |
| Task 8: MockChatAPIService | 15분 |
| Task 9: 전체 검증 | 10분 |
| **총계** | **약 2시간 30분** |
