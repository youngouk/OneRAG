/**
 * 오프라인 모드 감지 훅
 */
import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

export interface OfflineState {
  isOnline: boolean;
  wasOffline: boolean;
}

export const useOfflineDetection = (onOffline?: () => void, onOnline?: () => void) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      logger.info('✅ 네트워크 연결 복구');
      setIsOnline(true);
      setWasOffline(false);
      onOnline?.();
    };

    const handleOffline = () => {
      logger.warn('⚠️ 네트워크 연결 끊김');
      setIsOnline(false);
      setWasOffline(true);
      onOffline?.();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 주기적으로 실제 네트워크 상태 확인 (30초마다)
    const interval = setInterval(async () => {
      try {
        await fetch('/health', { method: 'HEAD', cache: 'no-cache' });
        if (!isOnline) {
          handleOnline();
        }
      } catch {
        if (isOnline) {
          handleOffline();
        }
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOnline, onOffline, onOnline]);

  return { isOnline, wasOffline };
};
