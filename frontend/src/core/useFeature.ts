/**
 * Feature Flag 커스텀 훅
 *
 * FeatureProvider 컨텍스트에 접근하기 위한 훅들을 제공합니다.
 * React Fast Refresh 호환성을 위해 별도 파일로 분리했습니다.
 */

import { useContext } from 'react';
import { FeatureContext } from './FeatureContext';
import type { FeatureConfig } from '../config/features';

/**
 * useFeatures 훅 - 전체 Feature 설정 접근
 *
 * @returns 전체 Feature 설정 객체
 *
 * @example
 * ```tsx
 * const features = useFeatures();
 * if (features.chatbot.enabled) {
 *   // 챗봇 기능 렌더링
 * }
 * ```
 */
export function useFeatures(): FeatureConfig {
  const context = useContext(FeatureContext);

  if (!context) {
    throw new Error('useFeatures는 FeatureProvider 내부에서만 사용할 수 있습니다.');
  }

  return context.features;
}

/**
 * useFeature 훅 - 특정 모듈의 기능 설정 접근
 *
 * @param module - 접근할 모듈 이름 (chatbot, documentManagement 등)
 * @returns 해당 모듈의 기능 설정
 *
 * @example
 * ```tsx
 * const chatbotFeatures = useFeature('chatbot');
 * if (chatbotFeatures.enabled && chatbotFeatures.streaming) {
 *   // 스트리밍 기능 사용
 * }
 * ```
 */
export function useFeature<K extends keyof FeatureConfig>(module: K): FeatureConfig[K] {
  const features = useFeatures();
  return features[module];
}

/**
 * useIsModuleEnabled 훅 - 모듈 활성화 상태 확인
 *
 * @param module - 확인할 모듈 이름
 * @returns 모듈이 활성화되어 있으면 true
 *
 * @example
 * ```tsx
 * const isAdminEnabled = useIsModuleEnabled('admin');
 * if (!isAdminEnabled) {
 *   return <Navigate to="/" />;
 * }
 * ```
 */
export function useIsModuleEnabled(module: keyof FeatureConfig): boolean {
  const context = useContext(FeatureContext);

  if (!context) {
    throw new Error('useIsModuleEnabled는 FeatureProvider 내부에서만 사용할 수 있습니다.');
  }

  return context.isModuleEnabled(module);
}

/**
 * useIsFeatureEnabled 훅 - 특정 기능 활성화 상태 확인
 *
 * @param module - 모듈 이름
 * @param feature - 확인할 기능 이름
 * @returns 기능이 활성화되어 있으면 true
 *
 * @example
 * ```tsx
 * const canUpload = useIsFeatureEnabled('documentManagement', 'upload');
 * if (!canUpload) {
 *   return <DisabledMessage />;
 * }
 * ```
 */
export function useIsFeatureEnabled(module: keyof FeatureConfig, feature: string): boolean {
  const context = useContext(FeatureContext);

  if (!context) {
    throw new Error('useIsFeatureEnabled는 FeatureProvider 내부에서만 사용할 수 있습니다.');
  }

  return context.isFeatureEnabled(module, feature);
}
