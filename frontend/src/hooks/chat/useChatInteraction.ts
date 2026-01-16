import { useState, useRef, useEffect, useCallback } from 'react';
import { useMediaQuery } from '../useMediaQuery';
import { Source as SourceType, ToastMessage, ChatMessage } from '../../types';
import { logger } from '../../utils/logger';

interface UseChatInteractionProps {
    messages: ChatMessage[];
    showToast: (message: Omit<ToastMessage, 'id'>) => void;
}

export const useChatInteraction = ({ messages, showToast }: UseChatInteractionProps) => {
    // 스크롤 Ref
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 상태 관리
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedChunk, setSelectedChunk] = useState<SourceType | null>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [leftPanelTab, setLeftPanelTab] = useState(0);
    const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
    const [isDebugExpanded, setIsDebugExpanded] = useState<boolean>(false);
    const [messageAnimations, setMessageAnimations] = useState<Set<string>>(new Set());

    // 반응형 개발자 도구 상태
    const isMediumScreen = useMediaQuery('(max-width: 900px)'); // md 사이즈 이하

    const [showDevTools, setShowDevTools] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth >= 1024; // lg 사이즈 이상에서만 기본 표시
        }
        return true;
    });

    // 반응형 처리: 화면이 좁아지면 개발자 도구 자동 숨기기
    useEffect(() => {
        if (isMediumScreen && showDevTools) {
            setShowDevTools(false);
        }
    }, [isMediumScreen, showDevTools]);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
        setShowScrollButton(!isNearBottom);
    }, []);

    // 스크롤 함수
    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({
                behavior,
                block: 'end'
            });
        }
    }, []);

    // Effect for auto-scrolling on new messages
    useEffect(() => {
        if (!showScrollButton) {
            scrollToBottom();
        }
    }, [messages, showScrollButton, scrollToBottom]);

    // 메시지 애니메이션 및 스크롤 트리거
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            // 모든 메시지에 애니메이션 적용 (초기 로드 시)
            const allMessageIds = new Set(messages.map(msg => msg.id));
            setMessageAnimations(allMessageIds);
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [messages]);

    // 클립보드 복사
    const copyToClipboard = useCallback(async (text: string, successMessage: string = '복사되었습니다') => {
        try {
            await navigator.clipboard.writeText(text);
            showToast({
                type: 'success',
                message: successMessage,
            });
        } catch (err) {
            logger.error('복사 실패:', err);
            showToast({
                type: 'error',
                message: '복사에 실패했습니다',
            });
        }
    }, [showToast]);

    // 모달 핸들러
    const handleChunkClick = (source: SourceType) => {
        setSelectedChunk(source);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedChunk(null);
    };

    const toggleLogExpansion = (logId: string) => {
        setExpandedLogs((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(logId)) {
                newSet.delete(logId);
            } else {
                newSet.add(logId);
            }
            return newSet;
        });
    };

    return {
        messagesEndRef,
        scrollToBottom,
        modalOpen,
        selectedChunk,
        handleChunkClick,
        handleCloseModal,
        leftPanelTab,
        setLeftPanelTab,
        expandedLogs,
        toggleLogExpansion,
        isDebugExpanded,
        setIsDebugExpanded,
        messageAnimations,
        showDevTools,
        setShowDevTools,
        copyToClipboard,
        showScrollButton,
        handleScroll,
    };
};
