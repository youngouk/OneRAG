/**
 * axe-core 접근성 테스트 헬퍼
 * WCAG 2.1 자동 검증
 */
import { configureAxe, toHaveNoViolations } from 'jest-axe';
import type { AxeResults, RunOptions } from 'axe-core';

// jest-dom 확장
expect.extend(toHaveNoViolations);

/**
 * axe 설정
 * WCAG 2.1 Level AA 기준
 */
export const axe = configureAxe({
  rules: {
    // WCAG 2.1 Level AA 규칙 활성화
    'color-contrast': { enabled: true },
    'valid-lang': { enabled: true },
    'html-has-lang': { enabled: true },
    'aria-allowed-attr': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    'button-name': { enabled: true },
    'image-alt': { enabled: true },
    'input-button-name': { enabled: true },
    'label': { enabled: true },
    'link-name': { enabled: true },
    'list': { enabled: true },
    'listitem': { enabled: true },
  },
});

/**
 * 컴포넌트 접근성 검증
 * @param container - 테스트할 DOM 컨테이너
 * @param options - axe 실행 옵션
 */
export async function checkA11y(
  container: HTMLElement,
  options?: RunOptions
): Promise<AxeResults> {
  const results = await axe(container, options);

  // 위반사항 로깅
  if (results.violations.length > 0) {
    console.error('접근성 위반사항:', results.violations);
  }

  return results;
}

/**
 * WCAG Level 검증
 */
export const wcagLevels = {
  A: { runOnly: { type: 'tag' as const, values: ['wcag2a', 'wcag21a'] } },
  AA: { runOnly: { type: 'tag' as const, values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } },
  AAA: { runOnly: { type: 'tag' as const, values: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'] } },
};

/**
 * 특정 규칙만 테스트
 */
export function createAxeWithRules(rules: string[]): typeof axe {
  return configureAxe({
    rules: rules.reduce((acc, rule) => {
      acc[rule] = { enabled: true };
      return acc;
    }, {} as Record<string, { enabled: boolean }>),
  });
}

/**
 * 접근성 위반사항 포맷팅
 */
export function formatViolations(results: AxeResults): string {
  if (results.violations.length === 0) {
    return '✅ 접근성 위반사항 없음';
  }

  return results.violations
    .map((violation) => {
      const nodes = violation.nodes.map((node) => {
        return `  - ${node.html}\n    ${node.failureSummary}`;
      }).join('\n');

      return `
❌ ${violation.id} (${violation.impact})
${violation.description}
${violation.helpUrl}
영향받는 요소:
${nodes}
`;
    })
    .join('\n');
}
