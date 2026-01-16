/**
 * Feature Context 정의
 *
 * Feature Flag 설정을 전역적으로 관리하는 React Context입니다.
 * React Fast Refresh 호환성을 위해 별도 파일로 분리했습니다.
 */

import { createContext } from 'react';
import type { FeatureConfig } from '../config/features';

/**
 * Feature Context 타입 정의
 */
export interface FeatureContextValue {
  features: FeatureConfig;
  isModuleEnabled: (module: keyof FeatureConfig) => boolean;
  isFeatureEnabled: (module: keyof FeatureConfig, feature: string) => boolean;
}

/**
 * Feature Context 생성
 */
export const FeatureContext = createContext<FeatureContextValue | undefined>(undefined);
