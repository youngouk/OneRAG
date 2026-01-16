/**
 * 프롬프트 관리 API 서비스
 * 백엔드 프롬프트 CRUD 작업 처리
 */

import api from './api';

// 프롬프트 타입 정의
export interface Prompt {
  id: string;
  name: string;
  content: string;
  description: string;
  category: 'system' | 'style' | 'custom';
  is_active: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PromptListResponse {
  prompts: Prompt[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreatePromptRequest {
  name: string;
  content: string;
  description: string;
  category: 'system' | 'style' | 'custom';
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdatePromptRequest {
  name?: string;
  content?: string;
  description?: string;
  category?: 'system' | 'style' | 'custom';
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PromptExport {
  prompts: Prompt[];
  exported_at: string;
  total: number;
}

export interface PromptImportRequest {
  prompts: Prompt[];
  exported_at: string;
  total: number;
}

// 프롬프트 스타일 옵션
export const PROMPT_STYLES = [
  { value: 'system', label: '기본', description: '표준 시스템 프롬프트' },
  { value: 'detailed', label: '자세한 답변', description: '상세하고 포괄적인 응답' },
  { value: 'concise', label: '간결한 답변', description: '핵심만 간단하게' },
  { value: 'professional', label: '전문적 답변', description: '비즈니스 및 전문 분야용' },
  { value: 'educational', label: '교육적 답변', description: '학습 및 설명 중심' },
] as const;

export const PROMPT_CATEGORIES = [
  { value: 'system', label: '시스템', description: '기본 시스템 프롬프트' },
  { value: 'style', label: '스타일', description: '답변 스타일 프롬프트' },
  { value: 'custom', label: '커스텀', description: '사용자 정의 프롬프트' },
] as const;

class PromptService {
  // 프롬프트 목록 조회
  async getPrompts(params?: {
    category?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
    search?: string;
  }): Promise<PromptListResponse> {
    const response = await api.get<PromptListResponse>('/api/prompts', { params });
    return response.data;
  }

  // 특정 프롬프트 조회 (ID)
  async getPrompt(id: string): Promise<Prompt> {
    const response = await api.get<Prompt>(`/api/prompts/${id}`);
    return response.data;
  }

  // 이름으로 프롬프트 조회
  async getPromptByName(name: string): Promise<Prompt> {
    const response = await api.get<Prompt>(`/api/prompts/by-name/${name}`);
    return response.data;
  }

  // 새 프롬프트 생성
  async createPrompt(promptData: CreatePromptRequest): Promise<Prompt> {
    const response = await api.post<Prompt>('/api/prompts', promptData);
    return response.data;
  }

  // 프롬프트 수정
  async updatePrompt(id: string, promptData: UpdatePromptRequest): Promise<Prompt> {
    const response = await api.put<Prompt>(`/api/prompts/${id}`, promptData);
    return response.data;
  }

  // 프롬프트 삭제
  async deletePrompt(id: string): Promise<void> {
    await api.delete(`/api/prompts/${id}`);
  }

  // 프롬프트 활성화/비활성화 토글
  async togglePrompt(id: string, is_active: boolean): Promise<Prompt> {
    return this.updatePrompt(id, { is_active });
  }

  // 모든 프롬프트 내보내기 (백업)
  async exportPrompts(): Promise<PromptExport> {
    const response = await api.get<PromptExport>('/api/prompts/export/all');
    return response.data;
  }

  // 프롬프트 가져오기 (복원)
  async importPrompts(data: PromptImportRequest, overwrite = false): Promise<{ message: string; imported: number }> {
    const response = await api.post<{ message: string; imported: number }>(
      `/api/prompts/import?overwrite=${overwrite}`,
      data
    );
    return response.data;
  }

  // 프롬프트 복제
  async duplicatePrompt(id: string, newName: string): Promise<Prompt> {
    const original = await this.getPrompt(id);
    return this.createPrompt({
      name: newName,
      content: original.content,
      description: `${original.description} (복사본)`,
      category: original.category === 'system' ? 'custom' : original.category,
      is_active: false, // 복사본은 기본적으로 비활성화
      metadata: original.metadata,
    });
  }

  // 프롬프트 검증
  validatePrompt(promptData: CreatePromptRequest | UpdatePromptRequest): string[] {
    const errors: string[] = [];

    if ('name' in promptData) {
      if (!promptData.name || promptData.name.trim().length < 2) {
        errors.push('프롬프트 이름은 2자 이상이어야 합니다.');
      }
      if (promptData.name.includes(' ')) {
        errors.push('프롬프트 이름에는 공백을 포함할 수 없습니다.');
      }
    }

    if ('content' in promptData) {
      if (!promptData.content || promptData.content.trim().length < 10) {
        errors.push('프롬프트 내용은 10자 이상이어야 합니다.');
      }
    }

    if ('description' in promptData) {
      if (!promptData.description || promptData.description.trim().length < 5) {
        errors.push('프롬프트 설명은 5자 이상이어야 합니다.');
      }
    }

    return errors;
  }

  // 프롬프트 미리보기용 축약
  getContentPreview(content: string, maxLength = 100): string {
    return content.length > maxLength 
      ? `${content.substring(0, maxLength)}...` 
      : content;
  }

  // 스타일별 프롬프트 사용 통계 (향후 확장 가능)
  getStyleUsageStats(): { [key: string]: number } {
    // 실제로는 백엔드에서 제공할 수 있는 기능
    const stats = localStorage.getItem('prompt_usage_stats');
    return stats ? JSON.parse(stats) : {};
  }
}

export const promptService = new PromptService();
export default promptService;