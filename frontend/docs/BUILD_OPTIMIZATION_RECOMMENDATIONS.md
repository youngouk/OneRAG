# 빌드 최적화 권장사항

이 문서는 프로젝트의 프로덕션 빌드 최적화를 위한 권장사항을 정리합니다.

## 📊 현재 빌드 상태 (2025-11-19)

### 빌드 통계
- **총 모듈 수**: 12,566개
- **총 빌드 크기**: 1.3MB
- **빌드 시간**: ~10-14초
- **생성된 파일**: 25개 (PWA 포함)

### 주요 번들 크기

| 파일명 | 원본 크기 | Gzip 압축 크기 | 상태 |
|--------|----------|---------------|------|
| `index-*.js` | 524.72 KB | 169.29 KB | ⚠️ 500KB 초과 |
| `AdminDashboard-*.js` | 431.78 KB | 115.00 KB | ⚠️ 500KB 초과 |
| `TextField-*.js` | 70.04 KB | 19.82 KB | ✅ 정상 |
| `ChatPage-*.js` | 49.57 KB | 14.34 KB | ✅ 정상 |
| `UploadPage-*.js` | 43.94 KB | 13.94 KB | ✅ 정상 |

## ⚠️ 경고 사항

Vite 빌드 시 다음 경고가 발생합니다:

```
(!) Some chunks are larger than 500 kBs after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit
```

**영향도**: 중간
- 실제 네트워크 전송 크기는 Gzip 압축으로 169KB, 115KB로 감소
- 사용자 경험에는 큰 영향 없음 (특히 캐싱된 경우)
- 하지만 초기 로딩 시간 개선 여지 있음

## 🎯 최적화 권장사항

### 1. 코드 스플리팅 개선 (우선순위: 높음)

#### 1-1. AdminDashboard 동적 임포트

**현재 상황**: AdminDashboard가 431.78 KB로 큰 번들 크기를 차지

**해결 방법**: Lazy Loading 적용

```typescript
// src/App.tsx
import { lazy, Suspense } from 'react';
import { CircularProgress, Box } from '@mui/material';

// 기존
// import AdminDashboard from './pages/Admin/AdminDashboard';

// 개선
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));

// 라우트 설정 시
<Route
  path="/admin/*"
  element={
    <Suspense fallback={
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    }>
      <AdminDashboard />
    </Suspense>
  }
/>
```

**예상 효과**:
- 초기 번들 크기 431KB 감소
- 관리자 페이지 접근 시에만 로딩
- 일반 사용자(챗봇만 사용)의 로딩 속도 대폭 개선

#### 1-2. 페이지별 Lazy Loading

**추가 적용 가능한 페이지**:

```typescript
// src/App.tsx
const ChatPage = lazy(() => import('./pages/ChatPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const PromptsPage = lazy(() => import('./pages/PromptsPage'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));

// 공통 로딩 컴포넌트
const PageLoader = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
    <CircularProgress />
  </Box>
);

// 라우트 설정
<Route
  path="/bot"
  element={
    <Suspense fallback={<PageLoader />}>
      <ChatPage />
    </Suspense>
  }
/>
```

**예상 효과**:
- 초기 로딩 시 필요한 페이지만 로드
- 각 페이지 전환 시 필요한 코드만 추가 로드
- 초기 번들 크기 대폭 감소 (예상: 200-300KB 감소)

### 2. Material-UI 최적화 (우선순위: 중간)

#### 2-1. Tree Shaking 확인

**현재 상황**: TextField 컴포넌트가 70KB로 다소 큼

**확인 사항**:
```typescript
// 올바른 임포트 (Tree Shaking 가능)
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

// 피해야 할 임포트 (전체 번들 포함)
import { TextField, Button } from '@mui/material';
```

**조치 사항**:
1. 프로젝트 전체에서 MUI 임포트 패턴 검토
2. 필요시 ESLint 규칙 추가로 잘못된 임포트 방지

```javascript
// .eslintrc.js
rules: {
  'no-restricted-imports': [
    'error',
    {
      patterns: ['@mui/material', '@mui/icons-material'],
    },
  ],
}
```

### 3. Manual Chunks 설정 (우선순위: 중간)

#### 3-1. Vite 설정 개선

**파일**: `vite.config.ts`

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 관련 라이브러리
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // Material-UI 라이브러리
          'mui-core': ['@mui/material', '@mui/icons-material'],

          // 차트 라이브러리 (분석 페이지에서 사용)
          'chart-vendor': ['recharts'],

          // Markdown 관련 (챗봇에서 사용)
          'markdown-vendor': ['react-markdown', 'remark-gfm'],
        },
      },
    },
    chunkSizeWarningLimit: 600, // 경고 임계값 조정 (선택사항)
  },
});
```

**예상 효과**:
- 공통 라이브러리를 별도 청크로 분리
- 브라우저 캐싱 효율 증가
- 코드 변경 시 변경된 청크만 다시 다운로드

### 4. 번들 분석 도구 사용 (우선순위: 낮음)

#### 4-1. Rollup Visualizer 설치

**설치**:
```bash
npm install --save-dev rollup-plugin-visualizer
```

**설정**:
```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});
```

**사용 방법**:
```bash
npm run build
# 빌드 후 dist/stats.html이 자동으로 열림
```

**활용**:
- 번들 크기 시각화
- 어떤 라이브러리가 큰 공간을 차지하는지 파악
- 최적화 우선순위 결정

## 📋 구현 우선순위

### Phase 1: 즉시 적용 가능 (난이도: 낮음)
1. ✅ AdminDashboard Lazy Loading 적용
2. ✅ 다른 페이지들도 Lazy Loading 적용
3. ✅ 공통 로딩 컴포넌트 생성

**예상 소요 시간**: 30분
**예상 효과**: 초기 번들 크기 40-50% 감소

### Phase 2: 중기 개선 (난이도: 중간)
1. Material-UI 임포트 패턴 검토 및 수정
2. Manual Chunks 설정 추가
3. ESLint 규칙 추가

**예상 소요 시간**: 1-2시간
**예상 효과**: 캐싱 효율 20-30% 개선

### Phase 3: 장기 최적화 (난이도: 높음)
1. Rollup Visualizer로 번들 분석
2. 불필요한 의존성 제거
3. 성능 모니터링 도구 추가 (예: Lighthouse CI)

**예상 소요 시간**: 반나절
**예상 효과**: 지속적인 성능 개선 기반 마련

## 🎯 목표 번들 크기

### 현재 상태
- 초기 로드: ~525 KB (gzip: ~170 KB)
- 전체 앱: ~1.3 MB

### 최적화 후 목표
- 초기 로드: ~250 KB (gzip: ~80 KB) - **50% 감소**
- 각 페이지 청크: ~50 KB (gzip: ~15 KB)
- 공통 vendor 청크: ~150 KB (gzip: ~50 KB)

## 📝 체크리스트

구현 시 다음 항목을 확인하세요:

- [ ] AdminDashboard Lazy Loading 적용
- [ ] 모든 주요 페이지 Lazy Loading 적용
- [ ] Suspense fallback UI 구현
- [ ] Material-UI 임포트 패턴 검토
- [ ] Manual Chunks 설정 추가
- [ ] 빌드 후 번들 크기 확인
- [ ] Lighthouse 성능 점수 측정
- [ ] 실제 네트워크 환경에서 로딩 시간 테스트

## 🔗 참고 자료

- [Vite 코드 스플리팅 가이드](https://vitejs.dev/guide/build.html#chunking-strategy)
- [React Lazy Loading 공식 문서](https://react.dev/reference/react/lazy)
- [Material-UI Tree Shaking](https://mui.com/material-ui/guides/minimizing-bundle-size/)
- [Rollup Manual Chunks](https://rollupjs.org/configuration-options/#output-manualchunks)

## 📅 업데이트 히스토리

- **2025-11-19**: 초기 문서 작성
  - Privacy 기능 구현 후 빌드 검증 결과 기반으로 작성
  - 현재 번들 크기: index 524KB, AdminDashboard 431KB

---

**작성자**: Claude Code
**최종 수정일**: 2025-11-19
