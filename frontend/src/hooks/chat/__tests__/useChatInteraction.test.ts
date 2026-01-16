import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatInteraction } from '../useChatInteraction';
import { useMediaQuery } from '../../useMediaQuery';
import { logger } from '../../../utils/logger';
import { ChatMessage, Source } from '../../../types';

// Mock dependencies
vi.mock('../../useMediaQuery', () => ({
    useMediaQuery: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}));

describe('useChatInteraction', () => {
    const mockShowToast = vi.fn();
    const mockMessages: ChatMessage[] = [{ id: '1', content: 'hello', role: 'user', timestamp: 'now' }];

    // Mock clipboard
    const mockWriteText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
        value: {
            writeText: mockWriteText,
        },
        writable: true,
    });

    // Mock scrollIntoView
    const scrollIntoViewMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset window innerWidth for consistent tests
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });

        // Mock matches to false by default
        vi.mocked(useMediaQuery).mockReturnValue(false);
    });

    it('should initialize with default states', () => {
        const { result } = renderHook(() => useChatInteraction({ messages: mockMessages, showToast: mockShowToast }));

        expect(result.current.modalOpen).toBe(false);
        expect(result.current.selectedChunk).toBeNull();
        expect(result.current.leftPanelTab).toBe(0);
        expect(result.current.isDebugExpanded).toBe(false);
        expect(result.current.showDevTools).toBe(true); // Window width 1200 >= 1024
    });

    it('should toggle dev tools based on screen size', () => {
        // Initial render with large screen
        const { result, rerender } = renderHook(() => useChatInteraction({ messages: mockMessages, showToast: mockShowToast }));
        expect(result.current.showDevTools).toBe(true);

        // Simulate medium screen
        vi.mocked(useMediaQuery).mockReturnValue(true);
        rerender();

        expect(result.current.showDevTools).toBe(false);
    });

    it('should handle chunk modal open/close', () => {
        const { result } = renderHook(() => useChatInteraction({ messages: mockMessages, showToast: mockShowToast }));
        const mockChunk = { id: 1, content_preview: 'test' } as unknown as Source;

        act(() => {
            result.current.handleChunkClick(mockChunk);
        });

        expect(result.current.modalOpen).toBe(true);
        expect(result.current.selectedChunk).toEqual(mockChunk);

        act(() => {
            result.current.handleCloseModal();
        });

        expect(result.current.modalOpen).toBe(false);
        expect(result.current.selectedChunk).toBeNull();
    });

    it('should toggle log expansion', () => {
        const { result } = renderHook(() => useChatInteraction({ messages: mockMessages, showToast: mockShowToast }));
        const logId = 'log-1';

        act(() => {
            result.current.toggleLogExpansion(logId);
        });
        expect(result.current.expandedLogs.has(logId)).toBe(true);

        act(() => {
            result.current.toggleLogExpansion(logId);
        });
        expect(result.current.expandedLogs.has(logId)).toBe(false);
    });

    it('should copy text to clipboard successfully', async () => {
        const { result } = renderHook(() => useChatInteraction({ messages: mockMessages, showToast: mockShowToast }));
        mockWriteText.mockResolvedValue(undefined);

        await act(async () => {
            await result.current.copyToClipboard('text to copy');
        });

        expect(mockWriteText).toHaveBeenCalledWith('text to copy');
        expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });

    it('should handle clipboard error', async () => {
        const { result } = renderHook(() => useChatInteraction({ messages: mockMessages, showToast: mockShowToast }));
        mockWriteText.mockRejectedValue(new Error('Copy failed'));

        await act(async () => {
            await result.current.copyToClipboard('fail text');
        });

        expect(logger.error).toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });

    it('should trigger scroll to bottom when messages change', () => {
        const { result } = renderHook(() => useChatInteraction({ messages: mockMessages, showToast: mockShowToast }));

        const mockDiv = document.createElement('div');
        mockDiv.scrollIntoView = scrollIntoViewMock;

        // Assign ref
        (result.current.messagesEndRef as React.MutableRefObject<HTMLDivElement | null>).current = mockDiv;

        act(() => {
            result.current.scrollToBottom();
        });

        expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' });
    });

    it('should set initial devtools state based on window width', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });
        const { result } = renderHook(() => useChatInteraction({ messages: mockMessages, showToast: mockShowToast }));
        expect(result.current.showDevTools).toBe(false);
    });
});
