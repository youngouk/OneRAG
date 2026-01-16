# ChatEmptyState 설정 관리 시스템

## 개요

ChatEmptyState 설정 관리 시스템은 챗봇의 Empty State(대화가 없을 때 표시되는 화면)에 표시되는 메시지와 추천 질문을 관리자가 설정할 수 있도록 하는 기능입니다.

## 주요 기능

### 관리 가능한 항목
- **메인 메시지**: 대화 시작 시 표시되는 환영 메시지 (예: "무엇을 도와드릴까요?")
- **보조 메시지**: 시스템 설명 텍스트 (예: "RAG 기반 AI가 문서를 분석하여 정확한 답변을 제공합니다")
- **추천 질문**: 사용자가 클릭할 수 있는 질문 목록 (1~10개)

### 특징
- ✅ **실시간 유효성 검사**: 입력 중 즉시 검증 및 피드백
- ✅ **영구 저장**: localStorage 기반으로 설정 유지
- ✅ **즉시 반영**: 설정 변경 시 ChatEmptyState에 자동 적용
- ✅ **기본값 복원**: 언제든지 기본 설정으로 초기화 가능
- ✅ **타입 안전성**: TypeScript로 완전한 타입 정의

## 아키텍처

### 파일 구조

```
src/
├── types/
│   └── index.ts                          # ChatEmptyStateSettings 타입 정의
├── services/
│   └── chatSettingsService.ts            # 설정 관리 서비스
├── components/
│   ├── ChatEmptyState.tsx                # Empty State 컴포넌트 (설정 연동)
│   └── ChatSettingsManager.tsx           # 설정 관리 UI
└── pages/
    └── UploadPage.tsx                    # 설정 탭 통합
```

### 데이터 흐름

```
┌─────────────────────┐
│  ChatSettingsManager │  ← 관리자가 설정 변경
└──────────┬──────────┘
           │ updateSettings()
           ▼
┌─────────────────────┐
│ chatSettingsService │  ← localStorage에 저장
└──────────┬──────────┘
           │ getSettings()
           ▼
┌─────────────────────┐
│   ChatEmptyState    │  ← 설정값으로 UI 렌더링
└─────────────────────┘
```

## 구현 상세

### 1. 타입 정의 (`src/types/index.ts`)

```typescript
// ChatEmptyState 설정 타입
export interface ChatEmptyStateSettings {
  mainMessage: string;        // 메인 메시지
  subMessage: string;         // 보조 메시지
  suggestions: string[];      // 추천 질문 목록
}

// 설정 업데이트 요청 타입 (부분 업데이트 지원)
export interface ChatEmptyStateSettingsUpdateRequest {
  mainMessage?: string;
  subMessage?: string;
  suggestions?: string[];
}
```

### 2. 설정 서비스 (`src/services/chatSettingsService.ts`)

#### 주요 메서드

- **`getSettings()`**: 현재 설정 가져오기
  - localStorage에서 설정 로드
  - 없으면 기본값 반환
  - 기본값과 병합하여 누락된 필드 방지

- **`updateSettings(updates)`**: 설정 업데이트
  - 부분 업데이트 지원
  - 유효성 검사 후 저장
  - localStorage에 JSON 형태로 저장

- **`resetToDefaults()`**: 기본 설정으로 초기화

- **`validateSettings(settings)`**: 설정 유효성 검사
  - 메인 메시지: 필수, 1~100자
  - 보조 메시지: 필수, 1~200자
  - 추천 질문: 1~10개, 각 1~200자, 중복 불가

- **`getDefaultSettings()`**: 기본 설정값 반환

#### 기본 설정값

```typescript
const DEFAULT_SETTINGS = {
  mainMessage: '무엇을 도와드릴까요?',
  subMessage: 'RAG 기반 AI가 문서를 분석하여 정확한 답변을 제공합니다',
  suggestions: [
    '이 문서에서 핵심 내용을 요약해주세요',
    '특정 주제에 대한 법령 조항을 찾아주세요',
    '관련된 규정과 시행령을 비교 분석해주세요',
  ],
};
```

#### localStorage 저장 구조

```json
{
  "mainMessage": "무엇을 도와드릴까요?",
  "subMessage": "RAG 기반 AI가 문서를 분석하여 정확한 답변을 제공합니다",
  "suggestions": [
    "이 문서에서 핵심 내용을 요약해주세요",
    "특정 주제에 대한 법령 조항을 찾아주세요",
    "관련된 규정과 시행령을 비교 분석해주세요"
  ]
}
```

저장 키: `chatEmptyStateSettings`

### 3. 설정 관리 UI (`src/components/ChatSettingsManager.tsx`)

#### 컴포넌트 구조

```typescript
interface ChatSettingsManagerProps {
  onSave?: (settings: ChatEmptyStateSettings) => void;
}
```

#### UI 구성 요소

1. **메인 메시지 입력**
   - TextField 컴포넌트
   - 최대 100자 제한
   - 실시간 글자 수 표시

2. **보조 메시지 입력**
   - 멀티라인 TextField
   - 최대 200자 제한
   - 2줄 높이

3. **추천 질문 관리**
   - 동적 목록 (추가/삭제)
   - 각 질문 최대 200자
   - 최소 1개, 최대 10개

4. **액션 버튼**
   - 저장: 변경사항이 있을 때만 활성화
   - 기본값으로 초기화: 확인 다이얼로그 표시

#### 유효성 검사 피드백

- **실시간 검증**: 입력 시 즉시 에러 표시
- **에러 메시지**: Alert 컴포넌트로 명확한 피드백
- **성공 메시지**: 저장 성공 시 Alert 표시

### 4. ChatEmptyState 통합 (`src/components/ChatEmptyState.tsx`)

#### 설정 연동 구현

```typescript
export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({ onSuggestionClick }) => {
  const theme = useTheme();

  // 설정 상태 관리
  const [settings, setSettings] = useState<ChatEmptyStateSettings>(
    chatSettingsService.getSettings()
  );

  // localStorage 변경 감지
  useEffect(() => {
    const handleStorageChange = () => {
      setSettings(chatSettingsService.getSettings());
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 설정값으로 UI 렌더링
  return (
    <Box>
      <Typography>{settings.mainMessage}</Typography>
      <Typography>{settings.subMessage}</Typography>
      {settings.suggestions.map((suggestion, index) => (
        <SuggestionCard key={index} text={suggestion} onClick={onSuggestionClick} />
      ))}
    </Box>
  );
};
```

#### 자동 반영 메커니즘

- **localStorage 이벤트**: storage 이벤트 리스너로 변경 감지
- **즉시 업데이트**: 설정 변경 시 컴포넌트 자동 리렌더링
- **다른 탭 동기화**: 여러 탭에서 동일한 설정 공유

### 5. 관리자 페이지 통합 (`src/pages/UploadPage.tsx`)

#### 설정 탭 추가

```typescript
<Tabs value={activeTab} onChange={handleTabChange}>
  <Tab icon={<CloudUpload />} label="문서 업로드" />
  <Tab icon={<Description />} label="문서 관리" />
  <Tab icon={<Settings />} label="챗봇 설정" />  {/* 새로 추가 */}
</Tabs>

<TabPanel value={activeTab} index={2}>
  <ErrorBoundary>
    <ChatSettingsManager
      onSave={() => {
        showToast({
          type: 'success',
          message: '챗봇 설정이 저장되었습니다',
        });
      }}
    />
  </ErrorBoundary>
</TabPanel>
```

## 사용 방법

### 관리자 설정 변경

1. **설정 페이지 접근**
   ```
   브라우저에서 /upload 페이지 접속
   → "챗봇 설정" 탭 클릭
   ```

2. **설정 변경**
   - 메인 메시지 입력 필드에 새 메시지 입력
   - 보조 메시지 입력 필드에 새 설명 입력
   - 추천 질문 추가/삭제/수정

3. **저장**
   - "저장" 버튼 클릭
   - 성공 메시지 확인

4. **확인**
   - `/bot` 페이지로 이동
   - 변경된 내용 즉시 반영 확인

### 기본값 복원

```
챗봇 설정 페이지 → "기본값으로 초기화" 버튼 클릭 → 확인
```

### 프로그래밍 방식 사용

```typescript
import { chatSettingsService } from '@/services/chatSettingsService';

// 현재 설정 가져오기
const settings = chatSettingsService.getSettings();

// 설정 업데이트
chatSettingsService.updateSettings({
  mainMessage: '새로운 환영 메시지',
  suggestions: ['질문 1', '질문 2', '질문 3'],
});

// 기본값으로 초기화
chatSettingsService.resetToDefaults();

// 유효성 검사
const errors = chatSettingsService.validateSettings({
  mainMessage: '테스트',
  subMessage: '설명',
  suggestions: ['질문'],
});
if (errors.length > 0) {
  console.error('검증 실패:', errors);
}
```

## 유효성 검사 규칙

### 메인 메시지
- ✅ 필수 입력
- ✅ 빈 문자열 불가
- ✅ 최대 100자

### 보조 메시지
- ✅ 필수 입력
- ✅ 빈 문자열 불가
- ✅ 최대 200자

### 추천 질문
- ✅ 최소 1개 필수
- ✅ 최대 10개 제한
- ✅ 각 질문 최대 200자
- ✅ 빈 문자열 불가
- ✅ 중복 질문 불가

## 에러 처리

### 서비스 레벨

```typescript
try {
  const settings = chatSettingsService.updateSettings(newSettings);
  // 성공
} catch (error) {
  // 유효성 검사 실패 또는 저장 오류
  console.error('설정 업데이트 실패:', error.message);
}
```

### UI 레벨

- **유효성 검사 실패**: Alert 컴포넌트로 에러 메시지 표시
- **저장 실패**: 에러 Alert와 함께 원인 표시
- **localStorage 오류**: 콘솔 에러 로깅 후 기본값 사용

## 확장 가능성

### 백엔드 통합

현재는 localStorage 기반이지만, 향후 백엔드 API 연동 가능:

```typescript
// chatSettingsService.ts에 API 호출 추가
async updateSettings(updates: ChatEmptyStateSettingsUpdateRequest): Promise<ChatEmptyStateSettings> {
  try {
    // 유효성 검사
    const validated = this.validateSettings(updates);

    // 백엔드 API 호출
    const response = await api.post('/api/settings/chat-empty-state', validated);

    // localStorage에도 캐싱
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response.data));

    return response.data;
  } catch (error) {
    // 에러 처리
  }
}
```

### 다국어 지원

설정에 언어별 메시지 추가:

```typescript
interface ChatEmptyStateSettings {
  messages: {
    ko: { main: string; sub: string; suggestions: string[] };
    en: { main: string; sub: string; suggestions: string[] };
  };
}
```

### 테마별 설정

라이트/다크 모드별 다른 메시지:

```typescript
interface ChatEmptyStateSettings {
  light: { mainMessage: string; ... };
  dark: { mainMessage: string; ... };
}
```

## 테스트

### 단위 테스트

```typescript
describe('chatSettingsService', () => {
  test('기본 설정 반환', () => {
    const settings = chatSettingsService.getDefaultSettings();
    expect(settings.mainMessage).toBe('무엇을 도와드릴까요?');
  });

  test('유효성 검사 - 메인 메시지 길이 초과', () => {
    const errors = chatSettingsService.validateSettings({
      mainMessage: 'a'.repeat(101),
      subMessage: '설명',
      suggestions: ['질문'],
    });
    expect(errors).toContain('메인 메시지는 100자를 초과할 수 없습니다');
  });

  test('설정 저장 및 로드', () => {
    const newSettings = {
      mainMessage: '테스트 메시지',
      subMessage: '테스트 설명',
      suggestions: ['질문1', '질문2'],
    };
    chatSettingsService.updateSettings(newSettings);
    const loaded = chatSettingsService.getSettings();
    expect(loaded.mainMessage).toBe('테스트 메시지');
  });
});
```

### E2E 테스트

```typescript
describe('ChatEmptyState 설정 관리', () => {
  test('설정 변경 및 반영', async () => {
    // 1. 업로드 페이지 접속
    await page.goto('/upload');

    // 2. 챗봇 설정 탭 클릭
    await page.click('text=챗봇 설정');

    // 3. 메인 메시지 변경
    await page.fill('input[name="mainMessage"]', '새로운 메시지');

    // 4. 저장
    await page.click('button:has-text("저장")');

    // 5. 챗봇 페이지 이동
    await page.goto('/bot');

    // 6. 변경된 메시지 확인
    await expect(page.locator('text=새로운 메시지')).toBeVisible();
  });
});
```

## 트러블슈팅

### 설정이 저장되지 않음

**원인**: localStorage가 비활성화되어 있거나 용량 제한 초과

**해결**:
```javascript
// localStorage 사용 가능 여부 확인
if (typeof Storage !== 'undefined') {
  // localStorage 사용 가능
} else {
  // 대체 저장소 사용 (쿠키, IndexedDB 등)
}
```

### 설정이 반영되지 않음

**원인**: storage 이벤트가 같은 탭에서는 발생하지 않음

**해결**: 설정 변경 시 직접 상태 업데이트
```typescript
// ChatEmptyState.tsx에서
window.dispatchEvent(new Event('storage')); // 강제로 이벤트 발생
```

### 유효성 검사 에러

**원인**: 입력값이 검증 규칙을 위반

**해결**: 에러 메시지 확인 후 규칙에 맞게 수정

## 보안 고려사항

### XSS 방지

- ✅ React의 자동 이스케이핑 활용
- ✅ dangerouslySetInnerHTML 사용 금지
- ✅ 사용자 입력 직접 렌더링 금지

### 입력 검증

- ✅ 클라이언트 검증 (즉시 피드백)
- ✅ 서버 검증 (보안 강화) - 백엔드 통합 시

### 저장 크기 제한

- ✅ localStorage 5MB 제한 고려
- ✅ 각 필드별 최대 길이 제한

## 성능 최적화

### localStorage 최적화

```typescript
// debounce로 저장 횟수 줄이기
const debouncedSave = debounce((settings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}, 500);
```

### 메모이제이션

```typescript
// ChatEmptyState.tsx에서
const memoizedSuggestions = useMemo(
  () => settings.suggestions,
  [settings.suggestions]
);
```

## 참고 자료

- [React State Management](https://react.dev/learn/managing-state)
- [localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [Material-UI Forms](https://mui.com/material-ui/react-text-field/)
- [TypeScript Type Definitions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)

## 변경 이력

### v1.0.0 (2025-11-13)
- ✅ 초기 구현
- ✅ localStorage 기반 설정 관리
- ✅ 실시간 유효성 검사
- ✅ 관리자 UI 구현
- ✅ ChatEmptyState 통합
