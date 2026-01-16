import { parseHtmlContent } from './htmlParser';

export const formatSourcePreview = (text?: string, limit = 220): string => {
    if (!text) {
        return '미리보기를 제공하지 않는 문서입니다.';
    }

    // HTML 콘텐츠 파싱
    const processedText = parseHtmlContent(text);

    // 미리보기용 텍스트 처리
    const previewText = processedText
        // 테이블 시작/끝 표시를 더 간결하게
        .replace(/테이블 시작/g, '📊')
        .replace(/테이블 끝/g, '')
        .replace(/📊 테이블/g, '📊')
        .replace(/────────────────────/g, '')
        // 연속된 줄바꿈을 공백으로 변경 (미리보기에서는 간결하게)
        .replace(/\n+/g, ' ')
        // 연속된 공백 정리
        .replace(/\s+/g, ' ')
        .trim();

    return previewText.length > limit ? `${previewText.slice(0, limit)}…` : previewText;
};

// 전체 콘텐츠 포맷팅 함수
export const formatFullContent = (text?: string): string => {
    if (!text) {
        return '내용을 불러올 수 없습니다.';
    }

    // HTML 콘텐츠 파싱
    const processedText = parseHtmlContent(text);

    // 전체 콘텐츠용 추가 정리
    return processedText
        // 테이블 표시를 더 명확하게 (DOMParser에서 이미 처리했지만 한번 더 보정)
        .replace(/테이블 시작/g, '\n📊 테이블\n────────────────────\n')
        .replace(/테이블 끝/g, '────────────────────\n')
        // 최종 줄바꿈과 공백 정리
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

export const formatModelConfigValue = (value: unknown): string => {
    if (value === null) {
        return 'null';
    }

    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number') {
        return value.toString();
    }

    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }

    if (Array.isArray(value)) {
        return value.map((item) => formatModelConfigValue(item)).join(', ');
    }

    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return String(value);
};

export const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
    });
};
