# 고객사 커스터마이징 가이드

이 문서는 외주 개발 시 고객사별 브랜딩 및 기능 커스터마이징 방법을 설명합니다.

## 목차

1. [개요](#개요)
2. [로고 교체](#로고-교체)
3. [브랜드 설정](#브랜드-설정)
4. [색상 시스템](#색상-시스템)
5. [테마 프리셋](#테마-프리셋) ⭐ **신규**
6. [레이아웃 설정](#레이아웃-설정)
7. [기능 플래그](#기능-플래그)
8. [채팅 Empty State 설정](#채팅-empty-state-설정)
9. [통합 설정 관리](#통합-설정-관리)
10. [런타임 설정 로드](#런타임-설정-로드)
11. [관리자 설정 UI](#관리자-설정-ui) ⭐ **신규**

---

## 개요

이 시스템은 다음과 같은 커스터마이징을 지원합니다:

- ✅ **로고 교체**: 간단한 파일 교체로 고객사 로고 적용
- ✅ **브랜드 설정**: 앱 이름, 타이틀, 로고 경로 등
- ✅ **색상 시스템**: 중앙 집중식 색상 관리 (Light/Dark 모드 지원)
- ✅ **테마 프리셋**: 8가지 미리 정의된 색상 조합 (모노톤, 블루, 그린, 퍼플 등) ⭐
- ✅ **레이아웃 설정**: 사이드바, 헤더, 간격, 애니메이션 등
- ✅ **기능 플래그**: 모듈별 기능 on/off
- ✅ **채팅 설정**: Empty State 메시지 및 추천 질문
- ✅ **런타임 로드**: JSON 파일로 동적 설정 변경
- ✅ **관리자 설정 UI**: GUI로 설정 변경 (코드 수정 불필요) ⭐

---

## 로고 교체

### 가장 간단한 방법 (권장)

1. **파일 교체만으로 완료**:
   ```bash
   # 고객사 로고 파일을 준비하고
   cp customer-logo.svg public/logo.svg

   # 빌드 (재빌드 필수)
   npm run build
   ```

2. **지원 파일 형식**:
   - SVG (권장): 크기 조절에 유리
   - PNG/WebP: 고해상도 이미지

### 로고 설정 커스터마이징

`src/config/brand.ts`에서 로고 관련 설정을 변경할 수 있습니다:

```typescript
export const BRAND_CONFIG = {
  logo: {
    // 메인 로고 경로
    main: '/logo.svg', // ← 여기를 변경

    // 파비콘
    favicon: '/favicon.ico',

    // 다양한 크기의 아이콘
    icon192: '/icon-192x192.png',
    icon512: '/icon-512x512.png',

    // 애플 터치 아이콘
    appleTouchIcon: '/apple-touch-icon.png',

    // 로고 대체 텍스트
    alt: 'Company Logo', // ← 회사명으로 변경

    // 로고 사용 방식
    type: 'image' as 'image' | 'svg-component',

    // 폴백 이미지 (선택사항)
    fallback: '/logo-fallback.png',
  },
};
```

### SVG 컴포넌트 사용 (선택사항)

코드로 SVG를 직접 관리하고 싶다면:

1. `BRAND_CONFIG.logo.type`을 `'svg-component'`로 변경
2. `src/components/icons/BrandLogo.tsx`의 `SVGLogoFallback` 컴포넌트 수정

---

## 브랜드 설정

`src/config/brand.ts` 파일에서 브랜드 관련 모든 설정을 관리합니다:

```typescript
export const BRAND_CONFIG = {
  // 앱 이름
  appName: 'Your Company Name',
  appTitle: 'Your Company Name - AI Chat',

  // 로고 설정 (위 참조)
  logo: {
    main: '/logo.svg',
    favicon: '/favicon.ico',
    // ...
  },

  // 나머지 설정은 colors.ts에서 관리 (아래 참조)
};
```

---

## 색상 시스템

색상은 `src/config/colors.ts`에서 **중앙 집중 관리**됩니다.

### 색상 변경 방법

```typescript
export const COLORS = {
  brand: {
    primary: {
      light: '#your-primary-light',
      dark: '#your-primary-dark',
    },
    secondary: {
      light: '#your-secondary-light',
      dark: '#your-secondary-dark',
    },
    accent: {
      light: '#your-accent-light',
      dark: '#your-accent-dark',
    },
  },

  // 상태 색상 (선택적 변경)
  semantic: {
    success: { light: '#4caf50', dark: '#66bb6a' },
    warning: { light: '#ff9800', dark: '#ffa726' },
    error: { light: '#f44336', dark: '#ef5350' },
    info: { light: '#2196f3', dark: '#42a5f5' },
  },

  // ... 나머지 색상
};
```

### 색상 사용 예시

컴포넌트에서:

```typescript
import { getColor } from '../config/colors';

<Box
  sx={{
    bgcolor: (theme) => getColor('brand.primary', theme.palette.mode),
    color: (theme) => getColor('text.primary', theme.palette.mode),
  }}
>
```

⚠️ **중요**: 하드코딩된 hex/rgba 색상 사용 금지! (ESLint 규칙으로 강제)

상세한 내용은 [색상 관리 시스템 가이드](COLOR_SYSTEM_GUIDE.md)를 참조하세요.

---

## 테마 프리셋

⭐ **신규 기능**: 8가지 미리 정의된 색상 조합을 제공하여 즉시 적용할 수 있습니다.

### 사용 가능한 프리셋

1. **모노톤 (Monotone)** - 기본값
   - 깔끔한 흑백 디자인으로 전문적인 느낌
   - Primary: #000000, Secondary: #666666, Accent: #999999

2. **모던 블루 (Modern Blue)**
   - 신뢰감 있는 블루 톤으로 기업 이미지에 적합
   - Primary: #2196f3, Secondary: #1976d2, Accent: #03a9f4

3. **코퍼레이트 그린 (Corporate Green)**
   - 친환경적이고 안정적인 그린 톤
   - Primary: #4caf50, Secondary: #388e3c, Accent: #8bc34a

4. **엘레강트 퍼플 (Elegant Purple)**
   - 고급스럽고 창의적인 퍼플 톤
   - Primary: #9c27b0, Secondary: #7b1fa2, Accent: #ba68c8

5. **웜 오렌지 (Warm Orange)**
   - 따뜻하고 활기찬 오렌지 톤
   - Primary: #ff9800, Secondary: #f57c00, Accent: #ffb74d

6. **프로페셔널 그레이 (Professional Gray)**
   - 차분하고 전문적인 그레이 톤
   - Primary: #607d8b, Secondary: #455a64, Accent: #90a4ae

7. **바이브런트 레드 (Vibrant Red)**
   - 강렬하고 열정적인 레드 톤
   - Primary: #f44336, Secondary: #d32f2f, Accent: #ff5252

8. **틸 시안 (Teal Cyan)**
   - 시원하고 현대적인 틸 톤
   - Primary: #009688, Secondary: #00796b, Accent: #4db6ac

### 프리셋 적용 방법

#### 방법 1: 관리자 설정 UI (권장) ⭐

1. 관리자 대시보드 접속 (`/admin`)
2. "설정" 탭 선택
3. "색상 프리셋" 탭에서 원하는 프리셋 선택
4. "저장" 버튼 클릭
5. 페이지 새로고침

#### 방법 2: 코드로 직접 적용

```typescript
import { applyPreset, exportPresetAsJSON } from './config/presets';

// 프리셋 적용
const colors = applyPreset('modernBlue');

// JSON으로 내보내기
const json = exportPresetAsJSON('modernBlue');
// 파일 저장하여 public/config/에 배치
```

#### 방법 3: JSON 파일로 배포

```bash
# 1. 프리셋 JSON 생성
# 관리자 설정 UI에서 "JSON 내보내기" 클릭

# 2. public/config/customer-a.json에 저장
# (또는 직접 작성)

# 3. 런타임 로드 (아래 "런타임 설정 로드" 섹션 참조)
```

### 커스텀 프리셋 생성

`src/config/presets/index.ts`에서 새로운 프리셋을 추가할 수 있습니다:

```typescript
export const THEME_PRESETS: Record<string, ThemePreset> = {
  // ... 기존 프리셋

  // 새 프리셋 추가
  myCustomPreset: {
    id: 'myCustomPreset',
    name: '내 커스텀 프리셋',
    description: '우리 회사 브랜드 색상',
    colors: {
      brand: {
        primary: {
          light: '#your-color-light',
          dark: '#your-color-dark',
        },
        secondary: {
          light: '#your-secondary-light',
          dark: '#your-secondary-dark',
        },
        accent: {
          light: '#your-accent-light',
          dark: '#your-accent-dark',
        },
      },
      // ... 더 많은 색상 설정
    },
    preview: {
      primaryColor: '#your-color-light',
      secondaryColor: '#your-secondary-light',
      accentColor: '#your-accent-light',
    },
  },
};
```

---

## 레이아웃 설정

`src/config/layout.ts`에서 모든 레이아웃 값을 관리합니다.

### 주요 설정 항목

```typescript
export const LAYOUT_CONFIG = {
  // 사이드바 설정
  sidebar: {
    width: 240,           // 펼쳐진 상태 너비 (px)
    collapsedWidth: 60,   // 접힌 상태 너비 (px)
    position: 'left',     // 사이드바 위치
    showOnMobile: false,  // 모바일에서 표시 여부
    collapseBreakpoint: 960, // 자동 접힘 breakpoint (px)
  },

  // 헤더 설정
  header: {
    height: 64,           // 헤더 높이 (px)
    showLogo: true,       // 로고 표시
    showTitle: true,      // 타이틀 표시
    showSearch: false,    // 검색바 표시
    sticky: true,         // 고정 헤더
  },

  // 콘텐츠 영역 설정
  content: {
    maxWidth: 1440,       // 최대 너비 (px, 0 = 무제한)
    padding: 24,          // 패딩 (px)
    paddingMobile: 16,    // 모바일 패딩 (px)
    gap: 16,              // 요소 간 간격 (px)
  },

  // 반응형 breakpoints (Material-UI 기본값 기반)
  breakpoints: {
    xs: 0,     // Extra small (모바일)
    sm: 600,   // Small (태블릿)
    md: 960,   // Medium (작은 데스크톱)
    lg: 1280,  // Large (데스크톱)
    xl: 1920,  // Extra large (큰 화면)
  },

  // 간격 시스템
  spacing: {
    unit: 8,    // 기본 단위 (px)
    xs: 4,      // 4px
    sm: 8,      // 8px
    md: 16,     // 16px
    lg: 24,     // 24px
    xl: 32,     // 32px
    xxl: 48,    // 48px
  },

  // 애니메이션 설정
  animation: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195,
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    },
  },

  // Z-index 계층
  zIndex: {
    mobileStepper: 1000,
    appBar: 1100,
    drawer: 1200,
    modal: 1300,
    snackbar: 1400,
    tooltip: 1500,
  },

  // 테두리 반경
  borderRadius: {
    xs: 2,      // 2px
    sm: 4,      // 4px
    md: 8,      // 8px
    lg: 12,     // 12px
    xl: 16,     // 16px
    round: '50%',
  },
};
```

### 헬퍼 함수

```typescript
// 간격 계산
import { getSpacing } from '../config/layout';
const padding = getSpacing(3); // 24px (8 * 3)

// 반응형 확인
import { isBreakpoint } from '../config/layout';
if (isBreakpoint(windowWidth, 'md')) {
  // md breakpoint 이상
}

// 사이드바 자동 접힘 확인
import { shouldCollapseSidebar } from '../config/layout';
if (shouldCollapseSidebar(windowWidth)) {
  // 사이드바 자동 접기
}
```

---

## 기능 플래그

`src/config/featureFlags.ts`에서 모듈별 기능을 on/off 합니다.

### 기능 플래그 설정

```typescript
export const FEATURE_FLAGS = {
  modules: {
    chatbot: true,              // 챗봇 기능
    documentManagement: true,   // 문서 관리
    prompts: true,              // 프롬프트 관리
    analysis: true,             // 통계 분석
    admin: true,                // 관리자 기능
  },

  features: {
    darkMode: true,             // 다크모드
    multiLanguage: false,       // 다국어 (현재 미지원)
    notifications: true,        // 알림
    search: true,               // 검색
    export: true,               // 내보내기
    import: true,               // 가져오기
  },

  ui: {
    showWelcomeMessage: true,   // 웰컴 메시지
    showServerStatus: true,     // 서버 상태 표시
    enableAnimations: true,     // 애니메이션
    compactMode: false,         // 컴팩트 모드
  },
};
```

### 사용 예시

```typescript
import { useIsModuleEnabled } from '../core/useFeature';

function MyComponent() {
  const isAnalysisEnabled = useIsModuleEnabled('analysis');

  if (!isAnalysisEnabled) {
    return <div>통계 기능이 비활성화되었습니다.</div>;
  }

  return <AnalysisDashboard />;
}
```

상세한 내용은 [기능 플래그 가이드](FEATURE_FLAGS_GUIDE.md)를 참조하세요.

---

## 채팅 Empty State 설정

`src/config/chatEmptyStateSettings.ts`에서 챗봇 빈 화면 메시지 및 추천 질문을 설정합니다.

### 설정 예시

```typescript
export const CHAT_EMPTY_STATE_SETTINGS = {
  // 빈 채팅 화면 메시지
  emptyMessage: {
    title: "환영합니다! 무엇을 도와드릴까요?",
    subtitle: "아래 추천 질문을 선택하거나 직접 질문을 입력해보세요.",
  },

  // 추천 질문 목록
  suggestedQuestions: [
    {
      id: 1,
      question: "이 시스템의 주요 기능은 무엇인가요?",
      category: "general",
    },
    {
      id: 2,
      question: "문서를 어떻게 업로드하나요?",
      category: "usage",
    },
    // ... 더 많은 질문
  ],

  // 표시 설정
  display: {
    showSuggestedQuestions: true,
    maxVisibleQuestions: 6,
    showCategories: false,
  },
};
```

상세한 내용은 [ChatEmptyState 설정 관리](CHAT_EMPTY_STATE_SETTINGS.md)를 참조하세요.

---

## 통합 설정 관리

모든 설정을 하나의 객체로 접근할 수 있습니다.

### APP_CONFIG 사용

```typescript
import { APP_CONFIG } from '../config';

// 브랜드 설정
console.log(APP_CONFIG.brand.appName);

// 색상
const primaryColor = APP_CONFIG.colors.brand.primary.light;

// 레이아웃
const sidebarWidth = APP_CONFIG.layout.sidebar.width;

// 기능 플래그
const isChatbotEnabled = APP_CONFIG.features.modules.chatbot;

// 채팅 설정
const emptyMessage = APP_CONFIG.chatEmptyState.emptyMessage.title;
```

### 개별 설정 import (편의성)

```typescript
import {
  BRAND_CONFIG,
  COLORS,
  LAYOUT_CONFIG,
  FEATURE_FLAGS,
  CHAT_EMPTY_STATE_SETTINGS,
} from '../config';
```

### 헬퍼 함수

```typescript
import {
  getColor,           // 색상 조회
  getSpacing,         // 간격 계산
  isBreakpoint,       // 반응형 확인
  shouldCollapseSidebar, // 사이드바 접힘 확인
  getPageTitle,       // 페이지 제목 생성
} from '../config';
```

---

## 런타임 설정 로드

빌드 후에도 설정을 변경할 수 있습니다.

### 1. 고객사별 JSON 파일 생성

`public/config/customer-a.json`:

```json
{
  "brand": {
    "appName": "Customer A RAG System",
    "logo": {
      "main": "/customer-a-logo.svg",
      "alt": "Customer A Logo"
    }
  },
  "colors": {
    "brand": {
      "primary": {
        "light": "#FF0000",
        "dark": "#FF5555"
      }
    }
  },
  "layout": {
    "sidebar": {
      "width": 280
    }
  },
  "features": {
    "modules": {
      "prompts": false
    }
  }
}
```

### 2. 앱 시작 시 로드

```typescript
import { loadCustomerConfig, mergeConfig, APP_CONFIG } from '../config';

async function initializeApp() {
  // 고객사 설정 로드
  const customerConfig = await loadCustomerConfig('customer-a');

  // 기본 설정과 병합
  const finalConfig = mergeConfig(APP_CONFIG, customerConfig);

  // 설정 검증
  if (validateConfig(finalConfig)) {
    // 앱 시작
  }
}
```

### 3. 장점

- ✅ **빌드 불필요**: JSON 파일만 변경하면 됨
- ✅ **동적 로드**: 고객사 ID로 자동 선택
- ✅ **부분 오버라이드**: 변경할 설정만 포함
- ✅ **검증 기능**: 설정 유효성 자동 확인

---

## 관리자 설정 UI

⭐ **신규 기능**: 코드 수정 없이 GUI로 모든 설정을 변경할 수 있습니다!

### 접속 방법

1. 관리자 대시보드 접속: `/admin`
2. "설정" 탭 클릭

### 제공 기능

#### 1. 색상 프리셋 탭

- 8가지 미리 정의된 테마 중 선택
- 각 프리셋의 색상 미리보기
- 클릭 한 번으로 전체 색상 테마 변경

**작동 방식**:
- 프리셋 카드 클릭
- "저장" 버튼 클릭
- 페이지 새로고침하여 적용 확인

#### 2. 레이아웃 탭

**사이드바 설정**:
- 너비 조절 (200px ~ 320px)
- 슬라이더로 실시간 값 확인

**헤더 설정**:
- 높이 조절 (48px ~ 80px)
- 슬라이더로 실시간 값 확인

**콘텐츠 설정**:
- 패딩 조절 (12px ~ 48px)
- 슬라이더로 실시간 값 확인

#### 3. 기능 플래그 탭

**모듈 on/off**:
- 챗봇 (chatbot)
- 문서 관리 (documentManagement)
- 프롬프트 (prompts)
- 통계 분석 (analysis)
- 관리자 (admin)

**기능 on/off**:
- 다크모드 (darkMode)
- 알림 (notifications)
- 검색 (search)
- 내보내기/가져오기 (export/import)

**UI 설정**:
- 웰컴 메시지 표시
- 서버 상태 표시
- 애니메이션 활성화
- 컴팩트 모드

### 액션 버튼

#### 초기화
- 모든 설정을 기본값으로 복원
- localStorage에서 설정 삭제

#### JSON 내보내기
- 현재 선택한 프리셋을 JSON 파일로 다운로드
- `{preset}-config.json` 형식
- 다른 환경에 배포 가능

#### 저장
- 설정을 localStorage에 저장
- 페이지 새로고침 시 자동 적용

### 사용 예시

#### 시나리오 1: 색상 테마 변경 (1분)

```
1. /admin 접속
2. "설정" 탭 클릭
3. "색상 프리셋" 탭에서 "모던 블루" 선택
4. "저장" 버튼 클릭
5. 페이지 새로고침
→ 완료! 전체 UI가 블루 테마로 변경됨
```

#### 시나리오 2: 레이아웃 조정 (2분)

```
1. /admin 접속
2. "설정" 탭 →"레이아웃" 탭 클릭
3. 사이드바 너비를 280px로 조정
4. 헤더 높이를 72px로 조정
5. "저장" 버튼 클릭
6. 페이지 새로고침
→ 완료! 레이아웃이 변경됨
```

#### 시나리오 3: 기능 비활성화 (1분)

```
1. /admin 접속
2. "설정" 탭 → "기능 플래그" 탭 클릭
3. "prompts" 모듈 토글 off
4. "admin" 모듈 토글 off
5. "저장" 버튼 클릭
6. 페이지 새로고침
→ 완료! 프롬프트와 관리자 메뉴가 숨겨짐
```

#### 시나리오 4: 설정 배포 (3분)

```
1. /admin 접속
2. 원하는 프리셋 선택 및 설정 조정
3. "JSON 내보내기" 버튼 클릭
4. 다운로드된 JSON 파일을 public/config/에 배치
5. 다른 환경에 배포
→ 완료! 동일한 설정이 다른 환경에 적용됨
```

### 주의사항

⚠️ **저장 후 새로고침 필수**: 설정 변경은 페이지 새로고침 후에 적용됩니다.

⚠️ **localStorage 기반**: 브라우저별로 설정이 독립적으로 저장됩니다.

⚠️ **빌드 불필요**: GUI로 변경한 설정은 빌드 없이 즉시 적용됩니다.

---

## 커스터마이징 체크리스트

### 필수 커스터마이징 항목

- [ ] 로고 파일 교체 (`public/logo.svg`)
- [ ] 파비콘 교체 (`public/favicon.ico`)
- [ ] 앱 이름 변경 (`src/config/brand.ts`)
- [ ] 브랜드 색상 변경 (`src/config/colors.ts`)
- [ ] 필요없는 모듈 비활성화 (`src/config/featureFlags.ts`)

### 선택 커스터마이징 항목

- [ ] 레이아웃 조정 (`src/config/layout.ts`)
- [ ] 채팅 Empty State 메시지 변경 (`src/config/chatEmptyStateSettings.ts`)
- [ ] 런타임 설정 시스템 구현 (고객사별 JSON)

### 빌드 및 배포

```bash
# 1. 설정 변경 후 빌드
npm run build

# 2. 빌드 결과 확인
npm run preview

# 3. 배포
# (Railway, Vercel, Netlify 등 플랫폼별 가이드 참조)
```

---

## 문제 해결

### 로고가 표시되지 않음

1. 파일 경로 확인: `public/logo.svg` 위치 확인
2. 파일 형식 확인: SVG, PNG, WebP 지원
3. 브라우저 캐시 삭제 후 재시도
4. `BRAND_CONFIG.logo.main` 경로 확인

### 색상이 적용되지 않음

1. `getColor()` 함수 사용 확인
2. 하드코딩된 색상 제거 (ESLint 오류 확인)
3. Light/Dark 모드 양쪽 색상 정의 확인

### 레이아웃이 깨짐

1. `LAYOUT_CONFIG` 값 확인
2. px 단위 누락 여부 확인 (템플릿 리터럴: `` `${value}px` ``)
3. 브라우저 콘솔에서 오류 확인

### 기능 플래그가 작동하지 않음

1. `useIsModuleEnabled()` 훅 사용 확인
2. 컴포넌트 언마운트/리마운트 필요 (페이지 새로고침)
3. `FEATURE_FLAGS` 오타 확인

---

## 참고 문서

- [색상 관리 시스템 가이드](COLOR_SYSTEM_GUIDE.md) ⭐ 필수
- [기능 플래그 가이드](FEATURE_FLAGS_GUIDE.md)
- [ChatEmptyState 설정 관리](CHAT_EMPTY_STATE_SETTINGS.md)
- [브랜드 설정 가이드](BRAND_CONFIGURATION_GUIDE.md)
- [Railway 배포 가이드](RAILWAY_DEPLOYMENT_GUIDE.md)

---

## 지원

추가 지원이 필요하시면 개발팀에 문의하세요.
