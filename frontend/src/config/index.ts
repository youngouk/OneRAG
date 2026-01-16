/**
 * 통합 설정 관리 시스템
 *
 * 모든 설정을 한 곳에서 관리하고 내보냅니다.
 * 고객사별 커스터마이징 시 이 파일에서 모든 설정을 확인할 수 있습니다.
 */

import { BRAND_CONFIG } from './brand';
import { COLORS } from './colors';
import { DEFAULT_FEATURES } from './features';
import { LAYOUT_CONFIG } from './layout';
import { CHAT_EMPTY_STATE_SETTINGS } from './chatEmptyStateSettings';

/**
 * 통합 앱 설정 인터페이스
 */
export interface AppConfig {
  // 브랜드 설정
  brand: typeof BRAND_CONFIG;
  // 색상 시스템
  colors: typeof COLORS;
  // 기능 플래그
  features: typeof DEFAULT_FEATURES;
  // 레이아웃 설정
  layout: typeof LAYOUT_CONFIG;
  // 채팅 Empty State 설정
  chatEmptyState: typeof CHAT_EMPTY_STATE_SETTINGS;
}

/**
 * 통합 설정 객체
 * 모든 설정에 접근할 수 있는 단일 진입점
 */
export const APP_CONFIG: AppConfig = {
  brand: BRAND_CONFIG,
  colors: COLORS,
  features: DEFAULT_FEATURES,
  layout: LAYOUT_CONFIG,
  chatEmptyState: CHAT_EMPTY_STATE_SETTINGS,
} as const;

/**
 * 개별 설정 재export (편의성)
 */
export {
  BRAND_CONFIG,
  COLORS,
  DEFAULT_FEATURES as FEATURE_FLAGS,
  LAYOUT_CONFIG,
  CHAT_EMPTY_STATE_SETTINGS,
};

/**
 * 헬퍼 함수 재export
 */
export { getColor } from './colors';
export { getSpacing, isBreakpoint, shouldCollapseSidebar } from './layout';
export { getPageTitle } from './brand';

/**
 * 고객사별 설정 로딩 시스템 (선택적 구현)
 *
 * 사용 예시:
 * ```typescript
 * // 1. public/config/ 폴더에 고객사별 JSON 파일 생성
 * // public/config/customer-a.json
 * {
 *   "brand": {
 *     "appName": "Customer A App",
 *     "logo": { "main": "/customer-a-logo.svg" }
 *   },
 *   "colors": {
 *     "text": {
 *       "primary": { "light": "#FF0000", "dark": "#FF5555" }
 *     }
 *   }
 * }
 *
 * // 2. 앱 시작 시 로드
 * const customerConfig = await loadCustomerConfig('customer-a');
 * mergeConfig(APP_CONFIG, customerConfig);
 * ```
 */

/**
 * 서버에서 고객사 설정 로드 (선택적)
 * @param customerId 고객사 ID
 * @returns 고객사별 설정 (부분)
 */
export async function loadCustomerConfig(customerId: string): Promise<Partial<AppConfig>> {
  try {
    const response = await fetch(`/config/${customerId}.json`);
    if (!response.ok) {
      console.warn(`고객사 설정 로드 실패: ${customerId}`);
      return {};
    }
    return await response.json();
  } catch (error) {
    console.error('고객사 설정 로드 오류:', error);
    return {};
  }
}

/**
 * 설정 병합 헬퍼 (깊은 병합)
 * @param target 기본 설정
 * @param source 오버라이드할 설정
 * @returns 병합된 설정
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function mergeConfig<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  console.log('🔀 [mergeConfig] 병합 시작');
  console.log('📥 [mergeConfig] target:', target);
  console.log('📥 [mergeConfig] source:', source);

  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const targetValue = result[key];
      const sourceValue = source[key];

      console.log(`🔑 [mergeConfig] 키 "${key}" 병합 중...`);
      console.log(`  - target값:`, targetValue);
      console.log(`  - source값:`, sourceValue);

      if (
        typeof targetValue === 'object' &&
        targetValue !== null &&
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(targetValue) &&
        !Array.isArray(sourceValue)
      ) {
        // 객체는 재귀적으로 병합
        console.log(`  ↳ 재귀 병합 (객체)`);
        result[key] = mergeConfig(targetValue, sourceValue);
      } else {
        // 원시값, 배열은 덮어쓰기
        console.log(`  ↳ 덮어쓰기 (원시값/배열)`);
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  console.log('✅ [mergeConfig] 병합 완료:', result);
  return result;
}

/**
 * 설정 유효성 검증
 * @param config 검증할 설정
 * @returns 유효성 여부
 */
export function validateConfig(config: Partial<AppConfig>): boolean {
  try {
    // 필수 필드 검증
    if (config.brand) {
      if (!config.brand.appName || !config.brand.logo) {
        console.error('브랜드 설정 오류: appName 또는 logo 누락');
        return false;
      }
    }

    // 색상 형식 검증
    if (config.colors) {
      // 기본적인 색상 구조 확인
      if (!config.colors.text) {
        console.error('색상 설정 오류: text 색상 누락');
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('설정 검증 오류:', error);
    return false;
  }
}

export default APP_CONFIG;
