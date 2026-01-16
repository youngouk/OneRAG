import React from 'react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onCitationClick?: (index: number) => void;
}

// 마크다운 파싱 인터페이스
interface MarkdownElement {
  type: 'heading' | 'list' | 'paragraph' | 'bold' | 'text' | 'divider' | 'numbered_list';
  level?: number;
  content?: string;
  children?: MarkdownElement[];
  listType?: 'bullet' | 'numbered';
}

// 마크다운 텍스트를 파싱하는 함수 (기존 로직 유지)
const parseMarkdown = (text: string): MarkdownElement[] => {
  const lines = text.split('\n');
  const elements: MarkdownElement[] = [];
  let currentListItems: { content: string; type: 'bullet' | 'numbered' }[] = [];
  let currentListType: 'bullet' | 'numbered' | null = null;

  const flushList = () => {
    if (currentListItems.length > 0 && currentListType) {
      elements.push({
        type: 'list',
        listType: currentListType,
        children: currentListItems.map(item => ({
          type: 'text',
          content: item.content
        }))
      });
      currentListItems = [];
      currentListType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '') {
      flushList();
      continue;
    }

    if (line.startsWith('###')) {
      flushList();
      elements.push({
        type: 'heading',
        level: 3,
        content: line.replace(/^###\s*/, '')
      });
    } else if (line.startsWith('##')) {
      flushList();
      elements.push({
        type: 'heading',
        level: 2,
        content: line.replace(/^##\s*/, '')
      });
    }
    else if (/^\d+\.\s/.test(line)) {
      const listContent = line.replace(/^\d+\.\s*/, '');
      if (currentListType !== 'numbered') {
        flushList();
        currentListType = 'numbered';
      }
      currentListItems.push({ content: listContent, type: 'numbered' });
    }
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      const listContent = line.replace(/^[-*]\s*/, '');
      if (currentListType !== 'bullet') {
        flushList();
        currentListType = 'bullet';
      }
      currentListItems.push({ content: listContent, type: 'bullet' });
    }
    else {
      flushList();
      elements.push({
        type: 'paragraph',
        content: line
      });
    }
  }

  flushList();
  return elements;
};

// 볼드 텍스트와 인용구 렌더링
const renderTextWithContext = (text: string, onCitationClick?: (index: number) => void) => {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-bold text-primary italic px-0.5">
          {boldText}
        </strong>
      );
    }

    const citationMatch = part.match(/^\[(\d+)\]$/);
    if (citationMatch) {
      const citationIndex = parseInt(citationMatch[1], 10);
      return (
        <span
          key={index}
          className="citation-marker inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-sm mx-0.5 cursor-pointer hover:bg-blue-600 transition-colors align-super"
          onClick={() => onCitationClick?.(citationIndex)}
        >
          {citationIndex}
        </span>
      );
    }

    return <span key={index}>{part}</span>;
  });
};

// 요소별 렌더링
const renderElement = (
  element: MarkdownElement,
  index: number,
  onCitationClick?: (index: number) => void
): React.ReactNode => {
  switch (element.type) {
    case 'heading': {
      const levelClass = element.level === 2 ? "text-lg font-bold" : "text-base font-bold";
      return (
        <div key={index} className="mb-4">
          <div className={cn(
            levelClass,
            "border-l-4 border-blue-500 pl-3 bg-blue-500/5 py-1 rounded-r-md"
          )}>
            {element.content}
          </div>
        </div>
      );
    }

    case 'list': {
      const isNumbered = element.listType === 'numbered';
      const ListTag = isNumbered ? 'ol' : 'ul';
      return (
        <div key={index} className="mb-4">
          <ListTag className={cn(
            "py-2 px-3 space-y-2 rounded-lg border",
            isNumbered ? "bg-blue-500/5 border-blue-500/20" : "bg-muted/30 border-border/50"
          )}>
            {element.children?.map((child, childIndex) => (
              <li key={childIndex} className="flex items-start gap-2 text-sm leading-relaxed">
                <span className="font-bold text-blue-500 min-w-[18px]">
                  {isNumbered ? `${childIndex + 1}.` : '•'}
                </span>
                <div className="flex-1">
                  {renderTextWithContext(child.content || '', onCitationClick)}
                </div>
              </li>
            ))}
          </ListTag>
        </div>
      );
    }

    case 'paragraph': {
      const isWarning = element.content?.startsWith('**') && element.content?.includes('추측한 답변') && element.content?.endsWith('**');

      return (
        <p key={index} className={cn(
          "mb-3 text-sm leading-relaxed",
          isWarning && "bg-yellow-500/10 text-yellow-600 p-4 rounded-lg border border-yellow-500/20 italic"
        )}>
          {renderTextWithContext(element.content || '', onCitationClick)}
        </p>
      );
    }

    default:
      return null;
  }
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className, onCitationClick }) => {
  const elements = parseMarkdown(content);

  return (
    <div className={cn("markdown-content", className)}>
      {elements.map((element, index) => renderElement(element, index, onCitationClick))}
    </div>
  );
};

export default MarkdownRenderer;