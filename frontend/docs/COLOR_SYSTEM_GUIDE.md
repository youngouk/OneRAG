# 색상 관리 시스템 가이드

## 개요

이 프로젝트는 중앙 집중식 색상 관리 시스템을 사용하여 일관된 디자인과 유지보수성을 보장합니다. 모든 색상은 `src/config/colors.ts`에서 관리되며, 하드코딩된 hex 또는 rgba 값 사용은 ESLint 규칙으로 금지됩니다.

## 핵심 원칙

1. **단일 진실 공급원 (Single Source of Truth)**: 모든 색상은 `colors.ts`에서 정의
2. **Light/Dark 모드 지원**: 모든 색상은 테마별 값을 제공
3. **타입 안전성**: TypeScript의 `as const`를 사용한 불변 객체
4. **ESLint 강제**: 하드코딩된 색상 사용 시 빌드 에러 발생

## 색상 시스템 구조

### 파일 위치
```
src/config/colors.ts
```

### COLORS 객체 구조

```typescript
export const COLORS = {
  // 텍스트 색상
  text: {
    primary: { light: '#1a1a1a', dark: '#ffffff' },
    secondary: { light: '#666666', dark: '#b0b0b0' },
    tertiary: { light: '#999999', dark: '#808080' },
    disabled: { light: '#cccccc', dark: '#4d4d4d' }
  },

  // 배경 색상
  background: {
    primary: { light: '#ffffff', dark: '#1a1a1a' },
    secondary: { light: '#f5f5f5', dark: '#2d2d2d' },
    tertiary: { light: '#fafafa', dark: '#252525' }
  },

  // 인터랙티브 요소
  interactive: {
    default: { light: 'rgba(0, 0, 0, 0.04)', dark: 'rgba(255, 255, 255, 0.08)' },
    hover: { light: 'rgba(0, 0, 0, 0.08)', dark: 'rgba(255, 255, 255, 0.12)' },
    active: { light: 'rgba(0, 0, 0, 0.12)', dark: 'rgba(255, 255, 255, 0.16)' },
    disabled: { light: 'rgba(0, 0, 0, 0.02)', dark: 'rgba(255, 255, 255, 0.04)' }
  },

  // 테두리
  border: {
    default: { light: '#e0e0e0', dark: '#404040' },
    hover: { light: '#d0d0d0', dark: '#505050' },
    focus: { light: '#b0b0b0', dark: '#606060' }
  },

  // 그림자
  shadow: {
    sm: { light: '0 2px 8px rgba(0, 0, 0, 0.08)', dark: '0 2px 8px rgba(0, 0, 0, 0.3)' },
    md: { light: '0 4px 16px rgba(0, 0, 0, 0.12)', dark: '0 4px 16px rgba(0, 0, 0, 0.4)' },
    lg: { light: '0 8px 32px rgba(0, 0, 0, 0.16)', dark: '0 8px 32px rgba(0, 0, 0, 0.5)' }
  },

  // 차트 색상
  chart: {
    blue: '#0066cc',
    green: '#28a745',
    yellow: '#ffc107',
    purple: '#8884d8',
    background: { light: '#f8f9fa', dark: '#2d2d2d' },
    border: { light: '#e9ecef', dark: '#404040' },
    cardBg: { light: '#ffffff', dark: '#1e1e1e' }
  },

  // Material-UI 색상
  material: {
    blue: { light: '#1976d2', dark: '#64b5f6' },
    blueLight: { light: 'rgba(25, 118, 210, 0.08)', dark: 'rgba(100, 181, 246, 0.15)' }
  },

  // 시맨틱 색상
  semantic: {
    error: { light: '#d32f2f', dark: '#f44336' },
    warning: { light: '#ed6c02', dark: '#ff9800' },
    success: { light: '#2e7d32', dark: '#4caf50' },
    info: { light: '#0288d1', dark: '#29b6f6' }
  },

  // 공통 상수
  common: {
    headerGradient: {
      light: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 50%, #e8e8e8 100%)',
      dark: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #404040 100%)'
    },
    cardShadow: {
      light: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      dark: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
    },
    modalShadow: {
      light: '0 8px 40px rgba(0, 0, 0, 0.12)',
      dark: '0 8px 40px rgba(0, 0, 0, 0.5)'
    },
    hoverShadow: {
      light: '0 6px 20px rgba(0, 0, 0, 0.15)',
      dark: '0 6px 20px rgba(0, 0, 0, 0.6)'
    }
  }
} as const;
```

## 사용 방법

### 1. getColor() 헬퍼 함수 사용 (권장)

테마에 따라 자동으로 색상을 선택하는 헬퍼 함수입니다.

```typescript
import { getColor } from '../config/colors';

// Material-UI sx prop에서 사용
<Box sx={{
  color: (theme) => getColor('text.primary', theme.palette.mode),
  backgroundColor: (theme) => getColor('background.secondary', theme.palette.mode),
  boxShadow: (theme) => getColor('shadow.md', theme.palette.mode)
}} />
```

**getColor() 함수 시그니처**:
```typescript
function getColor(
  path: string,           // 점(.)으로 구분된 색상 경로 (예: 'text.primary')
  mode: 'light' | 'dark'  // 테마 모드
): string
```

### 2. COLORS 직접 사용

Recharts와 같이 테마 콜백을 지원하지 않는 라이브러리에서 사용합니다.

```typescript
import { COLORS } from '../config/colors';

// Recharts에서 사용
<Line
  type="monotone"
  dataKey="sessions"
  stroke={COLORS.chart.blue}
  strokeWidth={2}
/>

// 테마별 조건부 사용
<Box sx={{
  backgroundColor: (theme) =>
    theme.palette.mode === 'dark'
      ? COLORS.chart.background.dark
      : COLORS.chart.background.light
}} />
```

## 실제 사용 예시

### 예시 1: 헤더 그라데이션

```typescript
import { getColor } from '../config/colors';

<AppBar sx={{
  background: (theme) => getColor('common.headerGradient', theme.palette.mode),
  boxShadow: (theme) => getColor('shadow.sm', theme.palette.mode)
}} />
```

### 예시 2: 버튼 인터랙션

```typescript
import { getColor } from '../config/colors';

<Button sx={{
  bgcolor: (theme) => getColor('interactive.default', theme.palette.mode),
  '&:hover': {
    bgcolor: (theme) => getColor('interactive.hover', theme.palette.mode)
  },
  '&:active': {
    bgcolor: (theme) => getColor('interactive.active', theme.palette.mode)
  }
}} />
```

### 예시 3: 차트 색상

```typescript
import { COLORS } from '../config/colors';

<ResponsiveContainer width="100%" height="100%">
  <LineChart data={metrics?.timeSeries || []}>
    <Line type="monotone" dataKey="sessions" stroke={COLORS.chart.blue} />
    <Line type="monotone" dataKey="queries" stroke={COLORS.chart.green} />
    <Line type="monotone" dataKey="avgResponseTime" stroke={COLORS.chart.yellow} />
  </LineChart>
</ResponsiveContainer>
```

### 예시 4: 카드 그림자

```typescript
import { getColor } from '../config/colors';

<Alert
  severity="info"
  sx={{
    boxShadow: (theme) => getColor('common.cardShadow', theme.palette.mode)
  }}
>
  알림 메시지
</Alert>
```

## ESLint 규칙

### 규칙 내용 (eslint.config.js)

```javascript
rules: {
  'no-restricted-syntax': [
    'error',
    {
      selector: "Literal[value=/#[0-9A-Fa-f]{3,8}/]",
      message: '하드코딩된 hex 색상은 금지됩니다. src/config/colors.ts의 COLORS 또는 getColor()를 사용하세요.'
    },
    {
      selector: "Literal[value=/rgba?\\(/]",
      message: '하드코딩된 rgba/rgb 색상은 금지됩니다. src/config/colors.ts의 COLORS 또는 getColor()를 사용하세요.'
    }
  ]
}
```

### ESLint 에러 예시

**❌ 잘못된 사용**:
```typescript
// ESLint 에러 발생!
<Box sx={{ color: '#1976d2' }} />
<Box sx={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }} />
```

**✅ 올바른 사용**:
```typescript
// ESLint 통과
import { getColor, COLORS } from '../config/colors';

<Box sx={{
  color: (theme) => getColor('material.blue', theme.palette.mode)
}} />

<Box sx={{
  backgroundColor: (theme) => getColor('interactive.default', theme.palette.mode)
}} />
```

## 마이그레이션 가이드

### 기존 코드를 COLORS 시스템으로 마이그레이션하기

#### Step 1: Import 추가
```typescript
import { getColor } from '../config/colors';
// 또는
import { COLORS } from '../config/colors';
```

#### Step 2: 하드코딩된 색상 찾기
```bash
# hex 색상 찾기
grep -r "#[0-9A-Fa-f]\{3,8\}" src/components/YourComponent.tsx

# rgba 색상 찾기
grep -r "rgba(" src/components/YourComponent.tsx
```

#### Step 3: 적절한 색상 경로 찾기

`colors.ts`에서 가장 가까운 색상을 찾습니다:
- 텍스트 색상 → `text.*`
- 배경 색상 → `background.*`
- 버튼/링크 → `interactive.*`
- 차트 → `chart.*`
- Material-UI 파란색 → `material.blue`

#### Step 4: 교체

**Before**:
```typescript
<Box sx={{
  backgroundColor: '#f8f9fa',
  color: '#1976d2',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
}} />
```

**After**:
```typescript
<Box sx={{
  backgroundColor: (theme) => getColor('chart.background', theme.palette.mode),
  color: (theme) => getColor('material.blue', theme.palette.mode),
  boxShadow: (theme) => getColor('common.cardShadow', theme.palette.mode)
}} />
```

#### Step 5: 검증
```bash
npm run lint     # ESLint 검사
npm run build    # 프로덕션 빌드 테스트
```

## 새로운 색상 추가하기

### 1. colors.ts 수정

```typescript
export const COLORS = {
  // ... 기존 색상들

  // 새로운 카테고리 추가
  newCategory: {
    primary: { light: '#value1', dark: '#value2' },
    secondary: { light: '#value3', dark: '#value4' }
  }
} as const;
```

### 2. 타입 안전성 확인

TypeScript가 자동으로 타입을 추론하므로, `getColor('newCategory.primary', mode)` 형태로 바로 사용 가능합니다.

### 3. 문서 업데이트

이 가이드에 새로운 색상 카테고리를 추가합니다.

## 완료된 마이그레이션

### ✅ 완료된 컴포넌트
- `src/components/AppHeader.tsx` (20+ 인스턴스)
- `src/components/MarkdownRenderer.tsx` (10+ 인스턴스)
- `src/pages/Admin/AdminDashboard.tsx` (차트 색상 전체)
- `src/pages/AnalysisPage.tsx` (Alert shadow)
- `src/pages/ChatPage.tsx` (Alert shadow)
- `src/pages/PromptsPage.tsx` (Alert shadow)
- `src/pages/UploadPage.tsx` (Alert shadow)

### 🚧 남은 마이그레이션 작업

**우선순위 1 (다음 Sprint)**:
- `src/components/ChatEmptyState.tsx` (14건 - 최다)
- `src/components/ChatSettingsManager.tsx` (4건)
- `src/components/AccessControl.tsx` (3건)

**우선순위 2**:
- `src/components/Sidebar.tsx`
- `src/components/PageHeader.tsx`
- `src/pages/ChatPage.tsx` (나머지 하드코딩)
- `src/pages/UploadPage.tsx` (나머지 하드코딩)

**우선순위 3**:
- 모든 컴포넌트 전수 검사
- `brand.ts` 폐기 및 통합
- `theme.ts` 최적화

## 트러블슈팅

### Q: getColor()가 undefined를 반환합니다
**A**: 색상 경로가 올바른지 확인하세요. `colors.ts`에 해당 경로가 존재하는지 체크합니다.

```typescript
// ❌ 잘못된 경로
getColor('text.wrong', mode)

// ✅ 올바른 경로
getColor('text.primary', mode)
```

### Q: Recharts에서 색상이 변경되지 않습니다
**A**: Recharts는 props를 한 번만 읽으므로, COLORS 객체를 직접 사용하거나 key prop으로 리렌더링을 트리거해야 합니다.

```typescript
// ✅ 올바른 방법
<LineChart key={theme.palette.mode}>
  <Line stroke={COLORS.chart.blue} />
</LineChart>
```

### Q: ESLint 규칙을 일시적으로 비활성화하고 싶습니다
**A**: 긴급 상황에서만 사용하고, 이후 반드시 수정하세요.

```typescript
// eslint-disable-next-line no-restricted-syntax
const color = '#ff0000';
```

### Q: theme.palette.mode를 어떻게 얻나요?
**A**: Material-UI의 `sx` prop이나 `useTheme()` 훅을 사용합니다.

```typescript
import { useTheme } from '@mui/material/styles';

const theme = useTheme();
const currentMode = theme.palette.mode; // 'light' | 'dark'
```

## 참고 자료

- **색상 정의 파일**: `src/config/colors.ts`
- **ESLint 설정**: `eslint.config.js`
- **브랜드 설정 (향후 통합 예정)**: `src/config/brand.ts`
- **테마 설정**: `src/theme/index.ts`
- **Material-UI 테마 문서**: https://mui.com/material-ui/customization/theming/

## 버전 히스토리

- **v1.0.0** (2025-01-13): 초기 색상 시스템 구축 및 긴급 마이그레이션 완료
  - colors.ts 확장 (284라인)
  - 7개 주요 컴포넌트 마이그레이션
  - ESLint 규칙 추가
  - 문서화 완료
