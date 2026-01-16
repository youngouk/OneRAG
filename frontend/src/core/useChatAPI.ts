/**
 * Chat API 훅 모음
 *
 * useWebSocket과 동일한 패턴으로 설계되었습니다.
 * Provider에서 서비스와 설정을 가져오는 훅들입니다.
 */

import { useContext } from 'react';
import { ChatAPIContext, ChatAPIContextValue } from './ChatAPIContext';
import type { IChatAPIService, ChatAPIConfig } from '../types/chatAPI';

/**
 * useChatAPI 훅
 *
 * ChatAPI Context의 전체 값을 반환합니다.
 * service와 config 모두 필요할 때 사용합니다.
 *
 * @throws Provider 없이 사용 시 에러
 * @returns ChatAPIContextValue
 *
 * @example
 * const { service, config } = useChatAPI();
 * console.log('API URL:', config.baseURL);
 * await service.sendMessage('질문');
 */
export function useChatAPI(): ChatAPIContextValue {
  const context = useContext(ChatAPIContext);
  if (context === undefined) {
    throw new Error('useChatAPI must be used within a ChatAPIProvider');
  }
  return context;
}

/**
 * useChatAPIService 훅
 *
 * ChatAPI 서비스 인스턴스만 반환합니다.
 * 서비스만 필요한 경우 useChatAPI() 대신 사용합니다.
 *
 * @throws Provider 없이 사용 시 에러
 * @returns IChatAPIService
 *
 * @example
 * const service = useChatAPIService();
 * const response = await service.sendMessage('안녕하세요');
 */
export function useChatAPIService(): IChatAPIService {
  return useChatAPI().service;
}

/**
 * useChatAPIConfig 훅
 *
 * ChatAPI 설정만 반환합니다.
 * 설정 값만 필요한 경우 사용합니다.
 *
 * @throws Provider 없이 사용 시 에러
 * @returns ChatAPIConfig
 *
 * @example
 * const config = useChatAPIConfig();
 * console.log('Timeout:', config.timeout);
 */
export function useChatAPIConfig(): ChatAPIConfig {
  return useChatAPI().config;
}
