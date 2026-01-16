/**
 * withFeature HOC (Higher-Order Component)
 *
 * 컴포넌트를 Feature Flag로 감싸는 HOC입니다.
 * React Fast Refresh 호환성을 위해 별도 파일로 분리했습니다.
 */

import React from 'react';
import type { FeatureConfig } from '../config/features';
import { FeatureGuard } from './FeatureProvider';

/**
 * withFeature HOC - 컴포넌트를 Feature Flag로 감싸기
 *
 * @param Component - 감쌀 컴포넌트
 * @param module - Feature 모듈 이름
 * @param feature - 옵션: 특정 기능 이름
 * @returns Feature Flag로 감싸진 컴포넌트
 *
 * @example
 * ```tsx
 * const ProtectedChatPage = withFeature(ChatPage, 'chatbot');
 * const ProtectedUploadButton = withFeature(UploadButton, 'documentManagement', 'upload');
 * ```
 */
export function withFeature<P extends object>(
  Component: React.ComponentType<P>,
  module: keyof FeatureConfig,
  feature?: string
) {
  return function FeatureWrappedComponent(props: P) {
    return (
      <FeatureGuard module={module} feature={feature}>
        <Component {...props} />
      </FeatureGuard>
    );
  };
}
