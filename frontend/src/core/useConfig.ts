/**
 * useConfig Hook
 *
 * ConfigProvider의 컨텍스트에 접근하는 훅
 */

import { useContext } from 'react';
import { ConfigContext, type ConfigContextType } from './ConfigContext';

export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context;
};
