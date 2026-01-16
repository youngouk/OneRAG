# Hook 통합 계획: Core Hook + Wrapper 패턴

## 개요

**목표**: 600+ 라인의 중복 코드 제거, DI 패턴을 기본으로 채택하면서 하위 호환성 유지

**현재 문제**:
- `useChatSession.ts` (272 라인) ↔ `useChatSessionWithDI.ts` (344 라인): **99% 코드 중복**
- `useChatStreaming.ts` (286 라인) ↔ `useChatStreamingWithDI.ts` (307 라인): **95% 코드 중복**

**해결 방법**: Option A - Core Hook + Wrapper 패턴
```
┌─────────────────────────────────────────────────────────┐
│                    Public API                            │
├─────────────────────────────────────────────────────────┤
│  useChatSession()          useChatStreaming()           │
│       ↓                           ↓                     │
│  [DI: useChatAPIService()]  [DI: useWebSocket()]        │
│       ↓                           ↓                     │
│  useChatSessionCore()      useChatStreamingCore()       │
│  (순수 비즈니스 로직)       (순수 비즈니스 로직)          │
└─────────────────────────────────────────────────────────┘

별칭 (하위 호환):
- useChatSessionWithDI → useChatSession 재내보내기
- useChatStreamingWithDI → useChatStreaming 재내보내기
```

---

## Phase 1: useChatSession 통합

### Task 1.1: Core 훅 테스트 작성 (TDD Red)

**파일**: `src/hooks/chat/__tests__/useChatSessionCore.test.tsx`

**목적**: Core 훅이 주입받은 서비스로 올바르게 동작하는지 검증

```typescript
/**
 * useChatSessionCore 훅 테스트
 *
 * Core 훅은 IChatAPIService를 직접 주입받아 세션을 관리합니다.
 * DI 없이 순수하게 주입받은 서비스로 동작합니다.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatSessionCore } from '../useChatSessionCore';
import type { IChatAPIService } from '../../../types/chatAPI';

// localStorage mock
function createLocalStorageMock(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

// Mock 서비스 생성
function createMockChatAPIService(overrides?: Partial<IChatAPIService>): IChatAPIService {
  return {
    sendMessage: vi.fn().mockResolvedValue({
      data: { answer: 'mock answer', session_id: 'mock-session', sources: [] },
    }),
    getChatHistory: vi.fn().mockResolvedValue({
      data: { messages: [] },
    }),
    startNewSession: vi.fn().mockResolvedValue({
      data: { session_id: 'new-session-123' },
    }),
    getSessionInfo: vi.fn().mockResolvedValue({
      data: { session_id: 'mock-session', created_at: '2024-01-01', message_count: 0 },
    }),
    streamMessage: vi.fn(),
    ...overrides,
  };
}

describe('useChatSessionCore', () => {
  const defaultOptions = {
    showToast: vi.fn(),
    setMessages: vi.fn(),
    setApiLogs: vi.fn(),
    setSessionInfo: vi.fn(),
  };

  let mockLocalStorage: Storage;
  const originalLocalStorage = window.localStorage;

  beforeAll(() => {
    mockLocalStorage = createLocalStorageMock();
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
  });

  describe('서비스 주입', () => {
    it('주입받은 서비스로 새 세션을 생성해야 함', async () => {
      const mockService = createMockChatAPIService();

      const { result } = renderHook(() =>
        useChatSessionCore(mockService, defaultOptions)
      );

      await waitFor(() => {
        expect(result.current.isSessionInitialized).toBe(true);
      });

      expect(mockService.startNewSession).toHaveBeenCalled();
      expect(result.current.sessionId).toBe('new-session-123');
    });

    it('주입받은 서비스로 히스토리를 로드해야 함', async () => {
      localStorage.setItem('chatSessionId', 'existing-session');

      const mockGetChatHistory = vi.fn().mockResolvedValue({
        data: {
          messages: [
            { role: 'user', content: '안녕', timestamp: '2024-01-01', session_id: 'existing-session' },
          ],
        },
      });

      const mockService = createMockChatAPIService({
        getChatHistory: mockGetChatHistory,
      });

      const { result } = renderHook(() =>
        useChatSessionCore(mockService, defaultOptions)
      );

      await waitFor(() => {
        expect(result.current.isSessionInitialized).toBe(true);
      });

      expect(mockGetChatHistory).toHaveBeenCalledWith('existing-session');
      expect(result.current.sessionId).toBe('existing-session');
    });
  });

  describe('반환 타입 호환성', () => {
    it('기존 useChatSession과 동일한 반환 타입을 가져야 함', async () => {
      const mockService = createMockChatAPIService();

      const { result } = renderHook(() =>
        useChatSessionCore(mockService, defaultOptions)
      );

      await waitFor(() => {
        expect(result.current.isSessionInitialized).toBe(true);
      });

      // 반환 타입 검증
      expect(result.current).toHaveProperty('sessionId');
      expect(result.current).toHaveProperty('isSessionInitialized');
      expect(result.current).toHaveProperty('synchronizeSessionId');
      expect(result.current).toHaveProperty('handleNewSession');

      expect(typeof result.current.sessionId).toBe('string');
      expect(typeof result.current.isSessionInitialized).toBe('boolean');
      expect(typeof result.current.synchronizeSessionId).toBe('function');
      expect(typeof result.current.handleNewSession).toBe('function');
    });
  });
});
```

**검증**: `npm run test -- src/hooks/chat/__tests__/useChatSessionCore.test.tsx`
- 예상 결과: 테스트 실패 (useChatSessionCore 모듈 없음)

---

### Task 1.2: Core 훅 구현 (TDD Green)

**파일**: `src/hooks/chat/useChatSessionCore.ts`

**목적**: 비즈니스 로직을 서비스 주입 방식으로 추출

```typescript
/**
 * useChatSessionCore - 세션 관리 핵심 로직
 *
 * IChatAPIService를 직접 주입받아 세션을 관리하는 순수 훅입니다.
 * DI Context 없이 서비스를 직접 전달받아 동작합니다.
 *
 * @example
 * // Core 훅 직접 사용 (테스트 또는 특수 케이스)
 * const session = useChatSessionCore(mockService, options);
 *
 * // 일반적인 사용은 useChatSession() 권장
 */

import { useState, useCallback, useEffect } from 'react';
import { AxiosError } from 'axios';
import { logger } from '../../utils/logger';
import {
  ChatMessage,
  ApiLog,
  SessionInfo,
  ChatTabProps,
} from '../../types/chat';
import type { IChatAPIService } from '../../types/chatAPI';
import { mapHistoryEntryToChatMessage } from '../../utils/chat/mappers';

// Axios 에러 응답 타입 정의
interface ApiErrorResponse {
  message?: string;
  error?: string;
}

/**
 * useChatSessionCore 훅 옵션
 */
interface UseChatSessionCoreOptions {
  /** 토스트 메시지 표시 함수 */
  showToast: ChatTabProps['showToast'];
  /** 메시지 상태 설정 함수 */
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /** API 로그 상태 설정 함수 */
  setApiLogs: React.Dispatch<React.SetStateAction<ApiLog[]>>;
  /** 세션 정보 상태 설정 함수 */
  setSessionInfo: React.Dispatch<React.SetStateAction<SessionInfo | null>>;
}

/**
 * useChatSessionCore 반환 타입
 */
interface UseChatSessionCoreReturn {
  /** 현재 세션 ID */
  sessionId: string;
  /** 세션 초기화 완료 여부 */
  isSessionInitialized: boolean;
  /** 세션 ID 동기화 함수 */
  synchronizeSessionId: (newSessionId: string, context?: string) => boolean;
  /** 새 세션 시작 함수 */
  handleNewSession: () => Promise<void>;
}

/**
 * Fallback 세션 ID 생성
 */
function generateFallbackSessionId(): string {
  return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 세션 관리 핵심 훅
 *
 * @param chatAPI - 주입받은 Chat API 서비스
 * @param options - 훅 옵션
 * @returns 세션 관련 상태 및 함수
 */
export function useChatSessionCore(
  chatAPI: IChatAPIService,
  {
    showToast,
    setMessages,
    setApiLogs,
    setSessionInfo,
  }: UseChatSessionCoreOptions
): UseChatSessionCoreReturn {
  const [sessionId, setSessionId] = useState<string>('');
  const [isSessionInitialized, setIsSessionInitialized] = useState<boolean>(false);

  /**
   * 세션 ID 동기화
   */
  const synchronizeSessionId = useCallback((newSessionId: string, context: string = '') => {
    if (newSessionId && newSessionId !== sessionId) {
      logger.log(`세션 동기화 (${context}):`, {
        from: sessionId,
        to: newSessionId,
        context
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
  }, [sessionId, showToast]);

  /**
   * 세션 초기화
   */
  const initializeSession = useCallback(async () => {
    if (isSessionInitialized) {
      logger.log('세션 초기화 이미 완료됨, 스킵');
      return;
    }

    let storedSessionId = localStorage.getItem('chatSessionId');

    // fallback 세션이면 새로 생성
    if (storedSessionId && storedSessionId.startsWith('fallback-')) {
      logger.log('fallback 세션 감지, 백엔드 세션 생성을 재시도합니다:', storedSessionId);
      localStorage.removeItem('chatSessionId');
      storedSessionId = null;
    }

    try {
      if (storedSessionId) {
        // 기존 세션 복구 시도
        logger.log('저장된 세션 ID로 초기화:', storedSessionId);
        setSessionId(storedSessionId);

        try {
          const response = await chatAPI.getChatHistory(storedSessionId);
          if (response.data.messages.length > 0) {
            const lastMessage = response.data.messages[response.data.messages.length - 1];
            const historySessionId = lastMessage?.session_id;

            if (historySessionId) {
              synchronizeSessionId(historySessionId, '기록 로드 시 불일치');
            }
          }

          const historyMessages = Array.isArray(response.data.messages)
            ? response.data.messages.map((msg, index) => mapHistoryEntryToChatMessage(msg, index))
            : [];

          setMessages(historyMessages);
          setIsSessionInitialized(true);
        } catch (historyError) {
          // 히스토리 로드 실패 시 새 세션 생성
          logger.warn('채팅 기록을 불러올 수 없습니다:', historyError);
          logger.log('세션 유효성 검증을 위해 새 세션 생성');

          const startTime = Date.now();
          const requestLogId = `session-validate-${Date.now()}`;
          const requestLog: ApiLog = {
            id: requestLogId,
            timestamp: new Date().toISOString(),
            type: 'request',
            method: 'POST',
            endpoint: '/api/chat/session',
            data: {},
          };
          setApiLogs((prev) => [...prev, requestLog]);

          try {
            const newSessionResponse = await chatAPI.startNewSession();
            const duration = Date.now() - startTime;
            const validSessionId = newSessionResponse.data.session_id;

            const responseLog: ApiLog = {
              id: `session-validate-res-${Date.now()}`,
              timestamp: new Date().toISOString(),
              type: 'response',
              method: 'POST',
              endpoint: '/api/chat/session',
              data: newSessionResponse.data,
              status: newSessionResponse.status,
              duration,
            };
            setApiLogs((prev) => [...prev, responseLog]);

            setSessionId(validSessionId);
            localStorage.setItem('chatSessionId', validSessionId);
            setIsSessionInitialized(true);

            showToast({
              type: 'info',
              message: '새로운 세션으로 시작합니다.',
            });
          } catch (newSessionError: unknown) {
            const duration = Date.now() - startTime;
            const errorLog: ApiLog = {
              id: `session-validate-err-${Date.now()}`,
              timestamp: new Date().toISOString(),
              type: 'response',
              method: 'POST',
              endpoint: '/api/chat/session',
              data: {
                error: newSessionError instanceof Error ? newSessionError.message : 'Unknown error',
              },
              status: (newSessionError as AxiosError<ApiErrorResponse>)?.response?.status || 0,
              duration,
            };
            setApiLogs((prev) => [...prev, errorLog]);

            // fallback 세션 생성
            const fallbackSessionId = generateFallbackSessionId();
            setSessionId(fallbackSessionId);
            setIsSessionInitialized(true);

            showToast({
              type: 'warning',
              message: '백엔드 연결 실패. 오프라인 모드로 동작합니다.',
            });
          }
        }
      } else {
        // 새 세션 생성
        logger.log('새 세션 생성');
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
          const newSessionId = response.data.session_id;

          const responseLog: ApiLog = {
            id: `session-res-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'response',
            method: 'POST',
            endpoint: '/api/chat/session',
            data: response.data,
            status: response.status,
            duration,
          };
          setApiLogs((prev) => [...prev, responseLog]);

          setSessionId(newSessionId);
          localStorage.setItem('chatSessionId', newSessionId);
          setIsSessionInitialized(true);
        } catch (error: unknown) {
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
            status: (error as AxiosError<ApiErrorResponse>)?.response?.status || 0,
            duration,
          };
          setApiLogs((prev) => [...prev, errorLog]);

          // fallback 세션 생성
          const fallbackSessionId = generateFallbackSessionId();
          setSessionId(fallbackSessionId);
          setIsSessionInitialized(true);

          showToast({
            type: 'warning',
            message: '백엔드 연결 실패. 오프라인 모드로 동작합니다.',
          });
        }
      }
    } catch (error) {
      logger.error('세션 초기화 실패:', error);
      const fallbackSessionId = generateFallbackSessionId();
      setSessionId(fallbackSessionId);
      setIsSessionInitialized(true);
      showToast({
        type: 'warning',
        message: '백엔드 연결 실패. 오프라인 모드로 동작합니다.',
      });
    }
  }, [chatAPI, showToast, synchronizeSessionId, isSessionInitialized, setMessages, setApiLogs]);

  // 컴포넌트 마운트 시 세션 초기화
  useEffect(() => {
    if (!isSessionInitialized) {
      initializeSession();
    }
  }, [isSessionInitialized, initializeSession]);

  /**
   * 새 세션 시작
   */
  const handleNewSession = useCallback(async () => {
    try {
      logger.log('새 세션 시작 요청');
      const response = await chatAPI.startNewSession();
      const newSessionId = response.data.session_id;

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
      const fallbackSessionId = generateFallbackSessionId();
      setSessionId(fallbackSessionId);
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

// 타입 내보내기
export type { UseChatSessionCoreOptions, UseChatSessionCoreReturn };
```

**검증**: `npm run test -- src/hooks/chat/__tests__/useChatSessionCore.test.tsx`
- 예상 결과: 모든 테스트 통과

---

### Task 1.3: Wrapper 훅으로 useChatSession 리팩토링

**파일**: `src/hooks/chat/useChatSession.ts`

**목적**: DI Context를 사용하는 Wrapper로 변환

```typescript
/**
 * useChatSession - DI 패턴 세션 관리 훅
 *
 * ChatAPIProvider에서 주입받은 서비스를 사용하여 세션을 관리합니다.
 * 내부적으로 useChatSessionCore를 사용합니다.
 *
 * @example
 * // 일반적인 사용 (Provider 내에서)
 * const { sessionId, handleNewSession } = useChatSession(options);
 *
 * // 테스트 시에는 ChatAPIProvider로 Mock 서비스 주입
 * <ChatAPIProvider createService={() => mockService} config={config}>
 *   <ComponentUsingHook />
 * </ChatAPIProvider>
 */

import { useChatAPIService } from '../../core/useChatAPI';
import { useChatSessionCore } from './useChatSessionCore';
import type { UseChatSessionCoreOptions, UseChatSessionCoreReturn } from './useChatSessionCore';

/**
 * DI 패턴을 사용하는 채팅 세션 관리 훅
 *
 * @param options - 훅 옵션
 * @returns 세션 관련 상태 및 함수
 */
export function useChatSession(options: UseChatSessionCoreOptions): UseChatSessionCoreReturn {
  // DI Context에서 서비스 주입받기
  const chatAPI = useChatAPIService();

  // Core 훅에 서비스 전달
  return useChatSessionCore(chatAPI, options);
}

// 하위 호환성을 위한 별칭
export { useChatSession as useChatSessionWithDI };

// 타입 재내보내기
export type { UseChatSessionCoreOptions as UseChatSessionOptions };
export type { UseChatSessionCoreReturn as UseChatSessionReturn };
```

**검증**:
1. 기존 테스트 실행: `npm run test -- src/hooks/chat/__tests__/useChatSession.test.tsx`
2. DI 테스트 실행: `npm run test -- src/hooks/chat/__tests__/useChatSessionWithDI.test.tsx`

---

### Task 1.4: useChatSessionWithDI.ts 파일 제거 및 재내보내기

**파일**: `src/hooks/chat/useChatSessionWithDI.ts`

**변경**: 기존 파일을 삭제하고 useChatSession에서 재내보내기

```typescript
/**
 * useChatSessionWithDI - 하위 호환성 별칭
 *
 * @deprecated useChatSession을 직접 사용하세요.
 * 이 파일은 하위 호환성을 위해 유지됩니다.
 */

export { useChatSession as useChatSessionWithDI } from './useChatSession';
export type { UseChatSessionOptions, UseChatSessionReturn } from './useChatSession';
```

**검증**: 모든 기존 import가 동작하는지 확인
```bash
npm run test -- --run
npm run lint
npm run build
```

---

### Task 1.5: hooks/chat/index.ts 업데이트

**파일**: `src/hooks/chat/index.ts`

**목적**: Core 훅 내보내기 추가

```typescript
/**
 * Chat 관련 훅 내보내기
 */

// Session 관련
export { useChatSession, useChatSessionWithDI } from './useChatSession';
export { useChatSessionCore } from './useChatSessionCore';
export type {
  UseChatSessionOptions,
  UseChatSessionReturn,
} from './useChatSession';
export type {
  UseChatSessionCoreOptions,
  UseChatSessionCoreReturn,
} from './useChatSessionCore';

// Streaming 관련 (Phase 2에서 업데이트)
export { useChatStreaming } from './useChatStreaming';
export { useChatStreamingWithDI } from './useChatStreamingWithDI';

// 기타 훅들...
```

---

## Phase 2: useChatStreaming 통합

### Task 2.1: Core 훅 테스트 작성 (TDD Red)

**파일**: `src/hooks/chat/__tests__/useChatStreamingCore.test.tsx`

```typescript
/**
 * useChatStreamingCore 훅 테스트
 *
 * Core 훅은 IChatWebSocketService를 직접 주입받아 스트리밍을 관리합니다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatStreamingCore } from '../useChatStreamingCore';
import type { IChatWebSocketService } from '../../../types/chatWebSocket';

// Mock 서비스 생성
function createMockWebSocketService(): IChatWebSocketService {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendMessage: vi.fn(),
    onMessage: vi.fn(),
    onError: vi.fn(),
    onClose: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
  };
}

describe('useChatStreamingCore', () => {
  const defaultOptions = {
    sessionId: 'test-session-123',
    onStreamStart: vi.fn(),
    onStreamToken: vi.fn(),
    onStreamEnd: vi.fn(),
    onStreamError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('서비스 주입', () => {
    it('주입받은 서비스로 연결해야 함', () => {
      const mockService = createMockWebSocketService();

      const { result } = renderHook(() =>
        useChatStreamingCore(mockService, defaultOptions)
      );

      act(() => {
        result.current.connect();
      });

      expect(mockService.connect).toHaveBeenCalled();
    });

    it('주입받은 서비스로 메시지를 전송해야 함', () => {
      const mockService = createMockWebSocketService();
      mockService.isConnected = vi.fn().mockReturnValue(true);

      const { result } = renderHook(() =>
        useChatStreamingCore(mockService, defaultOptions)
      );

      act(() => {
        result.current.sendStreamingMessage('테스트 메시지');
      });

      expect(mockService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ content: '테스트 메시지' })
      );
    });
  });

  describe('반환 타입 호환성', () => {
    it('기존 useChatStreaming과 동일한 반환 타입을 가져야 함', () => {
      const mockService = createMockWebSocketService();

      const { result } = renderHook(() =>
        useChatStreamingCore(mockService, defaultOptions)
      );

      expect(result.current).toHaveProperty('isConnected');
      expect(result.current).toHaveProperty('isStreaming');
      expect(result.current).toHaveProperty('connect');
      expect(result.current).toHaveProperty('disconnect');
      expect(result.current).toHaveProperty('sendStreamingMessage');
    });
  });
});
```

---

### Task 2.2: Core 훅 구현 (TDD Green)

**파일**: `src/hooks/chat/useChatStreamingCore.ts`

(구현 내용은 useChatStreamingWithDI.ts에서 비즈니스 로직 추출)

---

### Task 2.3: Wrapper 훅으로 useChatStreaming 리팩토링

**파일**: `src/hooks/chat/useChatStreaming.ts`

```typescript
/**
 * useChatStreaming - DI 패턴 스트리밍 훅
 *
 * WebSocketProvider에서 주입받은 서비스를 사용합니다.
 */

import { useMemo } from 'react';
import { useWebSocket } from '../../core/useWebSocket';
import { createChatWebSocketService } from '../../services/chatWebSocketService';
import { useChatStreamingCore } from './useChatStreamingCore';
import type { UseChatStreamingCoreOptions, UseChatStreamingCoreReturn } from './useChatStreamingCore';

export function useChatStreaming(options: UseChatStreamingCoreOptions): UseChatStreamingCoreReturn {
  // DI Context에서 WebSocket 팩토리와 설정 주입받기
  const { createWebSocket, config } = useWebSocket();

  // 서비스 인스턴스 생성 (memoized)
  const service = useMemo(
    () => createChatWebSocketService(createWebSocket, config),
    [createWebSocket, config]
  );

  // Core 훅에 서비스 전달
  return useChatStreamingCore(service, options);
}

// 하위 호환성을 위한 별칭
export { useChatStreaming as useChatStreamingWithDI };
```

---

### Task 2.4: useChatStreamingWithDI.ts 파일 정리

기존 파일을 재내보내기로 변환 (Task 1.4와 동일 패턴)

---

## Phase 3: 최종 검증

### Task 3.1: 전체 테스트 실행

```bash
npm run test -- --run
```

예상 결과: 모든 테스트 통과

### Task 3.2: 타입 체크

```bash
npm run lint
npx tsc --noEmit
```

예상 결과: 에러 없음

### Task 3.3: 빌드 검증

```bash
npm run build
```

예상 결과: 성공적인 빌드

### Task 3.4: 코드 라인 수 비교

**변경 전**:
- useChatSession.ts: 272 라인
- useChatSessionWithDI.ts: 344 라인
- useChatStreaming.ts: 286 라인
- useChatStreamingWithDI.ts: 307 라인
- **총**: 1,209 라인

**변경 후**:
- useChatSessionCore.ts: ~270 라인 (비즈니스 로직)
- useChatSession.ts: ~25 라인 (Wrapper)
- useChatSessionWithDI.ts: ~5 라인 (재내보내기)
- useChatStreamingCore.ts: ~250 라인 (비즈니스 로직)
- useChatStreaming.ts: ~30 라인 (Wrapper)
- useChatStreamingWithDI.ts: ~5 라인 (재내보내기)
- **총**: ~585 라인

**절감**: 약 624 라인 (52% 감소)

---

## 실행 순서

1. **Phase 1**: useChatSession 통합 (Task 1.1 → 1.5)
2. **Phase 2**: useChatStreaming 통합 (Task 2.1 → 2.4)
3. **Phase 3**: 최종 검증 (Task 3.1 → 3.4)

각 Task는 TDD 원칙에 따라:
1. 테스트 작성 (Red)
2. 구현 (Green)
3. 리팩토링 (Refactor)
4. 검증

---

## 롤백 계획

문제 발생 시:
1. Git에서 이전 커밋으로 복원
2. 원본 파일들 복구:
   - `useChatSession.ts` (원본)
   - `useChatSessionWithDI.ts` (원본)
   - `useChatStreaming.ts` (원본)
   - `useChatStreamingWithDI.ts` (원본)
