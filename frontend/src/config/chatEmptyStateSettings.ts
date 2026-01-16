/**
 * ChatEmptyState 설정 상수
 *
 * 챗봇 Empty State의 기본 설정값을 정의합니다.
 */

import type { ChatEmptyStateSettings } from '../types';

/**
 * ChatEmptyState 기본 설정
 */
export const CHAT_EMPTY_STATE_SETTINGS: ChatEmptyStateSettings = {
  mainMessage: '무엇을 도와드릴까요?',
  subMessage: 'AI가 참고 문서를 분석하여 정확한 답변을 제공합니다',
  suggestions: [
    '이 문서에서 핵심 내용을 요약해주세요',
    '기본 질문 설정1',
    '기본 질문 설정2',
    '기본 질문 설정3',
  ],
};

