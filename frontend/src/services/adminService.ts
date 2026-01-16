/**
 * 관리자 시스템 API 서비스
 * Railway 배포된 백엔드 서버와 통신하는 서비스 레이어
 * 실시간 모니터링, 세션 관리, WebSocket 지원
 */

import { logger } from '../utils/logger';

// API 기본 설정 - Railway 배포된 백엔드 서버 사용
const getAPIBaseURL = (): string => {
  // Railway 배포된 백엔드 URL 직접 사용
  if (import.meta.env.DEV) {
    return 'https://simple-rag-production-bb72.up.railway.app';
  }
  
  // 런타임 설정이 있는 경우 우선 사용 (Railway 환경)
  if (typeof window !== 'undefined' && window.RUNTIME_CONFIG?.API_BASE_URL) {
    return window.RUNTIME_CONFIG.API_BASE_URL;
  }
  
  // 빌드 타임 환경 변수가 설정된 경우 사용
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Railway 환경 자동 감지
  if (typeof window !== 'undefined') {
    const currentHost = window.location.host;
    const currentProtocol = window.location.protocol;
    
    // Railway 도메인 패턴 감지
    if (currentHost.includes('railway.app')) {
      return `${currentProtocol}//${currentHost}`;
    }
    
    // Railway public domain 패턴 감지
    if (currentHost.includes('-production') || currentHost.includes('-staging')) {
      return `${currentProtocol}//${currentHost}`;
    }
  }
  
  // 기본값: Railway 프로덕션 URL
  return 'https://simple-rag-production-bb72.up.railway.app';
};

const getWSBaseURL = (): string => {
  // Railway 배포된 백엔드 WebSocket URL 직접 사용
  if (import.meta.env.DEV) {
    return 'wss://simple-rag-production-bb72.up.railway.app';
  }
  
  // 런타임 설정이 있는 경우 우선 사용
  if (typeof window !== 'undefined' && window.RUNTIME_CONFIG?.WS_BASE_URL) {
    return window.RUNTIME_CONFIG.WS_BASE_URL;
  }
  
  // 빌드 타임 환경 변수가 설정된 경우 사용
  if (import.meta.env.VITE_WS_BASE_URL) {
    return import.meta.env.VITE_WS_BASE_URL;
  }
  
  // Railway 환경 자동 감지
  if (typeof window !== 'undefined') {
    const currentHost = window.location.host;
    
    // Railway 도메인 패턴 감지 (WebSocket은 wss 사용)
    if (currentHost.includes('railway.app')) {
      return `wss://${currentHost}`;
    }
    
    // Railway public domain 패턴 감지
    if (currentHost.includes('-production') || currentHost.includes('-staging')) {
      return `wss://${currentHost}`;
    }
  }
  
  // 기본값: Railway 프로덕션 WebSocket URL
  return 'wss://simple-rag-production-bb72.up.railway.app';
};

const API_BASE_URL = getAPIBaseURL();
const WS_BASE_URL = getWSBaseURL();

class AdminService {
  private wsConnection: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000; // 5초
  private eventListeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();

  constructor() {
    logger.log('🚀 AdminService 초기화');
    logger.log('📡 API Base URL:', API_BASE_URL);
    logger.log('🔗 WebSocket URL:', WS_BASE_URL);
  }

  /**
   * API 호출 헬퍼 함수
   */
  private async apiCall(endpoint: string, options?: RequestInit) {
    const url = `${API_BASE_URL}/api/admin${endpoint}`;
    logger.log('🌐 API 호출:', url);

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`❌ API 오류 [${response.status}]:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      logger.log('✅ API 응답:', endpoint, data);
      return data;
    } catch (error) {
      logger.error(`❌ API 호출 실패 ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * WebSocket 연결 초기화
   */
  initWebSocket() {
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      logger.log('✅ WebSocket이 이미 연결되어 있습니다.');
      return;
    }

    try {
      logger.log('🔗 WebSocket 연결 시도:', `${WS_BASE_URL}/admin-ws`);
      this.wsConnection = new WebSocket(`${WS_BASE_URL}/admin-ws`);

      this.wsConnection.onopen = () => {
        logger.log('✅ Admin WebSocket 연결됨');
        this.reconnectAttempts = 0;
        this.emit('connection', { connected: true });
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          logger.log('📨 WebSocket 메시지:', data);
          this.emit(data.type, data.data);
        } catch (error) {
          logger.error('❌ WebSocket 메시지 파싱 오류:', error);
        }
      };

      this.wsConnection.onclose = (event) => {
        logger.log('🔌 Admin WebSocket 연결 해제:', event.code, event.reason);
        this.emit('connection', { connected: false });
        this.scheduleReconnect();
      };

      this.wsConnection.onerror = (error) => {
        logger.error('❌ WebSocket 오류:', error);
        this.emit('error', error);
      };
    } catch (error) {
      logger.error('❌ WebSocket 연결 실패:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * WebSocket 재연결 스케줄링
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectInterval * this.reconnectAttempts;
      logger.log(`🔄 WebSocket 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts} (${delay}ms 후)`);

      setTimeout(() => {
        this.initWebSocket();
      }, delay);
    } else {
      logger.error('❌ WebSocket 재연결 최대 시도 횟수 초과');
    }
  }

  /**
   * 이벤트 리스너 등록
   */
  on(event: string, callback: (...args: unknown[]) => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * 이벤트 리스너 제거
   */
  off(event: string, callback: (...args: unknown[]) => void) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 이벤트 발생
   */
  private emit(event: string, data: unknown) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * WebSocket 연결 해제
   */
  disconnectWebSocket() {
    if (this.wsConnection) {
      logger.log('🔌 WebSocket 연결 해제');
      this.wsConnection.close();
      this.wsConnection = null;
    }
    this.eventListeners.clear();
  }

  /**
   * 시스템 상태 조회
   */
  async getSystemStatus() {
    return this.apiCall('/status');
  }

  /**
   * 실시간 메트릭 조회
   */
  async getRealtimeMetrics() {
    return this.apiCall('/realtime-metrics');
  }

  /**
   * 시스템 메트릭 조회
   */
  async getMetrics(period: string = '7d') {
    return this.apiCall(`/metrics?period=${period}`);
  }

  /**
   * 키워드 분석 데이터 조회
   */
  async getKeywordAnalysis(period: string = '7d') {
    return this.apiCall(`/keywords?period=${period}`);
  }

  /**
   * 청크 활용 분석 조회
   */
  async getChunkAnalysis(period: string = '7d') {
    return this.apiCall(`/chunks?period=${period}`);
  }

  /**
   * 국가별 접속 분석 조회
   */
  async getCountryAnalysis(period: string = '7d') {
    return this.apiCall(`/countries?period=${period}`);
  }

  /**
   * 최근 채팅 내역 조회
   */
  async getRecentChats(limit: number = 20) {
    return this.apiCall(`/recent-chats?limit=${limit}`);
  }

  /**
   * 문서 관리 데이터 조회
   */
  async getDocuments() {
    return this.apiCall('/documents');
  }

  /**
   * 세션 관리 데이터 조회
   */
  async getSessions(params: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const { status = 'all', limit = 50, offset = 0 } = params;
    return this.apiCall(`/sessions?status=${status}&limit=${limit}&offset=${offset}`);
  }

  /**
   * 세션 삭제
   */
  async deleteSession(sessionId: string) {
    return this.apiCall(`/sessions/${sessionId}`, { method: 'DELETE' });
  }

  /**
   * 시스템 로그 다운로드
   */
  async downloadLogs() {
    try {
      const url = `${API_BASE_URL}/api/admin/logs/download`;
      logger.log('📥 로그 다운로드:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `system-logs-${new Date().toISOString().split('T')[0]}.log`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      return { success: true };
    } catch (error) {
      logger.error('❌ 로그 다운로드 실패:', error);
      throw error;
    }
  }

  /**
   * 문서 삭제
   */
  async deleteDocument(documentId: string) {
    return this.apiCall(`/documents/${documentId}`, { method: 'DELETE' });
  }

  /**
   * 시스템 캐시 클리어
   */
  async clearCache() {
    return this.apiCall('/cache/clear', { method: 'POST' });
  }

  /**
   * 데이터베이스 최적화
   */
  async optimizeDatabase() {
    return this.apiCall('/database/optimize', { method: 'POST' });
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const adminService = new AdminService();
export default adminService;