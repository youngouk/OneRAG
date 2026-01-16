/**
 * useChatStreaming 훅 단위 테스트
 *
 * WebSocket 기반 채팅 스트리밍 기능을 검증합니다.
 * - WebSocket 연결/해제
 * - 스트리밍 메시지 상태 관리
 * - 이벤트 핸들링
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// 이벤트 리스너 저장소 (hoisted mock에서 사용)
const eventListeners = new Map<string, ((...args: unknown[]) => void)[]>();

// Mock 함수들 (호이스팅 안전)
const mockFns = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  sendMessage: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  _isConnected: false,
};

// chatWebSocketService Mock - 호이스팅됨
vi.mock('../../../services/chatWebSocketService', () => ({
  chatWebSocketService: {
    get isConnected() {
      return mockFns._isConnected;
    },
    connect: (...args: unknown[]) => mockFns.connect(...args),
    disconnect: () => mockFns.disconnect(),
    sendMessage: (msg: string) => mockFns.sendMessage(msg),
    on: (event: string, callback: (...args: unknown[]) => void) => {
      mockFns.on(event, callback);
      if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
      }
      eventListeners.get(event)!.push(callback);
    },
    off: (event: string, callback: (...args: unknown[]) => void) => {
      mockFns.off(event, callback);
      const listeners = eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    },
  },
}));

// 이벤트 발생 헬퍼
const emitEvent = (event: string, data: unknown) => {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach(callback => callback(data));
  }
};

// useChatStreaming import (mock 설정 후)
import { useChatStreaming } from '../useChatStreaming';

describe('useChatStreaming', () => {
  const mockOnMessageComplete = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    eventListeners.clear();
    mockFns._isConnected = false;
    mockFns.connect.mockResolvedValue(undefined);
    mockFns.sendMessage.mockReturnValue('msg_test_123');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('초기 상태', () => {
    it('초기 상태가 올바르게 설정되어야 함', () => {
      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: 'test-session',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      expect(result.current.isConnected).toBe(false);
      expect(result.current.streamingState).toBe('idle');
      expect(result.current.streamingMessage).toBeNull();
    });
  });

  describe('연결 관리', () => {
    it('connect()를 호출하면 WebSocket 연결을 시도해야 함', async () => {
      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: 'test-session',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      expect(mockFns.connect).toHaveBeenCalledWith('test-session');
    });

    it('sessionId가 없으면 연결을 시도하지 않아야 함', async () => {
      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: '',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      expect(mockFns.connect).not.toHaveBeenCalled();
    });

    it('fallback 세션은 WebSocket 연결을 시도하지 않아야 함', async () => {
      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: 'fallback-session-123',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      expect(mockFns.connect).not.toHaveBeenCalled();
    });

    it('disconnect()를 호출하면 WebSocket 연결을 해제해야 함', () => {
      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: 'test-session',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      act(() => {
        result.current.disconnect();
      });

      expect(mockFns.disconnect).toHaveBeenCalled();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.streamingState).toBe('idle');
      expect(result.current.streamingMessage).toBeNull();
    });
  });

  describe('메시지 전송', () => {
    it('연결된 상태에서 sendStreamingMessage()를 호출하면 메시지를 전송해야 함', async () => {
      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: 'test-session',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      // 연결
      await act(async () => {
        await result.current.connect();
        // 연결 이벤트 시뮬레이션
        mockFns._isConnected = true;
        emitEvent('connection', { connected: true });
      });

      // isConnected를 true로 만들기 위해 상태 업데이트 대기
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // 메시지 전송
      let messageId: string | null = null;
      act(() => {
        messageId = result.current.sendStreamingMessage('안녕하세요');
      });

      expect(messageId).toBe('msg_test_123');
      expect(mockFns.sendMessage).toHaveBeenCalledWith('안녕하세요');
      expect(result.current.streamingState).toBe('streaming');
      expect(result.current.streamingMessage).not.toBeNull();
      expect(result.current.streamingMessage?.id).toBe('msg_test_123');
    });

    it('연결되지 않은 상태에서 sendStreamingMessage()를 호출하면 null을 반환해야 함', () => {
      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: 'test-session',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      let messageId: string | null = null;
      act(() => {
        messageId = result.current.sendStreamingMessage('테스트');
      });

      expect(messageId).toBeNull();
      expect(mockFns.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('스트리밍 이벤트 처리', () => {
    it('stream_start 이벤트 수신 시 streamingState가 streaming으로 변경되어야 함', async () => {
      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: 'test-session',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      // 연결
      await act(async () => {
        await result.current.connect();
        mockFns._isConnected = true;
        emitEvent('connection', { connected: true });
      });

      // stream_start 이벤트
      act(() => {
        emitEvent('stream_start', { message_id: 'msg-001' });
      });

      expect(result.current.streamingState).toBe('streaming');
    });

    it('stream_token 이벤트 수신 시 streamingMessage에 토큰이 누적되어야 함', async () => {
      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: 'test-session',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      await act(async () => {
        await result.current.connect();
        mockFns._isConnected = true;
        emitEvent('connection', { connected: true });
      });

      // 첫 번째 토큰
      act(() => {
        emitEvent('stream_token', { message_id: 'msg-001', token: '안녕' });
      });

      expect(result.current.streamingMessage?.content).toBe('안녕');

      // 두 번째 토큰 - 누적됨
      act(() => {
        emitEvent('stream_token', { message_id: 'msg-001', token: '하세요' });
      });

      expect(result.current.streamingMessage?.content).toBe('안녕하세요');
    });

    it('stream_sources 이벤트 수신 시 streamingMessage에 소스가 추가되어야 함', async () => {
      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: 'test-session',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      await act(async () => {
        await result.current.connect();
        mockFns._isConnected = true;
        emitEvent('connection', { connected: true });
      });

      // 먼저 토큰으로 메시지 시작
      act(() => {
        emitEvent('stream_token', { message_id: 'msg-001', token: '답변' });
      });

      // 소스 추가
      const sources = [
        { id: 'doc-1', title: '문서1', content: '내용1' },
        { id: 'doc-2', title: '문서2', content: '내용2' },
      ];

      act(() => {
        emitEvent('stream_sources', { message_id: 'msg-001', sources });
      });

      expect(result.current.streamingMessage?.sources).toEqual(sources);
    });

    it('stream_end 이벤트 수신 시 onMessageComplete 콜백이 호출되어야 함', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: 'test-session',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      await act(async () => {
        await result.current.connect();
        mockFns._isConnected = true;
        emitEvent('connection', { connected: true });
      });

      // 토큰 수신
      act(() => {
        emitEvent('stream_token', { message_id: 'msg-001', token: '완료된 응답' });
      });

      // 스트리밍 종료
      act(() => {
        emitEvent('stream_end', { message_id: 'msg-001' });
      });

      // setTimeout 실행
      await act(async () => {
        vi.runAllTimers();
      });

      expect(mockOnMessageComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-001',
          role: 'assistant',
          content: '완료된 응답',
        })
      );
      expect(result.current.streamingState).toBe('idle');
      expect(result.current.streamingMessage).toBeNull();

      vi.useRealTimers();
    });

    it('stream_error 이벤트 수신 시 onError 콜백이 호출되어야 함', async () => {
      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: 'test-session',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      await act(async () => {
        await result.current.connect();
        mockFns._isConnected = true;
        emitEvent('connection', { connected: true });
      });

      // 토큰 수신 (스트리밍 시작)
      act(() => {
        emitEvent('stream_token', { message_id: 'msg-001', token: '부분' });
      });

      // 에러 발생
      act(() => {
        emitEvent('stream_error', {
          message_id: 'msg-001',
          error_code: 'GEN-001',
          message: 'AI 모델 응답 지연',
          solutions: ['다시 시도해주세요'],
        });
      });

      expect(mockOnError).toHaveBeenCalledWith(
        'AI 모델 응답 지연\n해결 방법: 다시 시도해주세요'
      );
      expect(result.current.streamingState).toBe('error');
      expect(result.current.streamingMessage?.state).toBe('error');
    });

    it('reconnect_failed 이벤트 수신 시 onError 콜백이 호출되어야 함', async () => {
      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: 'test-session',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      await act(async () => {
        await result.current.connect();
        mockFns._isConnected = true;
        emitEvent('connection', { connected: true });
      });

      act(() => {
        emitEvent('reconnect_failed', { attempts: 5, maxAttempts: 5 });
      });

      expect(mockOnError).toHaveBeenCalledWith(
        '서버 연결이 끊어졌습니다. 페이지를 새로고침해주세요.'
      );
    });
  });

  describe('연결 상태 이벤트', () => {
    it('connection 이벤트 수신 시 isConnected 상태가 업데이트되어야 함', async () => {
      const { result } = renderHook(() =>
        useChatStreaming({
          sessionId: 'test-session',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      // 연결됨
      act(() => {
        mockFns._isConnected = true;
        emitEvent('connection', { connected: true });
      });

      expect(result.current.isConnected).toBe(true);

      // 연결 해제됨
      act(() => {
        mockFns._isConnected = false;
        emitEvent('connection', { connected: false });
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.streamingState).toBe('idle');
    });
  });

  describe('언마운트 정리', () => {
    it('컴포넌트 언마운트 시 이벤트 리스너가 제거되어야 함', async () => {
      const { unmount } = renderHook(() =>
        useChatStreaming({
          sessionId: 'test-session',
          onMessageComplete: mockOnMessageComplete,
          onError: mockOnError,
        })
      );

      // 이벤트 리스너가 등록되었는지 확인
      expect(mockFns.on).toHaveBeenCalled();

      // 언마운트
      unmount();

      // off가 호출되었는지 확인
      expect(mockFns.off).toHaveBeenCalled();
    });
  });
});
