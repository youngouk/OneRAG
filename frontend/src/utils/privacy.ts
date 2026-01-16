/**
 * 개인정보 보호 유틸리티 모듈
 *
 * 전화번호, 이메일 등 민감 정보를 마스킹 처리하는 함수들을 제공합니다.
 *
 * @module privacy
 * @author Claude Code
 * @created 2025-11-18
 */

/**
 * 전화번호 마스킹 정규식 패턴
 *
 * 지원 형식:
 * - 010-1234-5678 (하이픈 구분)
 * - 010.1234.5678 (점 구분)
 * - 01012345678 (구분자 없음, 11자리)
 *
 * False Positive 방지:
 * - 단어 경계(\b)를 사용하여 숫자가 더 긴 패턴의 일부가 아닌 경우만 매칭
 * - "2010년 1234월 5678일" 같은 날짜 패턴 제외
 * - "010-12-34567" 같은 사업자등록번호 패턴 제외
 */
const PHONE_NUMBER_PATTERNS = {
  // 010-XXXX-XXXX 형식 (하이픈 구분)
  withHyphen: /\b010-\d{4}-\d{4}\b/g,

  // 010.XXXX.XXXX 형식 (점 구분)
  withDot: /\b010\.\d{4}\.\d{4}\b/g,

  // 010XXXXXXXX 형식 (구분자 없음, 정확히 11자리)
  withoutSeparator: /\b010\d{8}\b/g,
};

/**
 * 마스킹 옵션 인터페이스
 */
export interface MaskingOptions {
  /** 마스킹 대체 텍스트 (기본값: "[전화번호]") */
  replacement?: string;

  /** 성능 최적화: 빈 문자열/null 체크 (기본값: true) */
  skipEmpty?: boolean;

  /** 디버그 모드: 원본 텍스트와 마스킹된 텍스트를 콘솔에 출력 (기본값: false) */
  debug?: boolean;
}

/**
 * 텍스트에서 전화번호를 마스킹 처리합니다.
 *
 * @param text - 마스킹 처리할 원본 텍스트
 * @param options - 마스킹 옵션
 * @returns 전화번호가 마스킹된 텍스트
 *
 * @example
 * ```typescript
 * maskPhoneNumber("연락처: 010-1234-5678");
 * // => "연락처: [전화번호]"
 *
 * maskPhoneNumber("010.1234.5678로 연락주세요", { replacement: "***" });
 * // => "***로 연락주세요"
 *
 * maskPhoneNumber("01012345678 또는 010-8765-4321");
 * // => "[전화번호] 또는 [전화번호]"
 * ```
 *
 * @example
 * False Positive 방지 테스트:
 * ```typescript
 * maskPhoneNumber("2010년 1234월 5678일");
 * // => "2010년 1234월 5678일" (변경 없음)
 *
 * maskPhoneNumber("사업자등록번호: 010-12-34567");
 * // => "사업자등록번호: 010-12-34567" (변경 없음)
 * ```
 */
export function maskPhoneNumber(
  text: string | null | undefined,
  options: MaskingOptions = {}
): string {
  const {
    replacement = '[전화번호]',
    skipEmpty = true,
    debug = false,
  } = options;

  // 타입 가드: string이 아닌 경우 빈 문자열 반환 (먼저 체크)
  if (typeof text !== 'string') {
    if (text === null || text === undefined) {
      return '';
    }
    console.warn('[privacy] maskPhoneNumber: 입력값이 문자열이 아닙니다.', typeof text);
    return '';
  }

  // 빈 문자열 체크 (성능 최적화)
  if (skipEmpty && text.trim() === '') {
    return text;
  }

  const originalText = text;
  let maskedText = text;

  // 각 패턴에 대해 순차적으로 치환
  maskedText = maskedText
    .replace(PHONE_NUMBER_PATTERNS.withHyphen, replacement)
    .replace(PHONE_NUMBER_PATTERNS.withDot, replacement)
    .replace(PHONE_NUMBER_PATTERNS.withoutSeparator, replacement);

  // 디버그 모드: 변경 사항 출력
  if (debug && originalText !== maskedText) {
    console.log('[privacy] 전화번호 마스킹 적용:', {
      original: originalText,
      masked: maskedText,
      replacement,
    });
  }

  return maskedText;
}

/**
 * 객체의 모든 문자열 필드에 대해 전화번호 마스킹을 재귀적으로 적용합니다.
 *
 * @param data - 마스킹 처리할 객체 (배열 또는 일반 객체)
 * @param options - 마스킹 옵션
 * @returns 전화번호가 마스킹된 새 객체 (원본 객체는 변경되지 않음)
 *
 * @example
 * ```typescript
 * const userData = {
 *   name: "홍길동",
 *   contact: "010-1234-5678",
 *   address: "서울시 강남구",
 * };
 *
 * const masked = maskPhoneNumberDeep(userData);
 * // => {
 * //   name: "홍길동",
 * //   contact: "[전화번호]",
 * //   address: "서울시 강남구",
 * // }
 * ```
 *
 * @example
 * 배열 처리:
 * ```typescript
 * const messages = [
 *   { text: "연락처: 010-1234-5678" },
 *   { text: "이메일: test@example.com" },
 * ];
 *
 * const masked = maskPhoneNumberDeep(messages);
 * // => [
 * //   { text: "연락처: [전화번호]" },
 * //   { text: "이메일: test@example.com" },
 * // ]
 * ```
 */
export function maskPhoneNumberDeep<T>(
  data: T,
  options: MaskingOptions = {}
): T {
  // null, undefined 체크
  if (data == null) {
    return data;
  }

  // 문자열: 직접 마스킹 처리
  if (typeof data === 'string') {
    return maskPhoneNumber(data, options) as T;
  }

  // 배열: 각 요소에 대해 재귀 처리
  if (Array.isArray(data)) {
    return data.map((item) => maskPhoneNumberDeep(item, options)) as T;
  }

  // 객체: 각 필드에 대해 재귀 처리
  if (typeof data === 'object') {
    const maskedObject: Record<string, unknown> = {};

    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        maskedObject[key] = maskPhoneNumberDeep((data as Record<string, unknown>)[key], options);
      }
    }

    return maskedObject as T;
  }

  // 기타 타입 (숫자, boolean 등): 변경 없이 반환
  return data;
}

/**
 * React 컴포넌트에서 사용할 수 있는 메모이제이션된 마스킹 함수
 *
 * @param text - 마스킹 처리할 텍스트
 * @param deps - 의존성 배열 (React.useMemo의 deps와 동일)
 * @returns 마스킹된 텍스트
 *
 * @example
 * ```typescript
 * // 컴포넌트 내부에서 사용
 * const maskedMessage = useMemo(
 *   () => maskPhoneNumber(message.text),
 *   [message.text]
 * );
 * ```
 *
 * @deprecated React.useMemo를 직접 사용하는 것을 권장합니다.
 */
export function useMaskPhoneNumber(
  text: string | null | undefined,
  options?: MaskingOptions
): string {
  console.warn('[privacy] useMaskPhoneNumber는 deprecated되었습니다. React.useMemo를 직접 사용하세요.');
  return maskPhoneNumber(text, options);
}

/**
 * 성능 측정을 위한 마스킹 함수 (개발 환경 전용)
 *
 * @param text - 마스킹 처리할 텍스트
 * @param options - 마스킹 옵션
 * @returns 마스킹된 텍스트와 처리 시간(ms)
 *
 * @example
 * ```typescript
 * const [masked, time] = measureMaskingPerformance(largeText);
 * console.log(`마스킹 처리 시간: ${time}ms`);
 * ```
 */
export function measureMaskingPerformance(
  text: string,
  options?: MaskingOptions
): [string, number] {
  const startTime = performance.now();
  const result = maskPhoneNumber(text, options);
  const endTime = performance.now();
  const duration = endTime - startTime;

  console.log(`[privacy] 마스킹 처리 시간: ${duration.toFixed(3)}ms (${text.length}자)`);

  return [result, duration];
}

/**
 * 기본 export: maskPhoneNumber 함수
 */
export default maskPhoneNumber;
