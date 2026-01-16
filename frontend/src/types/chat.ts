import {
    ChatMessage as BaseChatMessage,
    Source as BaseSource,
    SessionInfo as BaseSessionInfo,
    ToastMessage,
} from './index';

export interface DocumentInfoItem {
    label: string;
    value: string;
}

export interface ApiLog {
    id: string;
    timestamp: string;
    type: 'request' | 'response';
    method: string;
    endpoint: string;
    data: unknown;
    status?: number;
    duration?: number;
}

export interface ChatTabProps {
    showToast: (message: Omit<ToastMessage, 'id'>) => void;
}

// Re-export or extend base types if needed for chat-specific context
export type { BaseChatMessage as ChatMessage, BaseSource as Source, BaseSessionInfo as SessionInfo };
