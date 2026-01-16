/**
 * MockChatAPIService - 테스트용 Chat API Mock 클래스
 *
 * DI 패턴으로 주입하여 Chat API 동작을 시뮬레이션합니다.
 * - 응답 큐잉으로 순차적 응답 제어
 * - 에러 시뮬레이션
 * - 호출 추적 및 검증
 *
 * @example
 * import { MockChatAPIService, createMockChatAPIFactory } from '@/test-utils/MockChatAPIService';
 *
 * // Provider에서 사용
 * const mockFactory = createMockChatAPIFactory();
 * <ChatAPIProvider createService={mockFactory} config={config}>
 *   <App />
 * </ChatAPIProvider>
 *
 * // 응답 설정
 * const mockService = MockChatAPIService.getLastInstance();
 * mockService?.setNextResponse('sendMessage', { answer: '안녕하세요' });
 *
 * // 에러 시뮬레이션
 * mockService?.setNextError('startNewSession', new Error('Network error'));
 */

import { vi, type Mock } from 'vitest';
import type { AxiosResponse } from 'axios';
import type {
  IChatAPIService,
  ChatAPIConfig,
  ChatAPIResponse,
  ChatAPISessionInfo,
  ChatAPIHistoryEntry,
} from '../types/chatAPI';

/**
 * 기본 Axios 응답 래퍼 생성
 */
function createAxiosResponse<T>(data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config: {
      headers: {},
    } as AxiosResponse['config'],
  };
}

/**
 * 테스트용 Mock Chat API Service 클래스
 *
 * IChatAPIService 인터페이스를 구현하여 실제 서비스와 동일한 API 제공
 */
export class MockChatAPIService implements IChatAPIService {
  /** 생성된 모든 MockChatAPIService 인스턴스 추적 */
  static instances: MockChatAPIService[] = [];

  /** 메서드별 응답 큐 */
  private responseQueues: Map<string, unknown[]> = new Map();

  /** 메서드별 에러 큐 */
  private errorQueues: Map<string, Error[]> = new Map();

  /** 설정 저장 */
  public config: ChatAPIConfig;

  /** Mock 함수들 (호출 추적용) */
  public sendMessageMock: Mock;
  public getChatHistoryMock: Mock;
  public startNewSessionMock: Mock;
  public getSessionInfoMock: Mock;

  /**
   * MockChatAPIService 생성자
   * @param config - Chat API 설정
   */
  constructor(config: ChatAPIConfig) {
    this.config = config;
    MockChatAPIService.instances.push(this);

    // Mock 함수 초기화
    this.sendMessageMock = vi.fn();
    this.getChatHistoryMock = vi.fn();
    this.startNewSessionMock = vi.fn();
    this.getSessionInfoMock = vi.fn();
  }

  // ============================================================================
  // IChatAPIService 인터페이스 구현
  // ============================================================================

  /**
   * 메시지 전송 Mock
   */
  async sendMessage(
    message: string,
    sessionId?: string
  ): Promise<AxiosResponse<ChatAPIResponse>> {
    this.sendMessageMock(message, sessionId);

    // 에러가 큐에 있으면 throw
    const error = this.getNextError('sendMessage');
    if (error) {
      throw error;
    }

    // 응답 큐에서 가져오거나 기본값 반환
    const response = this.getNextResponse<ChatAPIResponse>('sendMessage') ?? {
      answer: 'Mock 응답입니다.',
      session_id: sessionId || 'mock-session-id',
      sources: [],
    };

    return createAxiosResponse(response);
  }

  /**
   * 채팅 히스토리 조회 Mock
   */
  async getChatHistory(
    sessionId: string
  ): Promise<AxiosResponse<{ messages: ChatAPIHistoryEntry[] }>> {
    this.getChatHistoryMock(sessionId);

    const error = this.getNextError('getChatHistory');
    if (error) {
      throw error;
    }

    const response = this.getNextResponse<{ messages: ChatAPIHistoryEntry[] }>('getChatHistory') ?? {
      messages: [],
    };

    return createAxiosResponse(response);
  }

  /**
   * 새 세션 시작 Mock
   */
  async startNewSession(): Promise<AxiosResponse<{ session_id: string }>> {
    this.startNewSessionMock();

    const error = this.getNextError('startNewSession');
    if (error) {
      throw error;
    }

    const response = this.getNextResponse<{ session_id: string }>('startNewSession') ?? {
      session_id: `mock-session-${Date.now()}`,
    };

    return createAxiosResponse(response);
  }

  /**
   * 세션 정보 조회 Mock
   */
  async getSessionInfo(
    sessionId: string
  ): Promise<AxiosResponse<ChatAPISessionInfo>> {
    this.getSessionInfoMock(sessionId);

    const error = this.getNextError('getSessionInfo');
    if (error) {
      throw error;
    }

    const response = this.getNextResponse<ChatAPISessionInfo>('getSessionInfo') ?? {
      session_id: sessionId,
      created_at: new Date().toISOString(),
      message_count: 0,
    };

    return createAxiosResponse(response);
  }

  // ============================================================================
  // 테스트 헬퍼 메서드
  // ============================================================================

  /**
   * 다음 응답 설정
   *
   * @param method - 메서드 이름
   * @param response - 응답 데이터
   */
  setNextResponse<T>(method: keyof IChatAPIService, response: T): void {
    const queue = this.responseQueues.get(method) ?? [];
    queue.push(response);
    this.responseQueues.set(method, queue);
  }

  /**
   * 다음 에러 설정
   *
   * @param method - 메서드 이름
   * @param error - 에러 객체
   */
  setNextError(method: keyof IChatAPIService, error: Error): void {
    const queue = this.errorQueues.get(method) ?? [];
    queue.push(error);
    this.errorQueues.set(method, queue);
  }

  /**
   * 응답 큐에서 다음 응답 가져오기
   */
  private getNextResponse<T>(method: string): T | undefined {
    const queue = this.responseQueues.get(method);
    if (queue && queue.length > 0) {
      return queue.shift() as T;
    }
    return undefined;
  }

  /**
   * 에러 큐에서 다음 에러 가져오기
   */
  private getNextError(method: string): Error | undefined {
    const queue = this.errorQueues.get(method);
    if (queue && queue.length > 0) {
      return queue.shift();
    }
    return undefined;
  }

  /**
   * 모든 큐 초기화
   */
  clearQueues(): void {
    this.responseQueues.clear();
    this.errorQueues.clear();
  }

  /**
   * 모든 Mock 함수 초기화
   */
  clearMocks(): void {
    this.sendMessageMock.mockClear();
    this.getChatHistoryMock.mockClear();
    this.startNewSessionMock.mockClear();
    this.getSessionInfoMock.mockClear();
  }

  // ============================================================================
  // 정적 헬퍼 메서드
  // ============================================================================

  /**
   * 모든 MockChatAPIService 인스턴스 초기화
   *
   * 각 테스트 시작 전 beforeEach에서 호출 권장
   */
  static clear(): void {
    MockChatAPIService.instances = [];
  }

  /**
   * 마지막으로 생성된 MockChatAPIService 인스턴스 반환
   *
   * @returns 마지막 인스턴스 또는 undefined
   */
  static getLastInstance(): MockChatAPIService | undefined {
    return MockChatAPIService.instances[MockChatAPIService.instances.length - 1];
  }

  /**
   * 인덱스로 특정 MockChatAPIService 인스턴스 반환
   *
   * @param index - 인스턴스 인덱스 (0부터 시작)
   * @returns 해당 인스턴스 또는 undefined
   */
  static getInstance(index: number): MockChatAPIService | undefined {
    return MockChatAPIService.instances[index];
  }

  /**
   * 생성된 MockChatAPIService 인스턴스 개수 반환
   */
  static get instanceCount(): number {
    return MockChatAPIService.instances.length;
  }
}

/**
 * MockChatAPIService 팩토리 함수 생성 헬퍼
 *
 * @returns ChatAPIFactory로 사용 가능한 팩토리 함수
 *
 * @example
 * const mockFactory = createMockChatAPIFactory();
 * <ChatAPIProvider createService={mockFactory} config={config}>
 *   <App />
 * </ChatAPIProvider>
 */
export function createMockChatAPIFactory() {
  return (config: ChatAPIConfig) => new MockChatAPIService(config);
}
