/**
 * ChatEmptyState 설정 관리 서비스
 *
 * 챗봇 Empty State의 메시지와 추천 질문을 관리합니다.
 * localStorage를 사용하여 사용자별 설정을 저장합니다.
 */

import { ChatEmptyStateSettings, ChatEmptyStateSettingsUpdateRequest } from '../types';

// 기본 설정값
const DEFAULT_SETTINGS: ChatEmptyStateSettings = {
  mainMessage: '무엇을 도와드릴까요?',
  subMessage: 'AI가 참고 문서를 분석하여 정확한 답변을 제공합니다',
  suggestions: [
    '이 문서에서 핵심 내용을 요약해주세요',
    '기본 질문 설정1',
    '기본 질문 설정2',
    '기본 질문 설정3',
  ],
};

// localStorage 키
const STORAGE_KEY = 'chatEmptyStateSettings';

class ChatSettingsService {
  /**
   * 현재 설정 가져오기
   * localStorage에서 설정을 불러오며, 없으면 기본값 반환
   */
  getSettings(): ChatEmptyStateSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ChatEmptyStateSettings;
        // 기본값과 병합하여 누락된 필드 방지
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          // suggestions는 배열이므로 별도 처리
          suggestions: Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
            ? parsed.suggestions
            : DEFAULT_SETTINGS.suggestions,
        };
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('설정 로드 실패:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * 설정 업데이트
   * 부분 업데이트 지원 (제공된 필드만 변경)
   */
  updateSettings(updates: ChatEmptyStateSettingsUpdateRequest): ChatEmptyStateSettings {
    try {
      const current = this.getSettings();
      const updated: ChatEmptyStateSettings = {
        mainMessage: updates.mainMessage ?? current.mainMessage,
        subMessage: updates.subMessage ?? current.subMessage,
        suggestions: updates.suggestions ?? current.suggestions,
      };

      // 유효성 검사
      const errors = this.validateSettings(updated);
      if (errors.length > 0) {
        throw new Error(`설정 검증 실패: ${errors.join(', ')}`);
      }

      // localStorage에 저장
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('설정 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 기본 설정으로 초기화
   */
  resetToDefaults(): ChatEmptyStateSettings {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('설정 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 설정 유효성 검사
   * @returns 에러 메시지 배열 (빈 배열이면 유효함)
   */
  validateSettings(settings: ChatEmptyStateSettings | ChatEmptyStateSettingsUpdateRequest): string[] {
    const errors: string[] = [];

    // mainMessage 검사
    if ('mainMessage' in settings) {
      if (!settings.mainMessage || typeof settings.mainMessage !== 'string') {
        errors.push('메인 메시지는 필수입니다');
      } else if (settings.mainMessage.trim().length === 0) {
        errors.push('메인 메시지는 비어있을 수 없습니다');
      } else if (settings.mainMessage.length > 100) {
        errors.push('메인 메시지는 100자를 초과할 수 없습니다');
      }
    }

    // subMessage 검사
    if ('subMessage' in settings) {
      if (!settings.subMessage || typeof settings.subMessage !== 'string') {
        errors.push('보조 메시지는 필수입니다');
      } else if (settings.subMessage.trim().length === 0) {
        errors.push('보조 메시지는 비어있을 수 없습니다');
      } else if (settings.subMessage.length > 200) {
        errors.push('보조 메시지는 200자를 초과할 수 없습니다');
      }
    }

    // suggestions 검사
    if ('suggestions' in settings) {
      if (!Array.isArray(settings.suggestions)) {
        errors.push('추천 질문은 배열이어야 합니다');
      } else if (settings.suggestions.length === 0) {
        errors.push('최소 1개의 추천 질문이 필요합니다');
      } else if (settings.suggestions.length > 10) {
        errors.push('추천 질문은 최대 10개까지 가능합니다');
      } else {
        // 각 추천 질문 검사
        settings.suggestions.forEach((suggestion, index) => {
          if (typeof suggestion !== 'string') {
            errors.push(`추천 질문 ${index + 1}은 문자열이어야 합니다`);
          } else if (suggestion.trim().length === 0) {
            errors.push(`추천 질문 ${index + 1}은 비어있을 수 없습니다`);
          } else if (suggestion.length > 200) {
            errors.push(`추천 질문 ${index + 1}은 200자를 초과할 수 없습니다`);
          }
        });

        // 중복 검사
        const uniqueSuggestions = new Set(settings.suggestions.map(s => s.trim()));
        if (uniqueSuggestions.size !== settings.suggestions.length) {
          errors.push('중복된 추천 질문이 있습니다');
        }
      }
    }

    return errors;
  }

  /**
   * 기본 설정값 가져오기
   */
  getDefaultSettings(): ChatEmptyStateSettings {
    return { ...DEFAULT_SETTINGS };
  }
}

export const chatSettingsService = new ChatSettingsService();
