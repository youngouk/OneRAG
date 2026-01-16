import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useChatDevTools } from '../useChatDevTools';

describe('useChatDevTools', () => {
    it('should initialize with default values', () => {
        const { result } = renderHook(() => useChatDevTools());

        expect(result.current.apiLogs).toEqual([]);
        expect(result.current.leftPanelTab).toBe(0);
        expect(result.current.expandedLogs).toBeInstanceOf(Set);
        expect(result.current.isDebugExpanded).toBe(false);
    });

    it('should toggle log expansion', () => {
        const { result } = renderHook(() => useChatDevTools());
        const logId = 'log-1';

        // Toggle on
        act(() => {
            result.current.toggleLogExpansion(logId);
        });
        expect(result.current.expandedLogs.has(logId)).toBe(true);

        // Toggle off
        act(() => {
            result.current.toggleLogExpansion(logId);
        });
        expect(result.current.expandedLogs.has(logId)).toBe(false);
    });

    it('should clear logs', () => {
        const { result } = renderHook(() => useChatDevTools());

        // Manually add a log via state setter for testing
        act(() => {
            result.current.setApiLogs([{
                id: '1',
                timestamp: 'now',
                type: 'request',
                method: 'GET',
                endpoint: '/test',
                data: {}
            }]);
        });
        expect(result.current.apiLogs).toHaveLength(1);

        // Clear logs
        act(() => {
            result.current.clearLogs();
        });
        expect(result.current.apiLogs).toHaveLength(0);
    });

    it('should update tab state', () => {
        const { result } = renderHook(() => useChatDevTools());

        act(() => {
            result.current.setLeftPanelTab(1);
        });

        expect(result.current.leftPanelTab).toBe(1);
    });
});
