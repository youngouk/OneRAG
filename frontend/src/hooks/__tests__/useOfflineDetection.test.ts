/**
 * useOfflineDetection 훅 테스트
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineDetection } from '../useOfflineDetection';

describe('useOfflineDetection', () => {
  beforeEach(() => {
    // navigator.onLine을 true로 초기화
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('초기 온라인 상태를 올바르게 반환해야 함', () => {
    const { result } = renderHook(() => useOfflineDetection());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.wasOffline).toBe(false);
  });

  it('오프라인 이벤트 시 콜백을 호출해야 함', () => {
    const onOffline = vi.fn();
    const { result } = renderHook(() => useOfflineDetection(onOffline));

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      window.dispatchEvent(new Event('offline'));
    });

    expect(onOffline).toHaveBeenCalled();
    expect(result.current.isOnline).toBe(false);
    expect(result.current.wasOffline).toBe(true);
  });

  it('온라인 이벤트 시 콜백을 호출해야 함', () => {
    const onOnline = vi.fn();

    // 먼저 오프라인으로 설정
    Object.defineProperty(navigator, 'onLine', { value: false });
    const { result } = renderHook(() => useOfflineDetection(undefined, onOnline));

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true });
      window.dispatchEvent(new Event('online'));
    });

    expect(onOnline).toHaveBeenCalled();
    expect(result.current.isOnline).toBe(true);
    expect(result.current.wasOffline).toBe(false);
  });
});
