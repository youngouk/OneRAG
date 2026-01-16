import React from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    loading: boolean;
    handleSend: () => void;
    handleStop: () => void;
    handleKeyPress: (e: React.KeyboardEvent) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    input,
    setInput,
    loading,
    handleSend,
    handleStop,
    handleKeyPress,
}) => {
    return (
        <div className="px-4 py-4 bg-background/50 backdrop-blur-md border-t border-border/50">
            <div className="flex gap-2 items-end max-w-4xl mx-auto">
                <div className="relative flex-1 group">
                    <Textarea
                        placeholder="메시지를 입력하세요..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        disabled={loading}
                        className={cn(
                            "flex-1 min-h-[48px] max-h-48 rounded-[24px] bg-muted/30 border-border/50 focus-visible:ring-primary/10 transition-all resize-none py-3 px-6 pr-12 text-sm leading-relaxed",
                            "group-hover:bg-muted/50 group-focus-within:bg-background group-focus-within:shadow-sm"
                        )}
                    />
                </div>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={loading ? handleStop : handleSend}
                                disabled={!loading && !input.trim()}
                                size="icon"
                                className={cn(
                                    "h-[48px] w-[48px] rounded-full transition-all duration-300 shadow-md",
                                    loading
                                        ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse"
                                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                                )}
                            >
                                {loading ? (
                                    <Square className="w-5 h-5 fill-current" />
                                ) : (
                                    <Send className="w-5 h-5 ml-0.5" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            {loading ? "중단하기" : "보내기"}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
};

