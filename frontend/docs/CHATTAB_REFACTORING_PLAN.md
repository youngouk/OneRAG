# ChatTab.tsx 리팩토링 계획서

> **기술 부채 해소 1단계** - 2,100줄 단일 파일을 관리 가능한 단위로 분리
>
> 예상 기간: 1~2주

## 📋 목차

1. [현황 분석](#1-현황-분석)
2. [문제점 식별](#2-문제점-식별)
3. [리팩토링 전략](#3-리팩토링-전략)
4. [컴포넌트 분리 계획](#4-컴포넌트-분리-계획)
5. [보안 개선 계획](#5-보안-개선-계획)
6. [구현 일정](#6-구현-일정)
7. [검증 계획](#7-검증-계획)

---

## 1. 현황 분석

### 1.1 파일 개요

| 항목 | 현재 상태 |
|------|----------|
| 파일 경로 | `src/components/ChatTab.tsx` |
| 총 라인 수 | **2,100줄** |
| useState 훅 | 17개 이상 |
| useEffect 훅 | 6개 이상 |
| 주요 책임 | 채팅 UI, 세션 관리, 메시지 처리, DevTools, 소스 모달 등 |

### 1.2 현재 코드 구조

```
ChatTab.tsx (2,100줄)
├── 유틸리티 함수들 (66-267줄) ────────── 약 200줄
│   ├── parseHtmlContent()           # HTML → 텍스트 변환
│   ├── formatSourcePreview()        # 소스 미리보기 포맷팅
│   ├── formatFullContent()          # 전체 내용 포맷팅
│   ├── formatModelConfigValue()     # 모델 설정값 포맷팅
│   └── mapHistoryEntryToChatMessage() # 히스토리 → 메시지 매핑
│
├── 인터페이스 정의 (269-288줄) ───────── 약 20줄
│   ├── DocumentInfoItem
│   ├── ChatTabProps
│   └── ApiLog
│
├── 컴포넌트 상태 (289-325줄) ──────────── 약 40줄
│   └── 17개 이상의 useState 선언
│
├── 비즈니스 로직 (327-900줄) ──────────── 약 570줄
│   ├── documentInfoItems useMemo
│   ├── scrollToBottom()
│   ├── copyToClipboard()
│   ├── synchronizeSessionId()
│   ├── initializeSession() ──────────── 230줄 (가장 큰 함수)
│   ├── handleSend()
│   └── handleNewSession()
│
├── DevTools 패널 JSX (906-1301줄) ────── 약 400줄
│
├── 메인 채팅 영역 JSX (1303-1866줄) ──── 약 560줄
│   ├── 헤더
│   ├── 메시지 목록
│   └── 입력 영역
│
└── 청크 상세 모달 JSX (1868-2096줄) ──── 약 230줄
```

---

## 2. 문제점 식별

### 2.1 아키텍처 문제

| 문제 | 영향 | 심각도 |
|------|------|--------|
| **단일 책임 원칙 위반** | 하나의 파일이 너무 많은 역할 수행 | 🔴 높음 |
| **높은 결합도** | 컴포넌트 간 의존성이 암묵적으로 얽혀 있음 | 🔴 높음 |
| **테스트 불가능** | 개별 기능 단위 테스트 작성 어려움 | 🟡 중간 |
| **재사용성 없음** | 유틸리티 함수들이 파일 내부에 갇혀 있음 | 🟡 중간 |

### 2.2 유지보수 문제

```
❌ 수정 시 사이드 이펙트 발생 위험 높음
❌ 코드 리뷰 시 전체 맥락 파악 어려움
❌ 새로운 기능 추가 시 어디에 넣어야 할지 불분명
❌ 버그 발생 시 원인 추적 복잡
```

### 2.3 보안 문제

현재 API 키가 클라이언트 측에 노출되어 있습니다:

```typescript
// src/services/api.ts (121-139줄)
let apiKey = import.meta.env.VITE_API_KEY;
if (!apiKey && typeof window !== 'undefined' && window.RUNTIME_CONFIG?.API_KEY) {
  apiKey = window.RUNTIME_CONFIG.API_KEY;  // ⚠️ 브라우저에서 접근 가능
}
```

```typescript
// src/types/global.d.ts
interface RuntimeConfig {
  API_KEY?: string;  // ⚠️ window 객체에 노출
}
```

**위험 요소:**
- 브라우저 DevTools에서 API 키 확인 가능
- 네트워크 요청 헤더에서 키 노출
- 악의적 사용자가 키를 탈취하여 API 남용 가능

---

## 3. 리팩토링 전략

### 3.1 핵심 원칙

```
1️⃣ 점진적 리팩토링 - 한 번에 하나씩, 동작하는 상태 유지
2️⃣ 기능 동등성 - 리팩토링 전후 동일한 동작 보장
3️⃣ 테스트 우선 - 분리 전 기존 동작에 대한 테스트 작성
4️⃣ 명확한 경계 - 각 모듈의 책임을 명확히 정의
```

### 3.2 분리 기준

| 기준 | 설명 | 예시 |
|------|------|------|
| **책임** | 하나의 모듈은 하나의 책임만 | 세션 관리 ↔ UI 렌더링 |
| **재사용성** | 다른 곳에서 쓸 수 있는가? | 유틸리티 함수들 |
| **변경 빈도** | 함께 변경되는 코드끼리 | DevTools 로직 |
| **복잡도** | 100줄 이상이면 분리 고려 | initializeSession() |

### 3.3 목표 구조

```
src/
├── components/
│   └── chat/                          # 새로운 chat 디렉토리
│       ├── ChatTab.tsx                # 메인 컨테이너 (300줄 목표)
│       ├── ChatHeader.tsx             # 헤더 컴포넌트
│       ├── ChatMessageList.tsx        # 메시지 목록
│       ├── ChatInput.tsx              # 입력 영역
│       ├── ChatDevTools.tsx           # DevTools 패널
│       ├── ChunkDetailModal.tsx       # 청크 상세 모달
│       └── index.ts                   # 배럴 파일
│
├── hooks/
│   └── chat/
│       ├── useChatSession.ts          # 세션 관리 로직
│       ├── useChatMessages.ts         # 메시지 상태 관리
│       └── useChatDevTools.ts         # DevTools 상태 관리
│
├── utils/
│   └── chat/
│       ├── htmlParser.ts              # HTML 파싱 유틸리티
│       ├── messageMapper.ts           # 메시지 매핑 유틸리티
│       └── formatters.ts              # 포맷팅 유틸리티
│
└── types/
    └── chat.ts                        # 채팅 관련 타입 정의
```

---

## 4. 컴포넌트 분리 계획

### 4.1 Phase 1: 유틸리티 함수 추출 (1일)

**대상:** 66-267줄의 유틸리티 함수들

**왜 먼저 분리하나?**
- 의존성이 가장 적음 (다른 코드에 영향 없이 분리 가능)
- 순수 함수들이므로 테스트 작성 용이
- 다른 컴포넌트에서도 재사용 가능

**분리할 파일:**

```typescript
// src/utils/chat/htmlParser.ts
/**
 * HTML 문자열을 순수 텍스트로 변환
 * @param html - 파싱할 HTML 문자열
 * @returns 정제된 텍스트
 */
export function parseHtmlContent(html: string): string {
  // 기존 구현 이동
}
```

```typescript
// src/utils/chat/formatters.ts
/**
 * 소스 미리보기 텍스트 생성
 */
export function formatSourcePreview(content: string, maxLength?: number): string {
  // 기존 구현 이동
}

/**
 * 전체 내용 포맷팅
 */
export function formatFullContent(content: string): string {
  // 기존 구현 이동
}

/**
 * 모델 설정값 포맷팅
 */
export function formatModelConfigValue(key: string, value: unknown): string {
  // 기존 구현 이동
}
```

```typescript
// src/utils/chat/messageMapper.ts
import type { ChatMessage, HistoryEntry } from '@/types/chat';

/**
 * 히스토리 항목을 채팅 메시지로 변환
 */
export function mapHistoryEntryToChatMessage(entry: HistoryEntry): ChatMessage {
  // 기존 구현 이동
}
```

### 4.2 Phase 2: 타입 정의 분리 (0.5일)

**대상:** 269-288줄의 인터페이스 정의

**왜 분리하나?**
- 타입은 여러 파일에서 공유되어야 함
- 타입 변경 시 영향 범위 추적 용이

**분리할 파일:**

```typescript
// src/types/chat.ts
export interface DocumentInfoItem {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sources?: Source[];
  chunks?: Chunk[];
  // ... 기타 필드
}

export interface ApiLog {
  timestamp: Date;
  type: 'request' | 'response' | 'error';
  data: unknown;
}

// ChatTabProps는 내부용이므로 컴포넌트 파일에 유지 가능
```

### 4.3 Phase 3: 커스텀 훅 추출 (2일)

**대상:** 세션 관리, 메시지 처리, DevTools 상태

**왜 분리하나?**
- 상태 로직과 UI 렌더링 분리 (관심사 분리)
- 훅 단위로 테스트 가능
- 상태 관리 로직 재사용 가능

#### 3.1 useChatSession 훅

```typescript
// src/hooks/chat/useChatSession.ts
import { useState, useCallback, useEffect } from 'react';
import { chatAPI } from '@/services/api';

interface UseChatSessionOptions {
  onSessionChange?: (sessionId: string) => void;
}

interface UseChatSessionReturn {
  sessionId: string | null;
  isInitializing: boolean;
  initializeSession: () => Promise<void>;
  startNewSession: () => Promise<void>;
  synchronizeSessionId: () => void;
}

/**
 * 채팅 세션 관리를 위한 커스텀 훅
 *
 * 책임:
 * - 세션 ID 초기화 및 저장
 * - 새 세션 생성
 * - localStorage와 동기화
 */
export function useChatSession(options?: UseChatSessionOptions): UseChatSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // initializeSession 로직 (440-669줄에서 추출)
  const initializeSession = useCallback(async () => {
    // 기존 230줄 로직을 정리하여 이동
  }, []);

  // handleNewSession 로직 (827-868줄에서 추출)
  const startNewSession = useCallback(async () => {
    // 기존 로직 이동
  }, []);

  // synchronizeSessionId 로직 (418-436줄에서 추출)
  const synchronizeSessionId = useCallback(() => {
    // 기존 로직 이동
  }, []);

  return {
    sessionId,
    isInitializing,
    initializeSession,
    startNewSession,
    synchronizeSessionId,
  };
}
```

#### 3.2 useChatMessages 훅

```typescript
// src/hooks/chat/useChatMessages.ts
import { useState, useCallback, useRef } from 'react';
import type { ChatMessage } from '@/types/chat';

interface UseChatMessagesReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  scrollToBottom: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

/**
 * 채팅 메시지 상태 관리를 위한 커스텀 훅
 *
 * 책임:
 * - 메시지 목록 상태 관리
 * - 메시지 전송 처리
 * - 스크롤 관리
 */
export function useChatMessages(sessionId: string | null): UseChatMessagesReturn {
  // handleSend 로직 (692-812줄에서 추출)
  // 메시지 상태 관리 로직 이동
}
```

#### 3.3 useChatDevTools 훅

```typescript
// src/hooks/chat/useChatDevTools.ts
import { useState, useCallback } from 'react';
import type { ApiLog } from '@/types/chat';

interface UseChatDevToolsReturn {
  isOpen: boolean;
  toggleDevTools: () => void;
  apiLogs: ApiLog[];
  addLog: (log: ApiLog) => void;
  clearLogs: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

/**
 * DevTools 패널 상태 관리를 위한 커스텀 훅
 */
export function useChatDevTools(): UseChatDevToolsReturn {
  // DevTools 관련 상태 및 로직 이동
}
```

### 4.4 Phase 4: UI 컴포넌트 분리 (2-3일)

**대상:** JSX 렌더링 부분 (906-2096줄)

**분리 순서:** 의존성이 적은 것부터

#### 4.1 ChunkDetailModal (먼저)

```typescript
// src/components/chat/ChunkDetailModal.tsx
import { Dialog, DialogTitle, DialogContent, Typography } from '@mui/material';
import type { Chunk } from '@/types/chat';

interface ChunkDetailModalProps {
  open: boolean;
  onClose: () => void;
  chunk: Chunk | null;
}

/**
 * 청크 상세 정보 모달
 *
 * 왜 먼저 분리?
 * - 독립적인 UI 컴포넌트
 * - 다른 부분과 의존성 최소
 * - 230줄 → 별도 파일로 관리
 */
export function ChunkDetailModal({ open, onClose, chunk }: ChunkDetailModalProps) {
  // 1868-2096줄 JSX 이동
}
```

#### 4.2 ChatDevTools

```typescript
// src/components/chat/ChatDevTools.tsx
import { Box, Tabs, Tab } from '@mui/material';
import { useChatDevTools } from '@/hooks/chat/useChatDevTools';

interface ChatDevToolsProps {
  sessionId: string | null;
  modelConfig: ModelConfig;
  apiLogs: ApiLog[];
}

/**
 * 개발자 도구 패널
 *
 * 왜 분리?
 * - 400줄의 복잡한 UI
 * - 개발/디버깅 전용 기능
 * - 프로덕션에서는 숨길 수 있음
 */
export function ChatDevTools({ sessionId, modelConfig, apiLogs }: ChatDevToolsProps) {
  // 906-1301줄 JSX 이동
}
```

#### 4.3 ChatMessageList

```typescript
// src/components/chat/ChatMessageList.tsx
import { Box, Typography, Avatar } from '@mui/material';
import type { ChatMessage } from '@/types/chat';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSourceClick: (source: Source) => void;
  onChunkClick: (chunk: Chunk) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

/**
 * 채팅 메시지 목록 컴포넌트
 *
 * 왜 분리?
 * - 메시지 렌더링이 복잡함
 * - 가상 스크롤 적용 시 독립 관리 필요
 * - 메시지 스타일링 변경이 빈번함
 */
export function ChatMessageList({ messages, isLoading, ...props }: ChatMessageListProps) {
  // 메시지 목록 렌더링 JSX 이동
}
```

#### 4.4 ChatInput

```typescript
// src/components/chat/ChatInput.tsx
import { Box, TextField, IconButton } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder?: string;
}

/**
 * 채팅 입력 영역 컴포넌트
 *
 * 왜 분리?
 * - 입력 관련 UX 개선이 독립적
 * - 음성 입력, 파일 첨부 등 확장 가능
 */
export function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
  // 입력 영역 JSX 이동
}
```

#### 4.5 ChatHeader

```typescript
// src/components/chat/ChatHeader.tsx
import { Box, IconButton, Typography } from '@mui/material';

interface ChatHeaderProps {
  title: string;
  sessionId: string | null;
  onNewSession: () => void;
  onToggleDevTools: () => void;
}

/**
 * 채팅 헤더 컴포넌트
 */
export function ChatHeader({ title, sessionId, onNewSession, onToggleDevTools }: ChatHeaderProps) {
  // 헤더 JSX 이동
}
```

### 4.5 Phase 5: 메인 컴포넌트 정리 (1일)

**최종 ChatTab.tsx 구조:**

```typescript
// src/components/chat/ChatTab.tsx (목표: 300줄 이하)
import { Box } from '@mui/material';

// 커스텀 훅
import { useChatSession } from '@/hooks/chat/useChatSession';
import { useChatMessages } from '@/hooks/chat/useChatMessages';
import { useChatDevTools } from '@/hooks/chat/useChatDevTools';

// UI 컴포넌트
import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { ChatDevTools } from './ChatDevTools';
import { ChunkDetailModal } from './ChunkDetailModal';

interface ChatTabProps {
  // 필요한 props만 정의
}

/**
 * 채팅 탭 메인 컨테이너
 *
 * 책임:
 * - 하위 컴포넌트 조합
 * - 레이아웃 관리
 * - 상태 연결
 */
export function ChatTab({ ...props }: ChatTabProps) {
  // 훅 사용
  const session = useChatSession();
  const messages = useChatMessages(session.sessionId);
  const devTools = useChatDevTools();

  // 모달 상태
  const [selectedChunk, setSelectedChunk] = useState<Chunk | null>(null);

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* DevTools 패널 */}
      {devTools.isOpen && (
        <ChatDevTools {...devTools} sessionId={session.sessionId} />
      )}

      {/* 메인 채팅 영역 */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ChatHeader
          sessionId={session.sessionId}
          onNewSession={session.startNewSession}
          onToggleDevTools={devTools.toggleDevTools}
        />

        <ChatMessageList
          messages={messages.messages}
          isLoading={messages.isLoading}
          onChunkClick={setSelectedChunk}
          messagesEndRef={messages.messagesEndRef}
        />

        <ChatInput
          onSend={messages.sendMessage}
          disabled={messages.isSending}
        />
      </Box>

      {/* 청크 상세 모달 */}
      <ChunkDetailModal
        open={!!selectedChunk}
        onClose={() => setSelectedChunk(null)}
        chunk={selectedChunk}
      />
    </Box>
  );
}
```

---

## 5. 보안 개선 계획

### 5.1 현재 문제

```
┌─────────────────────────────────────────────────────────────┐
│  현재 구조 (보안 취약)                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   브라우저                          백엔드                    │
│   ┌─────────┐    API_KEY 포함      ┌─────────┐              │
│   │ Frontend│ ─────────────────→  │ Backend │              │
│   │         │    요청 헤더에 노출   │         │              │
│   └─────────┘                      └─────────┘              │
│       ↑                                                     │
│       │ window.RUNTIME_CONFIG.API_KEY                       │
│       │ DevTools에서 확인 가능 ⚠️                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 개선 방안

#### Option A: 세션 기반 인증 (권장)

```
┌─────────────────────────────────────────────────────────────┐
│  개선 구조 (세션 기반)                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   브라우저                          백엔드                    │
│   ┌─────────┐    세션 쿠키만       ┌─────────┐              │
│   │ Frontend│ ─────────────────→  │ Backend │              │
│   │         │    HttpOnly 쿠키     │         │              │
│   └─────────┘                      └─────────┘              │
│                                         │                   │
│                                         ↓                   │
│                                    API_KEY는                │
│                                    서버에서만 사용           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**구현 단계:**

1. **백엔드 수정** (백엔드 팀 협의 필요)
   ```python
   # 세션 생성 시 HttpOnly 쿠키 발급
   response.set_cookie(
       key="session_token",
       value=generate_session_token(),
       httponly=True,
       secure=True,
       samesite="strict"
   )
   ```

2. **프론트엔드 수정**
   ```typescript
   // src/services/api.ts
   const axiosInstance = axios.create({
     baseURL: getApiBaseUrl(),
     timeout: 300000,
     withCredentials: true,  // 쿠키 자동 포함
     // API_KEY 헤더 제거
   });
   ```

3. **RUNTIME_CONFIG에서 API_KEY 제거**
   ```typescript
   // src/types/global.d.ts
   interface RuntimeConfig {
     API_BASE_URL?: string;
     WS_BASE_URL?: string;
     // API_KEY?: string;  // 제거
   }
   ```

#### Option B: Proxy 패턴 (프론트엔드만 수정)

백엔드 수정이 어려운 경우:

```
┌─────────────────────────────────────────────────────────────┐
│  Proxy 패턴                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   브라우저           Edge/Proxy            백엔드            │
│   ┌─────────┐       ┌─────────┐          ┌─────────┐       │
│   │ Frontend│ ────→ │  Edge   │ ───────→ │ Backend │       │
│   │         │       │ Function│ API_KEY  │         │       │
│   └─────────┘       └─────────┘ 추가     └─────────┘       │
│                          ↑                                  │
│                     API_KEY는                               │
│                     Edge에서만 보유                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**구현 (Cloudflare Workers 예시):**

```typescript
// edge-proxy/worker.ts
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // API 요청인 경우에만 처리
    if (url.pathname.startsWith('/api/')) {
      const apiKey = env.API_KEY;  // 환경 변수에서 가져옴

      const newRequest = new Request(BACKEND_URL + url.pathname, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          'X-API-Key': apiKey,  // 서버 사이드에서 추가
        },
        body: request.body,
      });

      return fetch(newRequest);
    }

    return fetch(request);
  }
};
```

### 5.3 즉시 적용 가능한 개선

백엔드 수정 전까지 적용할 수 있는 임시 조치:

```typescript
// src/services/api.ts - API 키 난독화 (임시)

// 1. 환경 변수 직접 노출 방지
const getApiKey = (): string => {
  // 빌드 시점에 주입된 값 사용
  // 런타임에 window 객체에서 직접 접근 불가능하게 클로저 활용
  const key = import.meta.env.VITE_API_KEY;
  return key ? atob(key) : '';  // Base64 인코딩된 값 사용
};

// 2. window.RUNTIME_CONFIG에서 API_KEY 제거
// config.js 생성 스크립트 수정
```

### 5.4 보안 개선 일정

| 단계 | 작업 | 담당 | 기간 |
|------|------|------|------|
| 1 | RUNTIME_CONFIG에서 API_KEY 제거 | 프론트엔드 | 0.5일 |
| 2 | 백엔드 세션 인증 API 구현 | 백엔드 | 2-3일 |
| 3 | 프론트엔드 인증 로직 변경 | 프론트엔드 | 1일 |
| 4 | 통합 테스트 | 전체 | 0.5일 |

---

## 6. 구현 일정

### 6.1 전체 타임라인

```
Week 1
├── Day 1-2: 유틸리티 함수 추출 + 타입 분리
│   └── ✅ 테스트 작성 → 추출 → 테스트 통과 확인
│
├── Day 3-4: 커스텀 훅 추출
│   ├── useChatSession
│   ├── useChatMessages
│   └── useChatDevTools
│
└── Day 5: ChunkDetailModal 분리 + 보안 1단계

Week 2
├── Day 1-2: UI 컴포넌트 분리
│   ├── ChatDevTools
│   ├── ChatMessageList
│   ├── ChatInput
│   └── ChatHeader
│
├── Day 3: 메인 컴포넌트 정리
│
├── Day 4: 통합 테스트 + 버그 수정
│
└── Day 5: 코드 리뷰 + 문서화
```

### 6.2 상세 체크리스트

#### Week 1

- [ ] **Day 1: 유틸리티 함수 추출**
  - [ ] `src/utils/chat/` 디렉토리 생성
  - [ ] `htmlParser.ts` 생성 및 테스트
  - [ ] `formatters.ts` 생성 및 테스트
  - [ ] `messageMapper.ts` 생성 및 테스트
  - [ ] ChatTab.tsx에서 import 변경

- [ ] **Day 2: 타입 분리**
  - [ ] `src/types/chat.ts` 생성
  - [ ] 인터페이스 이동
  - [ ] 전체 import 경로 업데이트

- [ ] **Day 3: useChatSession 훅**
  - [ ] `src/hooks/chat/` 디렉토리 생성
  - [ ] `useChatSession.ts` 생성
  - [ ] initializeSession 로직 이동
  - [ ] handleNewSession 로직 이동
  - [ ] 훅 테스트 작성

- [ ] **Day 4: useChatMessages, useChatDevTools 훅**
  - [ ] `useChatMessages.ts` 생성
  - [ ] `useChatDevTools.ts` 생성
  - [ ] 관련 상태 및 로직 이동
  - [ ] 훅 테스트 작성

- [ ] **Day 5: ChunkDetailModal + 보안**
  - [ ] `ChunkDetailModal.tsx` 생성
  - [ ] 모달 JSX 이동
  - [ ] RUNTIME_CONFIG에서 API_KEY 제거
  - [ ] 관련 설정 업데이트

#### Week 2

- [ ] **Day 1: ChatDevTools 분리**
  - [ ] `ChatDevTools.tsx` 생성
  - [ ] DevTools JSX 이동 (400줄)
  - [ ] 컴포넌트 테스트

- [ ] **Day 2: 나머지 UI 컴포넌트**
  - [ ] `ChatMessageList.tsx` 생성
  - [ ] `ChatInput.tsx` 생성
  - [ ] `ChatHeader.tsx` 생성

- [ ] **Day 3: 메인 컴포넌트 정리**
  - [ ] ChatTab.tsx 정리 (목표 300줄)
  - [ ] 배럴 파일(`index.ts`) 생성
  - [ ] 불필요한 코드 제거

- [ ] **Day 4: 통합 테스트**
  - [ ] E2E 테스트 실행
  - [ ] 수동 테스트
  - [ ] 버그 수정

- [ ] **Day 5: 마무리**
  - [ ] 코드 리뷰
  - [ ] 문서 업데이트
  - [ ] PR 생성

---

## 7. 검증 계획

### 7.1 테스트 전략

```
┌─────────────────────────────────────────────────────────────┐
│  테스트 피라미드                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    ╱╲                                       │
│                   ╱  ╲   E2E 테스트                         │
│                  ╱────╲  (Playwright/Cypress)               │
│                 ╱      ╲                                    │
│                ╱────────╲   통합 테스트                      │
│               ╱          ╲  (컴포넌트 조합)                  │
│              ╱────────────╲                                 │
│             ╱              ╲   유닛 테스트                   │
│            ╱                ╲  (유틸리티, 훅)                │
│           ╱──────────────────╲                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 테스트 케이스

#### 유닛 테스트 (Vitest)

```typescript
// src/utils/chat/__tests__/htmlParser.test.ts
describe('parseHtmlContent', () => {
  it('HTML 태그를 제거해야 함', () => {
    expect(parseHtmlContent('<p>Hello</p>')).toBe('Hello');
  });

  it('중첩된 태그를 처리해야 함', () => {
    expect(parseHtmlContent('<div><span>Test</span></div>')).toBe('Test');
  });

  it('빈 문자열을 반환해야 함 (입력이 없을 때)', () => {
    expect(parseHtmlContent('')).toBe('');
  });
});
```

```typescript
// src/hooks/chat/__tests__/useChatSession.test.ts
describe('useChatSession', () => {
  it('초기화 시 세션 ID를 생성해야 함', async () => {
    const { result } = renderHook(() => useChatSession());

    await act(async () => {
      await result.current.initializeSession();
    });

    expect(result.current.sessionId).toBeTruthy();
  });
});
```

#### 컴포넌트 테스트

```typescript
// src/components/chat/__tests__/ChatInput.test.tsx
describe('ChatInput', () => {
  it('입력값 변경 시 onChange 호출', () => {
    const onChange = vi.fn();
    render(<ChatInput value="" onChange={onChange} onSend={() => {}} disabled={false} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } });
    expect(onChange).toHaveBeenCalledWith('Hello');
  });

  it('disabled 상태에서 전송 버튼 비활성화', () => {
    render(<ChatInput value="test" onChange={() => {}} onSend={() => {}} disabled={true} />);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### 7.3 회귀 테스트 체크리스트

각 단계 완료 후 확인:

- [ ] 채팅 메시지 전송 정상 작동
- [ ] 세션 생성/복원 정상 작동
- [ ] 메시지 히스토리 로딩 정상 작동
- [ ] 소스/청크 모달 표시 정상 작동
- [ ] DevTools 패널 토글 정상 작동
- [ ] 스트리밍 응답 표시 정상 작동
- [ ] 에러 상태 표시 정상 작동
- [ ] 모바일 반응형 레이아웃 정상 작동

### 7.4 성공 기준

| 메트릭 | 기준 | 측정 방법 |
|--------|------|----------|
| 파일 크기 | ChatTab.tsx < 400줄 | `wc -l` |
| 테스트 커버리지 | 신규 코드 80% 이상 | Vitest coverage |
| 기능 동등성 | 모든 기존 기능 작동 | 수동 테스트 체크리스트 |
| 빌드 성공 | 에러/경고 없음 | `npm run build` |
| 린트 통과 | ESLint 에러 없음 | `npm run lint` |

---

## 📎 부록

### A. 관련 파일 목록

현재 리팩토링 대상:
- `src/components/ChatTab.tsx` (2,100줄)

생성될 파일:
- `src/components/chat/ChatTab.tsx`
- `src/components/chat/ChatHeader.tsx`
- `src/components/chat/ChatMessageList.tsx`
- `src/components/chat/ChatInput.tsx`
- `src/components/chat/ChatDevTools.tsx`
- `src/components/chat/ChunkDetailModal.tsx`
- `src/components/chat/index.ts`
- `src/hooks/chat/useChatSession.ts`
- `src/hooks/chat/useChatMessages.ts`
- `src/hooks/chat/useChatDevTools.ts`
- `src/utils/chat/htmlParser.ts`
- `src/utils/chat/formatters.ts`
- `src/utils/chat/messageMapper.ts`
- `src/types/chat.ts`

### B. 의존성 다이어그램

```
                    ChatTab (Container)
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    useChatSession  useChatMessages  useChatDevTools
           │               │               │
           └───────┬───────┴───────────────┘
                   │
                   ▼
             chatAPI (services)
                   │
                   ▼
              Backend API
```

### C. 참고 문서

- [React Hooks 공식 문서](https://react.dev/reference/react)
- [Material-UI 컴포넌트 문서](https://mui.com/components/)
- [프로젝트 CLAUDE.md](../CLAUDE.md)
- [색상 시스템 가이드](./COLOR_SYSTEM_GUIDE.md)

---

> **작성일**: 2026-01-15
> **작성자**: Claude Code
> **버전**: 1.0
