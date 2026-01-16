/**
 * 인증 서비스
 * JWT 토큰 기반 인증 관리
 */
import api from './api';
import { logger } from '../utils/logger';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserInfo {
  id: string;
  username: string;
  email?: string;
  roles: string[];
}

const TOKEN_STORAGE_KEY = 'auth_tokens';
const USER_INFO_KEY = 'user_info';

/**
 * 인증 서비스 클래스
 */
class AuthService {
  private refreshTokenTimeout?: NodeJS.Timeout;

  /**
   * 로그인
   */
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    try {
      const response = await api.post<AuthTokens>('/api/auth/login', credentials);
      this.setTokens(response.data);
      this.scheduleTokenRefresh(response.data.expiresIn);
      logger.info('✅ 로그인 성공');
      return response.data;
    } catch (error) {
      logger.error('❌ 로그인 실패:', error);
      throw error;
    }
  }

  /**
   * 로그아웃
   */
  async logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout');
      this.clearTokens();
      this.cancelTokenRefresh();
      logger.info('✅ 로그아웃 성공');
    } catch (error) {
      logger.error('⚠️ 로그아웃 요청 실패 (로컬 정리는 완료):', error);
      this.clearTokens();
      this.cancelTokenRefresh();
    }
  }

  /**
   * 토큰 갱신
   */
  async refreshToken(): Promise<AuthTokens> {
    try {
      const tokens = this.getTokens();
      if (!tokens?.refreshToken) {
        throw new Error('Refresh token not found');
      }

      const response = await api.post<AuthTokens>('/api/auth/refresh', {
        refreshToken: tokens.refreshToken,
      });

      this.setTokens(response.data);
      this.scheduleTokenRefresh(response.data.expiresIn);
      logger.info('✅ 토큰 갱신 성공');
      return response.data;
    } catch (error) {
      logger.error('❌ 토큰 갱신 실패:', error);
      this.clearTokens();
      throw error;
    }
  }

  /**
   * 사용자 정보 조회
   */
  async getUserInfo(): Promise<UserInfo> {
    try {
      const response = await api.get<UserInfo>('/api/auth/me');
      this.setUserInfo(response.data);
      return response.data;
    } catch (error) {
      logger.error('❌ 사용자 정보 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 토큰 저장
   */
  private setTokens(tokens: AuthTokens): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    } catch (error) {
      logger.error('⚠️ 토큰 저장 실패:', error);
    }
  }

  /**
   * 토큰 조회
   */
  getTokens(): AuthTokens | null {
    try {
      const tokensStr = localStorage.getItem(TOKEN_STORAGE_KEY);
      return tokensStr ? JSON.parse(tokensStr) : null;
    } catch (error) {
      logger.error('⚠️ 토큰 조회 실패:', error);
      return null;
    }
  }

  /**
   * 토큰 삭제
   */
  private clearTokens(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_INFO_KEY);
    } catch (error) {
      logger.error('⚠️ 토큰 삭제 실패:', error);
    }
  }

  /**
   * 사용자 정보 저장
   */
  private setUserInfo(userInfo: UserInfo): void {
    try {
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
    } catch (error) {
      logger.error('⚠️ 사용자 정보 저장 실패:', error);
    }
  }

  /**
   * 사용자 정보 조회
   */
  getUserInfoFromStorage(): UserInfo | null {
    try {
      const userInfoStr = localStorage.getItem(USER_INFO_KEY);
      return userInfoStr ? JSON.parse(userInfoStr) : null;
    } catch (error) {
      logger.error('⚠️ 사용자 정보 조회 실패:', error);
      return null;
    }
  }

  /**
   * 인증 여부 확인
   */
  isAuthenticated(): boolean {
    const tokens = this.getTokens();
    return !!tokens?.accessToken;
  }

  /**
   * Access Token 조회
   */
  getAccessToken(): string | null {
    const tokens = this.getTokens();
    return tokens?.accessToken || null;
  }

  /**
   * 토큰 자동 갱신 예약
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    this.cancelTokenRefresh();

    // 만료 5분 전에 갱신
    const refreshTime = (expiresIn - 300) * 1000;

    if (refreshTime > 0) {
      this.refreshTokenTimeout = setTimeout(() => {
        this.refreshToken().catch((error) => {
          logger.error('❌ 자동 토큰 갱신 실패:', error);
          this.clearTokens();
        });
      }, refreshTime);
    }
  }

  /**
   * 토큰 자동 갱신 취소
   */
  private cancelTokenRefresh(): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
      this.refreshTokenTimeout = undefined;
    }
  }

  /**
   * 권한 확인
   */
  hasRole(role: string): boolean {
    const userInfo = this.getUserInfoFromStorage();
    return userInfo?.roles?.includes(role) || false;
  }

  /**
   * 다중 권한 확인 (AND 조건)
   */
  hasAllRoles(roles: string[]): boolean {
    const userInfo = this.getUserInfoFromStorage();
    return roles.every(role => userInfo?.roles?.includes(role));
  }

  /**
   * 다중 권한 확인 (OR 조건)
   */
  hasAnyRole(roles: string[]): boolean {
    const userInfo = this.getUserInfoFromStorage();
    return roles.some(role => userInfo?.roles?.includes(role));
  }
}

export const authService = new AuthService();
