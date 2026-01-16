import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
    const mockSetInput = vi.fn();
    const mockHandleSend = vi.fn();
    const mockHandleKeyPress = vi.fn();
    const mockHandleStop = vi.fn();

    const defaultProps = {
        input: '',
        setInput: mockSetInput,
        loading: false,
        handleSend: mockHandleSend,
        handleKeyPress: mockHandleKeyPress,
        handleStop: mockHandleStop,
    };

    it('should render input field and button', () => {
        render(<ChatInput {...defaultProps} />);
        expect(screen.getByPlaceholderText('메시지를 입력하세요...')).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should call setInput when typing', () => {
        render(<ChatInput {...defaultProps} />);
        const input = screen.getByPlaceholderText('메시지를 입력하세요...');
        fireEvent.change(input, { target: { value: 'test' } });
        expect(mockSetInput).toHaveBeenCalledWith('test');
    });

    it('should handle send button click when input is valid', () => {
        render(<ChatInput {...defaultProps} input="hello" />);
        const button = screen.getByRole('button');
        expect(button).not.toBeDisabled();
        fireEvent.click(button);
        expect(mockHandleSend).toHaveBeenCalled();
    });

    it('should disable button when input is empty and not loading', () => {
        render(<ChatInput {...defaultProps} input="" />);
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
    });

    it('should NOT disable button when loading (Stop button mode)', () => {
        render(<ChatInput {...defaultProps} input="hello" loading={true} />);
        const button = screen.getByRole('button');
        expect(button).not.toBeDisabled(); // Should be Stop button

        const input = screen.getByPlaceholderText('메시지를 입력하세요...');
        expect(input).toBeDisabled(); // Input remains disabled

        fireEvent.click(button);
        expect(mockHandleStop).toHaveBeenCalled();
    });

    it('should call handleKeyPress on key down', () => {
        render(<ChatInput {...defaultProps} />);
        const input = screen.getByPlaceholderText('메시지를 입력하세요...');
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        expect(mockHandleKeyPress).toHaveBeenCalled();
    });
});
