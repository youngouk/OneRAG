# TXT 파일 노출 제어 기능 구현 계획서

## 📋 문서 정보
- **작성일**: 2025-11-19
- **버전**: 1.0
- **목적**: TXT 파일(카카오톡 대화 내용) 노출 여부를 관리 페이지에서 동적으로 제어할 수 있는 시스템 구축

---

## 1. 개요 및 배경

### 1.1 현재 상황
커밋 `135db6f`에서 TXT 파일 타입의 문서명과 내용을 하드코딩된 값으로 대체하는 기능이 구현되었습니다.

**현재 구현 방식** (ChatTab.tsx):
```typescript
// 문서명 대체
source.file_type === 'TXT' ? '카카오톡 대화 : *** 신부님' : source.document

// 내용 대체
source.file_type === 'TXT' ? '대화내용은 제공되지 않습니다.' : formatSourcePreview(source.content_preview)
```

**문제점**:
- ✗ 하드코딩된 조건식으로 유연성 부족
- ✗ 기능 on/off를 위해 코드 수정 및 재배포 필요
- ✗ 환경별로 다른 설정을 적용하기 어려움
- ✗ 관리자가 실시간으로 제어할 수 없음

### 1.2 목표
관리 페이지(Admin Dashboard)에서 TXT 파일 노출 여부를 **GUI 스위치로 제어**할 수 있도록 개선

**요구사항**:
- ✓ 관리자가 설정 페이지에서 즉시 on/off 가능
- ✓ 환경변수를 통한 기본값 설정 지원
- ✓ 브라우저 새로고침 후에도 설정 유지
- ✓ 타입 안전성 보장 (TypeScript)
- ✓ 확장 가능한 구조 (다른 프라이버시 설정 추가 용이)

---

## 2. 설계 방안

### 2.1 시스템 아키텍처

**기존 기능 플래그 시스템 확장 활용**

프로젝트에는 이미 검증된 기능 플래그 시스템이 존재합니다 (`src/config/features.ts`):
- ✓ 환경변수 기반 설정 로드
- ✓ 런타임 구성 지원 (window.RUNTIME_CONFIG)
- ✓ LocalStorage 영속성 (ConfigProvider)
- ✓ React Context를 통한 전역 상태 관리
- ✓ 타입 안전성 (TypeScript 인터페이스)

**새로운 Privacy 모듈 추가**

```
FeatureConfig
├── chatbot
├── documentManagement
├── admin
├── prompts
├── analysis
└── privacy ← 신규 추가
    ├── enabled: boolean
    ├── hideTxtContent: boolean
    └── maskPhoneNumbers: boolean (확장)
```

### 2.2 데이터 흐름

```
1. 초기 로드
   환경변수 (.env) → features.ts → FeatureProvider → ChatTab.tsx

2. 관리자 설정 변경
   SettingsPage (UI) → updateConfig → ConfigProvider → localStorage
                                                      → FeatureProvider
                                                      → ChatTab.tsx (리렌더링)

3. 설정 우선순위
   런타임 구성 > 환경변수 > 기본값
```

### 2.3 주요 컴포넌트 역할

| 컴포넌트 | 역할 |
|---------|------|
| `features.ts` | Privacy 인터페이스 정의, 기본값 설정 |
| `FeatureProvider.tsx` | Feature 전역 상태 관리 (기존) |
| `ConfigProvider.tsx` | 설정 영속성 관리 (localStorage) |
| `SettingsPage.tsx` | 관리자 설정 UI |
| `ChatTab.tsx` | Privacy 설정에 따른 조건부 렌더링 |

---

## 3. 구현 단계별 가이드

### 3.1 Phase 1: features.ts 수정

**파일**: `src/config/features.ts`

#### 3.1.1 Privacy 인터페이스 추가

```typescript
/**
 * 프라이버시 기능 설정
 */
export interface PrivacyFeatures {
  enabled: boolean;          // Privacy 모듈 전체 활성화 여부
  hideTxtContent: boolean;   // TXT 파일 내용 숨김 기능
  maskPhoneNumbers: boolean; // 전화번호 자동 마스킹 (확장)
}
```

#### 3.1.2 FeatureConfig에 privacy 추가

```typescript
export interface FeatureConfig {
  chatbot: ChatbotFeatures;
  documentManagement: DocumentManagementFeatures;
  admin: AdminFeatures;
  prompts: PromptsFeatures;
  analysis: AnalysisFeatures;
  privacy: PrivacyFeatures; // ← 추가
}
```

#### 3.1.3 기본값 설정

```typescript
export const DEFAULT_FEATURES: FeatureConfig = {
  // ... 기존 설정
  privacy: {
    enabled: true,
    hideTxtContent: true,    // 기본값: TXT 파일 숨김
    maskPhoneNumbers: true,  // 전화번호 마스킹 활성화
  },
};
```

#### 3.1.4 환경변수 로드 함수 수정

```typescript
function loadFeaturesFromEnv(): Partial<FeatureConfig> {
  const env = import.meta.env;

  return {
    // ... 기존 설정
    privacy: {
      enabled: parseBooleanEnv(env.VITE_FEATURE_PRIVACY, true),
      hideTxtContent: parseBooleanEnv(env.VITE_FEATURE_PRIVACY_HIDE_TXT, true),
      maskPhoneNumbers: parseBooleanEnv(env.VITE_FEATURE_PRIVACY_MASK_PHONE, true),
    },
  };
}
```

**예상 추가 코드 라인**: 약 30줄

---

### 3.2 Phase 2: SettingsPage.tsx 수정

**파일**: `src/pages/Admin/SettingsPage.tsx`

#### 3.2.1 features 상태에 privacy 추가

```typescript
const [features, setFeatures] = useState(() => {
  const cfg = config.features || FEATURE_FLAGS;
  return {
    modules: {
      chatbot: cfg.chatbot?.enabled ?? true,
      documentManagement: cfg.documentManagement?.enabled ?? true,
      admin: cfg.admin?.enabled ?? true,
      prompts: cfg.prompts?.enabled ?? true,
      analysis: cfg.analysis?.enabled ?? true,
      privacy: cfg.privacy?.enabled ?? true, // ← 추가
    },
    features: {
      streaming: cfg.chatbot?.streaming ?? true,
      history: cfg.chatbot?.history ?? true,
      upload: cfg.documentManagement?.upload ?? true,
      search: cfg.documentManagement?.search ?? true,
      hideTxtContent: cfg.privacy?.hideTxtContent ?? true, // ← 추가
    },
    ui: {
      darkMode: true,
      sidebar: true,
      header: true,
    },
  };
});
```

#### 3.2.2 Privacy 설정 UI 추가 (기능 플래그 탭)

```typescript
{/* Privacy 섹션 */}
<Box>
  <Typography variant="subtitle1" gutterBottom fontWeight={600}>
    프라이버시 설정
  </Typography>
  <FormGroup>
    <FormControlLabel
      control={
        <Switch
          checked={features.modules.privacy}
          onChange={(e) =>
            setFeatures({
              ...features,
              modules: { ...features.modules, privacy: e.target.checked },
            })
          }
        />
      }
      label="프라이버시 기능 활성화"
    />
    <FormControlLabel
      control={
        <Switch
          checked={features.features.hideTxtContent}
          disabled={!features.modules.privacy}
          onChange={(e) =>
            setFeatures({
              ...features,
              features: { ...features.features, hideTxtContent: e.target.checked },
            })
          }
        />
      }
      label="TXT 파일 내용 숨김 (카카오톡 대화)"
    />
  </FormGroup>
</Box>
```

#### 3.2.3 handleSaveSettings 수정

```typescript
const handleSaveSettings = () => {
  const newConfig = {
    preset: selectedPreset,
    layout: { /* ... */ },
    features: {
      chatbot: { /* ... */ },
      documentManagement: { /* ... */ },
      admin: { /* ... */ },
      prompts: { /* ... */ },
      analysis: { /* ... */ },
      privacy: {
        enabled: features.modules.privacy,
        hideTxtContent: features.features.hideTxtContent,
        maskPhoneNumbers: true, // 기본값 유지
      }, // ← 추가
    },
  };

  updateConfig(newConfig);
  showSnackbar('설정이 저장되었습니다.');
};
```

**예상 추가 코드 라인**: 약 50줄

---

### 3.3 Phase 3: ChatTab.tsx 수정

**파일**: `src/components/ChatTab.tsx`

#### 3.3.1 useFeature 훅 추가

```typescript
import { useFeature } from '../core/FeatureProvider';

export const ChatTab: React.FC<ChatTabProps> = ({ showToast }) => {
  // 기존 상태 선언들...

  // Privacy 기능 플래그 가져오기
  const privacyFeatures = useFeature('privacy');
  const shouldHideTxtContent = privacyFeatures.hideTxtContent;

  // ...
};
```

#### 3.3.2 조건부 렌더링 수정

**변경 전** (하드코딩):
```typescript
source.file_type === 'TXT' ? '카카오톡 대화 : *** 신부님' : source.document
```

**변경 후** (동적 제어):
```typescript
(source.file_type === 'TXT' && shouldHideTxtContent)
  ? '카카오톡 대화 : *** 신부님'
  : source.document
```

#### 3.3.3 전체 수정 대상 (5개 위치)

1. **Line 367**: 모달 상세 정보의 문서 파일명
```typescript
{
  label: '문서 파일명',
  value: (selectedChunk.file_type === 'TXT' && shouldHideTxtContent)
    ? '카카오톡 대화 : *** 신부님'
    : formatPrimitive(selectedChunk.document)
}
```

2. **Line 1663**: Tooltip & Typography (참고자료 목록 문서명)
```typescript
<Tooltip
  title={(source.file_type === 'TXT' && shouldHideTxtContent)
    ? '카카오톡 대화 : *** 신부님'
    : (source.document || '문서명 없음')}
  placement="top-start"
>
  <Typography variant="subtitle2" fontWeight={600}>
    {(source.file_type === 'TXT' && shouldHideTxtContent)
      ? '카카오톡 대화 : *** 신부님'
      : (source.document || '알 수 없는 문서')}
  </Typography>
</Tooltip>
```

3. **Line 1694**: 참고자료 목록 미리보기
```typescript
<Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
  "{(source.file_type === 'TXT' && shouldHideTxtContent)
    ? '대화내용은 제공되지 않습니다.'
    : formatSourcePreview(source.content_preview)}"
</Typography>
```

4. **Line 2056**: 모달 전체 내용 (Box 안)
```typescript
<Typography variant="body2" color="text.primary" sx={{ fontSize: '0.9rem' }}>
  {(selectedChunk.file_type === 'TXT' && shouldHideTxtContent)
    ? '대화내용은 제공되지 않습니다.'
    : formatFullContent(selectedChunk.content_preview)}
</Typography>
```

5. **Line 2069**: 모달 전체 내용 (일반)
```typescript
<Typography variant="body2" color="text.primary" sx={{ fontSize: '0.95rem' }}>
  {(selectedChunk.file_type === 'TXT' && shouldHideTxtContent)
    ? '대화내용은 제공되지 않습니다.'
    : formatFullContent(selectedChunk.content_preview)}
</Typography>
```

**예상 수정 코드 라인**: 약 10줄 (5개 위치 수정)

---

### 3.4 Phase 4: 환경변수 설정 (선택사항)

**파일**: `.env`

```env
# Privacy 기능 플래그
VITE_FEATURE_PRIVACY=true
VITE_FEATURE_PRIVACY_HIDE_TXT=true
VITE_FEATURE_PRIVACY_MASK_PHONE=true
```

**Railway/Vercel 배포 시** 환경변수 설정:
```bash
VITE_FEATURE_PRIVACY=true
VITE_FEATURE_PRIVACY_HIDE_TXT=false  # TXT 파일 노출
```

---

## 4. 코드 예시

### 4.1 완성된 features.ts (Privacy 부분)

```typescript
/**
 * 프라이버시 기능 설정
 */
export interface PrivacyFeatures {
  enabled: boolean;          // Privacy 모듈 전체 활성화 여부
  hideTxtContent: boolean;   // TXT 파일 내용 숨김 기능
  maskPhoneNumbers: boolean; // 전화번호 자동 마스킹
}

export interface FeatureConfig {
  chatbot: ChatbotFeatures;
  documentManagement: DocumentManagementFeatures;
  admin: AdminFeatures;
  prompts: PromptsFeatures;
  analysis: AnalysisFeatures;
  privacy: PrivacyFeatures;
}

export const DEFAULT_FEATURES: FeatureConfig = {
  chatbot: { /* ... */ },
  documentManagement: { /* ... */ },
  admin: { /* ... */ },
  prompts: { /* ... */ },
  analysis: { /* ... */ },
  privacy: {
    enabled: true,
    hideTxtContent: true,
    maskPhoneNumbers: true,
  },
};

function loadFeaturesFromEnv(): Partial<FeatureConfig> {
  const env = import.meta.env;

  return {
    chatbot: { /* ... */ },
    documentManagement: { /* ... */ },
    admin: { /* ... */ },
    prompts: { /* ... */ },
    analysis: { /* ... */ },
    privacy: {
      enabled: parseBooleanEnv(env.VITE_FEATURE_PRIVACY, true),
      hideTxtContent: parseBooleanEnv(env.VITE_FEATURE_PRIVACY_HIDE_TXT, true),
      maskPhoneNumbers: parseBooleanEnv(env.VITE_FEATURE_PRIVACY_MASK_PHONE, true),
    },
  };
}
```

### 4.2 ChatTab.tsx 사용 예시

```typescript
import { useFeature } from '../core/FeatureProvider';

export const ChatTab: React.FC<ChatTabProps> = ({ showToast }) => {
  // Privacy 기능 플래그
  const privacyFeatures = useFeature('privacy');
  const shouldHideTxtContent = privacyFeatures.hideTxtContent;

  // 헬퍼 함수
  const getDocumentName = (source: SourceChunk): string => {
    if (source.file_type === 'TXT' && shouldHideTxtContent) {
      return '카카오톡 대화 : *** 신부님';
    }
    return source.document || '알 수 없는 문서';
  };

  const getContentPreview = (source: SourceChunk): string => {
    if (source.file_type === 'TXT' && shouldHideTxtContent) {
      return '대화내용은 제공되지 않습니다.';
    }
    return formatSourcePreview(source.content_preview);
  };

  // 렌더링에서 사용
  return (
    <Typography variant="subtitle2" fontWeight={600}>
      {getDocumentName(source)}
    </Typography>
  );
};
```

---

## 5. 테스트 시나리오

### 5.1 기본 동작 테스트

| 시나리오 | 설정 | 기대 결과 |
|---------|------|----------|
| 1. 기본 상태 | `hideTxtContent: true` | TXT 파일 문서명 및 내용 숨김 |
| 2. OFF 설정 | `hideTxtContent: false` | TXT 파일 원본 문서명 및 내용 노출 |
| 3. Privacy 비활성화 | `privacy.enabled: false` | Privacy 기능 전체 비활성화 |
| 4. PDF 파일 | 모든 설정 | PDF는 항상 정상 표시 (영향 없음) |

### 5.2 설정 영속성 테스트

| 동작 | 기대 결과 |
|------|----------|
| 1. 설정 변경 후 새로고침 (F5) | 설정 유지 (localStorage) |
| 2. 브라우저 종료 후 재접속 | 설정 유지 |
| 3. 다른 브라우저에서 접속 | 기본값 또는 환경변수 값 |
| 4. 시크릿 모드 | 환경변수 기본값 |

### 5.3 UI 테스트

| 위치 | 확인 사항 |
|------|----------|
| 채팅 참고자료 목록 | 문서명 및 미리보기 표시 |
| 참고자료 상세 모달 | 문서 파일명, 전체 내용 표시 |
| Tooltip | 문서명 호버 정보 표시 |
| 설정 페이지 | 스위치 on/off 정상 작동 |

### 5.4 환경변수 테스트

**.env 설정**:
```env
VITE_FEATURE_PRIVACY_HIDE_TXT=false
```

**기대 결과**:
- 초기 로드 시 TXT 파일 내용 노출
- 설정 페이지에서 스위치 OFF 상태로 표시
- 관리자가 ON으로 변경 가능

---

## 6. 예상 효과 및 확장 가능성

### 6.1 즉각적인 효과

✓ **운영 유연성**
- 코드 수정 없이 관리 페이지에서 즉시 설정 변경
- 긴급 상황 시 빠른 대응 가능

✓ **환경별 제어**
- 개발 환경: TXT 내용 노출 (테스트 용이)
- 스테이징: 선택적 노출
- 프로덕션: 숨김 (프라이버시 보호)

✓ **사용자 경험 개선**
- 설정 변경 시 즉시 반영 (재배포 불필요)
- 일관된 UI/UX 유지

### 6.2 확장 가능성

**1. 추가 프라이버시 기능**
```typescript
export interface PrivacyFeatures {
  enabled: boolean;
  hideTxtContent: boolean;        // 기존
  maskPhoneNumbers: boolean;      // 기존
  hideEmailAddresses: boolean;    // 신규
  hideUserNames: boolean;         // 신규
  redactSensitiveData: boolean;   // 신규
}
```

**2. 세분화된 제어**
```typescript
export interface PrivacyFeatures {
  enabled: boolean;
  txtFiles: {
    hideDocumentName: boolean;
    hideContentPreview: boolean;
    hideFullContent: boolean;
  };
  phoneNumbers: {
    maskFormat: 'full' | 'partial' | 'none';
  };
}
```

**3. 사용자별 설정**
- 백엔드 API 연동 시 사용자별 프라이버시 설정 지원 가능
- 역할 기반 접근 제어 (RBAC) 적용 가능

**4. 감사 로그**
- Privacy 설정 변경 이력 기록
- 민감 정보 접근 로그 관리

---

## 7. FAQ 및 주의사항

### 7.1 자주 묻는 질문

**Q1. 설정을 변경했는데 반영이 안 돼요**

**A**: 다음을 확인하세요:
1. 설정 페이지에서 "저장" 버튼을 눌렀는지 확인
2. 브라우저 하드 리프레시 (Ctrl+Shift+R / Cmd+Shift+R)
3. 브라우저 콘솔에서 확인: `console.log(window.RUNTIME_CONFIG.FEATURES.privacy)`

---

**Q2. 환경변수 설정이 우선인가요, 아니면 관리 페이지 설정이 우선인가요?**

**A**: 우선순위는 다음과 같습니다:
1. **최우선**: 런타임 구성 (관리 페이지에서 저장된 설정)
2. **중간**: 환경변수 (.env, Railway 설정)
3. **기본값**: DEFAULT_FEATURES

즉, 관리 페이지에서 설정한 값이 환경변수보다 우선합니다.

---

**Q3. 설정을 다시 기본값으로 되돌리고 싶어요**

**A**: 설정 페이지에서 "초기화" 버튼을 클릭하거나, localStorage를 수동 삭제:
```javascript
// 브라우저 콘솔에서 실행
localStorage.removeItem('app_config');
window.location.reload();
```

---

**Q4. 다른 파일 타입(PDF, DOCX)도 숨길 수 있나요?**

**A**: 현재는 TXT 파일만 지원하지만, 동일한 패턴으로 확장 가능합니다:
```typescript
export interface PrivacyFeatures {
  enabled: boolean;
  hideTxtContent: boolean;
  hidePdfContent: boolean;   // 추가
  hideDocxContent: boolean;  // 추가
}
```

---

**Q5. 백엔드에서도 TXT 파일을 숨겨야 하나요?**

**A**: **아니요**. 프론트엔드의 Privacy 설정은 **UI 표시용**입니다.
- 백엔드는 모든 데이터를 정상적으로 반환
- 프론트엔드에서 조건부로 숨김 처리
- 보안이 중요한 경우 백엔드에서도 필터링 권장

---

### 7.2 주의사항

⚠️ **보안 관련**
- 이 기능은 **UI 숨김**일 뿐, 데이터 자체를 암호화하거나 삭제하지 않습니다
- 브라우저 개발자 도구로 네트워크 요청을 확인하면 원본 데이터를 볼 수 있습니다
- 진정한 보안이 필요하면 백엔드에서 필터링해야 합니다

⚠️ **타입 안전성**
- `useFeature('privacy')` 사용 시 TypeScript 타입 체크 활용
- 잘못된 모듈명 입력 시 컴파일 오류 발생

⚠️ **성능**
- 조건부 렌더링이 추가되지만 성능 영향은 미미함
- React 리렌더링 최적화는 이미 적용됨

⚠️ **호환성**
- FeatureProvider 내부에서만 `useFeature` 훅 사용 가능
- App.tsx에 이미 FeatureProvider가 설정되어 있음

---

## 8. 구현 체크리스트

### 개발 단계
- [ ] features.ts에 PrivacyFeatures 인터페이스 추가
- [ ] FeatureConfig에 privacy 모듈 추가
- [ ] DEFAULT_FEATURES에 privacy 기본값 설정
- [ ] loadFeaturesFromEnv 함수에 privacy 로드 로직 추가
- [ ] SettingsPage.tsx에 Privacy 설정 UI 추가
- [ ] features 상태에 privacy 추가
- [ ] handleSaveSettings에 privacy 저장 로직 추가
- [ ] ChatTab.tsx에 useFeature('privacy') 추가
- [ ] 5개 위치의 조건부 렌더링 수정

### 테스트 단계
- [ ] 기본 상태 (hideTxtContent: true) 동작 확인
- [ ] 설정 페이지에서 OFF 설정 확인
- [ ] 설정 영속성 확인 (새로고침 후)
- [ ] PDF 파일 영향 없음 확인
- [ ] 환경변수 우선순위 확인
- [ ] TypeScript 타입 체크 통과 확인

### 문서화 단계
- [ ] FEATURE_FLAGS_GUIDE.md 업데이트
- [ ] CLAUDE.md에 Privacy 모듈 추가
- [ ] 구현 완료 후 Git 커밋 메시지 작성

---

## 9. 예상 일정

| 단계 | 예상 시간 | 담당 |
|------|----------|------|
| features.ts 수정 | 15분 | 개발자 |
| SettingsPage.tsx 수정 | 30분 | 개발자 |
| ChatTab.tsx 수정 | 20분 | 개발자 |
| 통합 테스트 | 20분 | QA |
| 문서 업데이트 | 30분 | 개발자 |
| **총 예상 시간** | **약 2시간** | - |

---

## 10. 참고 자료

### 관련 문서
- [Feature Flags 사용 가이드](./FEATURE_FLAGS_GUIDE.md)
- [브랜드 설정 가이드](./BRAND_CONFIGURATION_GUIDE.md)
- [색상 관리 시스템 가이드](./COLOR_SYSTEM_GUIDE.md)

### 관련 커밋
- `135db6f`: TXT 파일 하드코딩 구현 (2025-11-18)
- `3ac623c`: 전화번호 자동 마스킹 시스템 구현

### 핵심 파일
- `src/config/features.ts` - Feature Flag 설정
- `src/core/FeatureProvider.tsx` - Feature Context Provider
- `src/core/useConfig.ts` - Config 훅
- `src/pages/Admin/SettingsPage.tsx` - 관리자 설정 UI
- `src/components/ChatTab.tsx` - 챗봇 UI

---

## 11. 결론

이 구현 계획은 **기존 인프라를 최대한 활용**하여 **최소한의 코드 변경**으로 TXT 파일 노출 제어 기능을 추가합니다.

**핵심 장점**:
- ✓ 검증된 기능 플래그 시스템 재사용
- ✓ 관리자 페이지에서 즉시 제어 가능
- ✓ 환경변수 지원으로 유연한 배포
- ✓ 타입 안전성 보장
- ✓ 확장 가능한 구조 (다른 프라이버시 설정 추가 용이)

**예상 작업량**: 약 90줄의 코드 추가/수정 (2시간 소요)

**다음 단계**: 이 문서를 기반으로 구현을 시작하거나, 추가 논의가 필요한 부분에 대해 피드백 부탁드립니다.
