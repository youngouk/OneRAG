import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatHeader } from '../ChatHeader';
import { TooltipProvider } from '@/components/ui/tooltip';

describe('ChatHeader', () => {
    const mockSetShowDevTools = vi.fn();
    const mockOnNewSession = vi.fn();
    const defaultProps = {
        sessionId: 'session-12345678',
        showDevTools: false,
        setShowDevTools: mockSetShowDevTools,
        onNewSession: mockOnNewSession,
    };

    const renderWithContext = (element: React.ReactElement) => {
        return render(
            <TooltipProvider>
                {element}
            </TooltipProvider>
        );
    };

    it('should render session ID correctly', () => {
        renderWithContext(<ChatHeader {...defaultProps} />);
        expect(screen.getByText(/세션: session-/i)).toBeInTheDocument();
    });

    it('should show developer tools button when showDevTools is false', () => {
        renderWithContext(<ChatHeader {...defaultProps} />);
        const button = screen.getByTitle('개발자 도구 보기');
        expect(button).toBeInTheDocument();
        fireEvent.click(button);
        expect(mockSetShowDevTools).toHaveBeenCalledWith(true);
    });

    it('should hide developer tools button when showDevTools is true', () => {
        renderWithContext(<ChatHeader {...defaultProps} showDevTools={true} />);
        const button = screen.queryByTitle('개발자 도구 보기');
        expect(button).not.toBeInTheDocument();
    });

    it('should render title and subtitle', () => {
        renderWithContext(<ChatHeader {...defaultProps} />);
        expect(screen.getByText('HEXA RAG Chat')).toBeInTheDocument();
        expect(screen.getByText('- 궁금한 것을 질문해주세요!')).toBeInTheDocument();
    });

    it('should call onNewSession when new chat button is clicked', () => {
        renderWithContext(<ChatHeader {...defaultProps} />);
        const button = screen.getByTitle('새 대화 시작');
        fireEvent.click(button);
        expect(mockOnNewSession).toHaveBeenCalled();
    });
});

