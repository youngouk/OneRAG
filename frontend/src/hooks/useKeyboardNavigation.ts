/**
 * 키보드 네비게이션 커스텀 훅
 * 접근성을 위한 키보드 단축키 및 포커스 관리
 */
import { useEffect, useCallback, RefObject } from 'react';
import { logger } from '../utils/logger';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  callback: (event: KeyboardEvent) => void;
  description?: string;
}

/**
 * 키보드 단축키 등록 훅
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey;
        const shiftMatches = shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey;
        const altMatches = shortcut.altKey === undefined || event.altKey === shortcut.altKey;
        const metaMatches = shortcut.metaKey === undefined || event.metaKey === shortcut.metaKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
          event.preventDefault();
          shortcut.callback(event);
          logger.log(`⌨️ 단축키 실행: ${shortcut.description || shortcut.key}`);
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
}

/**
 * 포커스 트랩 훅 (모달, 다이얼로그용)
 * 탭 키로 포커스가 컨테이너 밖으로 나가지 않도록 제한
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement>, isActive: boolean = true): void {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift + Tab: 역방향 탭
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: 정방향 탭
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // 첫 번째 요소에 자동 포커스
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, isActive]);
}

/**
 * 자동 포커스 훅
 * 컴포넌트 마운트 시 특정 요소에 자동 포커스
 */
export function useAutoFocus(
  elementRef: RefObject<HTMLElement>,
  options: {
    enabled?: boolean;
    delay?: number;
    selectText?: boolean;
  } = {}
): void {
  const { enabled = true, delay = 0, selectText = false } = options;

  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const focusElement = () => {
      elementRef.current?.focus();

      // 텍스트 입력 요소인 경우 텍스트 선택
      if (selectText && elementRef.current instanceof HTMLInputElement) {
        elementRef.current.select();
      }
    };

    if (delay > 0) {
      const timer = setTimeout(focusElement, delay);
      return () => clearTimeout(timer);
    } else {
      focusElement();
    }
  }, [elementRef, enabled, delay, selectText]);
}

/**
 * 화살표 키 네비게이션 훅
 * 리스트, 그리드 등에서 화살표 키로 이동
 */
export function useArrowKeyNavigation(
  containerRef: RefObject<HTMLElement>,
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
    selector?: string;
  } = {}
): void {
  const {
    orientation = 'both',
    loop = false,
    selector = '[role="button"], button, a[href]',
  } = options;

  const moveFocus = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!containerRef.current) return;

      const focusableElements = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(selector)
      );

      const currentIndex = focusableElements.findIndex(
        (el) => el === document.activeElement
      );

      if (currentIndex === -1) {
        focusableElements[0]?.focus();
        return;
      }

      let nextIndex = currentIndex;

      if (
        (direction === 'down' && (orientation === 'vertical' || orientation === 'both')) ||
        (direction === 'right' && (orientation === 'horizontal' || orientation === 'both'))
      ) {
        nextIndex = currentIndex + 1;
      } else if (
        (direction === 'up' && (orientation === 'vertical' || orientation === 'both')) ||
        (direction === 'left' && (orientation === 'horizontal' || orientation === 'both'))
      ) {
        nextIndex = currentIndex - 1;
      }

      // 범위 체크 및 loop 처리
      if (nextIndex < 0) {
        nextIndex = loop ? focusableElements.length - 1 : 0;
      } else if (nextIndex >= focusableElements.length) {
        nextIndex = loop ? 0 : focusableElements.length - 1;
      }

      focusableElements[nextIndex]?.focus();
    },
    [containerRef, orientation, loop, selector]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          moveFocus('up');
          break;
        case 'ArrowDown':
          event.preventDefault();
          moveFocus('down');
          break;
        case 'ArrowLeft':
          event.preventDefault();
          moveFocus('left');
          break;
        case 'ArrowRight':
          event.preventDefault();
          moveFocus('right');
          break;
        case 'Home':
          event.preventDefault();
          container.querySelector<HTMLElement>(selector)?.focus();
          break;
        case 'End': {
          event.preventDefault();
          const elements = container.querySelectorAll<HTMLElement>(selector);
          elements[elements.length - 1]?.focus();
          break;
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, moveFocus, selector]);
}

/**
 * Escape 키 핸들러 훅
 * ESC 키로 모달/다이얼로그 닫기
 */
export function useEscapeKey(callback: () => void, enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [callback, enabled]);
}
