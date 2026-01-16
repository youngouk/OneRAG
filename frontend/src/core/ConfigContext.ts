/**
 * ConfigContext
 *
 * 설정 관리를 위한 React Context 정의
 */

import { createContext } from 'react';
import type { AppConfig } from '../config';
import { APP_CONFIG } from '../config';

export interface RuntimeConfig {
  preset?: string;
  layout?: {
    sidebar?: { width?: number };
    header?: { height?: number };
    content?: { padding?: number };
  };
  features?: typeof APP_CONFIG.features;
}

export interface ConfigContextType {
  config: AppConfig;
  runtimeConfig: RuntimeConfig | null;
  updateConfig: (newConfig: RuntimeConfig) => void;
  resetConfig: () => void;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(undefined);
