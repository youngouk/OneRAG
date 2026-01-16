import { useState, useCallback } from 'react';
import { ApiLog } from '../../types/chat';

export function useChatDevTools() {
    const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
    const [leftPanelTab, setLeftPanelTab] = useState(0);
    const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
    const [isDebugExpanded, setIsDebugExpanded] = useState<boolean>(false);
    const [showDevTools, setShowDevTools] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth >= 1024;
        }
        return true;
    });

    const toggleLogExpansion = useCallback((logId: string) => {
        setExpandedLogs((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(logId)) {
                newSet.delete(logId);
            } else {
                newSet.add(logId);
            }
            return newSet;
        });
    }, []);

    const clearLogs = useCallback(() => {
        setApiLogs([]);
    }, []);

    return {
        apiLogs,
        setApiLogs,
        leftPanelTab,
        setLeftPanelTab,
        expandedLogs,
        setExpandedLogs,
        isDebugExpanded,
        setIsDebugExpanded,
        showDevTools,
        setShowDevTools,
        toggleLogExpansion,
        clearLogs,
    };
}
