/**
 * Core 모듈 내보내기
 *
 * 애플리케이션 핵심 Provider들과 훅을 중앙에서 관리합니다.
 * 모든 Context, Provider, 훅은 이 파일을 통해 import합니다.
 *
 * @example
 * import {
 *   ConfigProvider,
 *   FeatureProvider,
 *   WebSocketProvider,
 *   useConfig,
 *   useFeature,
 *   useWebSocket,
 * } from '@/core';
 */

// Config 관련
export { ConfigContext } from './ConfigContext';
export type { ConfigContextType, RuntimeConfig } from './ConfigContext';
export { ConfigProvider } from './ConfigProvider';
export { useConfig } from './useConfig';

// Feature 관련
export { FeatureContext } from './FeatureContext';
export type { FeatureContextValue } from './FeatureContext';
export { FeatureProvider, FeatureGuard } from './FeatureProvider';
export {
  useFeature,
  useIsModuleEnabled,
  useIsFeatureEnabled,
} from './useFeature';
export { withFeature } from './withFeature';

// WebSocket 관련 (DI 패턴)
export { WebSocketContext } from './WebSocketContext';
export type { WebSocketContextValue } from './WebSocketContext';
export { WebSocketProvider } from './WebSocketProvider';
export {
  useWebSocket,
  useWebSocketFactory,
  useWebSocketConfig,
} from './useWebSocket';

// ChatAPI 관련 (DI 패턴)
export { ChatAPIContext } from './ChatAPIContext';
export type { ChatAPIContextValue } from './ChatAPIContext';
export { ChatAPIProvider } from './ChatAPIProvider';
export type { ChatAPIProviderProps } from './ChatAPIProvider';
export {
  useChatAPI,
  useChatAPIService,
  useChatAPIConfig,
} from './useChatAPI';
