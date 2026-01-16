/**
 * WebSocket 타입 정의 테스트
 *
 * TDD 방식으로 먼저 테스트를 작성하고, 이후 타입 정의를 구현합니다.
 * 타입 체크는 컴파일 타임에 검증되며, 런타임 테스트로 구조를 확인합니다.
 */
import { describe, it, expect } from 'vitest';
import type {
  IWebSocket,
  WebSocketFactory,
  WebSocketConfig,
} from '../websocket';
import {
  WebSocketReadyState,
  defaultWebSocketFactory,
  defaultWebSocketConfig,
} from '../websocket';

describe('WebSocket 타입 정의', () => {
  describe('IWebSocket 인터페이스', () => {
    it('표준 WebSocket API를 따르는 인터페이스여야 함', () => {
      // 타입 체크 테스트 - 컴파일 타임에 검증됨
      const mockWebSocket: IWebSocket = {
        readyState: 0,
        send: () => {},
        close: () => {},
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
      };

      expect(mockWebSocket.readyState).toBe(0);
      expect(typeof mockWebSocket.send).toBe('function');
      expect(typeof mockWebSocket.close).toBe('function');
    });

    it('이벤트 핸들러를 설정할 수 있어야 함', () => {
      const mockWebSocket: IWebSocket = {
        readyState: 1,
        send: () => {},
        close: () => {},
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
      };

      // 이벤트 핸들러 설정
      mockWebSocket.onopen = () => {};
      mockWebSocket.onclose = () => {};
      mockWebSocket.onmessage = () => {};
      mockWebSocket.onerror = () => {};

      expect(typeof mockWebSocket.onopen).toBe('function');
      expect(typeof mockWebSocket.onclose).toBe('function');
      expect(typeof mockWebSocket.onmessage).toBe('function');
      expect(typeof mockWebSocket.onerror).toBe('function');
    });
  });

  describe('WebSocketReadyState 상수', () => {
    it('표준 WebSocket 상태 상수를 정의해야 함', () => {
      expect(WebSocketReadyState.CONNECTING).toBe(0);
      expect(WebSocketReadyState.OPEN).toBe(1);
      expect(WebSocketReadyState.CLOSING).toBe(2);
      expect(WebSocketReadyState.CLOSED).toBe(3);
    });
  });

  describe('WebSocketFactory 타입', () => {
    it('URL을 받아 IWebSocket을 반환해야 함', () => {
      const testUrl = 'ws://localhost:8080';
      let capturedUrl = '';

      const factory: WebSocketFactory = (url: string) => {
        capturedUrl = url;
        return {
          readyState: 0,
          send: () => {},
          close: () => {},
          onopen: null,
          onclose: null,
          onmessage: null,
          onerror: null,
        };
      };

      const ws = factory(testUrl);
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(0);
      expect(capturedUrl).toBe(testUrl);
    });
  });

  describe('WebSocketConfig 설정', () => {
    it('재연결 설정을 포함해야 함', () => {
      const config: WebSocketConfig = {
        maxReconnectAttempts: 5,
        reconnectInterval: 3000,
      };

      expect(config.maxReconnectAttempts).toBe(5);
      expect(config.reconnectInterval).toBe(3000);
    });

    it('연결 타임아웃 설정을 포함할 수 있어야 함', () => {
      const config: WebSocketConfig = {
        maxReconnectAttempts: 3,
        reconnectInterval: 1000,
        connectionTimeout: 10000,
      };

      expect(config.connectionTimeout).toBe(10000);
    });

    it('모든 설정은 선택적이어야 함', () => {
      const emptyConfig: WebSocketConfig = {};
      expect(emptyConfig).toEqual({});
    });
  });

  describe('defaultWebSocketConfig 기본값', () => {
    it('모든 필수 설정의 기본값을 제공해야 함', () => {
      expect(defaultWebSocketConfig.maxReconnectAttempts).toBe(5);
      expect(defaultWebSocketConfig.reconnectInterval).toBe(3000);
      expect(defaultWebSocketConfig.connectionTimeout).toBe(10000);
    });
  });

  describe('defaultWebSocketFactory 기본 팩토리', () => {
    it('함수로 정의되어야 함', () => {
      expect(typeof defaultWebSocketFactory).toBe('function');
    });

    // 참고: 실제 WebSocket 생성은 브라우저 환경에서만 동작
    // 여기서는 팩토리 함수의 존재만 확인
  });
});
