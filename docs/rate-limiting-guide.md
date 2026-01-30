# Rate Limiting 이중 계층 정책 가이드

OneRAG 프로젝트의 Rate Limiting 시스템은 **두 개의 독립적인 계층**으로 구성되어 있습니다. 각 계층은 독립적으로 동작하며, 요청이 두 계층을 모두 통과해야 최종 처리됩니다.

## 📋 목차
1. [개요 - 이중 계층 구조](#개요---이중-계층-구조)
2. [1계층: 글로벌 미들웨어](#1계층-글로벌-미들웨어)
3. [2계층: 엔드포인트 제한](#2계층-엔드포인트-제한)
4. [계층 간 상호작용](#계층-간-상호작용)
5. [응답 형식](#응답-형식)
6. [설정 변경 방법](#설정-변경-방법)
7. [모니터링](#모니터링)

---

## 개요 - 이중 계층 구조

### 왜 두 개의 계층인가?

OneRAG는 다음과 같은 이유로 이중 계층 Rate Limiting을 채택했습니다:

1. **전역 보호 (Layer 1)**: 모든 API 엔드포인트에 대한 기본 보호
2. **엔드포인트별 제어 (Layer 2)**: 리소스 집약적인 특정 엔드포인트에 대한 추가 제한

### 계층 비교

| 구분 | 1계층: 글로벌 미들웨어 | 2계층: slowapi |
|------|----------------------|----------------|
| **적용 범위** | 모든 엔드포인트 (제외 경로 제외) | `/chat/stream` 엔드포인트만 |
| **제한 기준** | IP (30/분) + Session (10/분) | IP (100/15분) |
| **구현 방식** | 커스텀 미들웨어 | slowapi 라이브러리 |
| **메모리 보호** | ✅ 최대 1만 IP + 5만 세션 추적 | ❌ 없음 |
| **제외 경로** | `/health`, `/docs` 등 | 없음 |
| **주기적 정리** | ✅ 24시간 주기 백그라운드 태스크 | ❌ 없음 |

---

## 1계층: 글로벌 미들웨어

### 구현 위치
- **파일**: `app/middleware/rate_limiter.py`
- **클래스**: `RateLimiter`, `RateLimitMiddleware`

### 제한 정책

```python
# 기본 설정값
IP_LIMIT = 30           # IP당 분당 30개 요청
SESSION_LIMIT = 10      # 세션당 분당 10개 요청
WINDOW_SECONDS = 60     # 60초 시간 윈도우
```

| 제한 타입 | 제한값 | 우선순위 |
|----------|--------|---------|
| **IP 기반** | 30 요청/분 | 1순위 (IP가 있으면 IP 우선) |
| **Session 기반** | 10 요청/분 | 2순위 (IP가 없을 때 fallback) |

### 제외 경로

다음 경로들은 Rate Limiting에서 제외됩니다:

```python
EXCLUDED_PATHS = [
    "/health",
    "/api/health",
    "/docs",
    "/redoc",
    "/openapi.json",
]
```

**제외 이유**:
- `/health`, `/api/health`: 헬스체크 모니터링 (무제한 호출 필요)
- `/docs`, `/redoc`, `/openapi.json`: API 문서 (정적 리소스)

### IP 및 Session ID 추출 로직

#### IP 주소 추출 우선순위
1. `X-Forwarded-For` 헤더 (프록시 환경, 첫 번째 IP 사용)
2. `X-Real-IP` 헤더
3. `request.client.host` (직접 연결)

#### Session ID 추출 우선순위
1. `X-Session-ID` 헤더 (가장 빠름)
2. Query parameter `session_id`
3. POST 요청 body의 `session_id` 필드

### 메모리 보호 메커니즘

DDoS 공격으로부터 서버 메모리를 보호하기 위해 추적 대상을 제한합니다:

```python
MAX_TRACKED_IPS = 10_000       # 최대 1만 IP 추적
MAX_TRACKED_SESSIONS = 50_000  # 최대 5만 세션 추적
```

**동작 방식**:
- 제한을 초과하면 **LRU(Least Recently Used) 전략**으로 가장 오래된 엔트리 제거
- 로그에 `🛡️ 메모리 보호: 오래된 IP 제거` 메시지 출력

### 백그라운드 정리 태스크

**목적**: 메모리 누수 방지
- **실행 주기**: 24시간 (86,400초)
- **정리 대상**: `window_seconds + grace_period` (60초 + 60초 = 120초) 이전의 오래된 요청 기록
- **로그 메시지**: `🔄 Background cleanup task started`, `✅ Cleanup completed`

**FastAPI 라이프사이클 통합**:
```python
# 서버 시작 시 (lifespan startup)
rate_limiter.start_cleanup_task()

# 서버 종료 시 (lifespan shutdown)
await rate_limiter.stop_cleanup_task()
```

---

## 2계층: 엔드포인트 제한

### 구현 위치
- **파일**: `app/api/routers/chat_router.py`
- **라이브러리**: `slowapi` (FastAPI용 Rate Limiting 라이브러리)

### 제한 정책

```python
@router.post("/chat/stream")
@limiter.limit("100/15minutes")  # IP당 15분에 100개 요청
async def chat_stream(request: Request, chat_request: StreamChatRequest):
    ...
```

| 엔드포인트 | 제한값 | 기준 |
|----------|--------|------|
| `POST /chat/stream` | 100 요청/15분 | IP 주소 (`get_remote_address`) |

### 적용 이유

`/chat/stream` 엔드포인트는 다음과 같은 이유로 추가 제한이 필요합니다:

1. **리소스 집약적**: SSE(Server-Sent Events) 스트리밍으로 장시간 연결 유지
2. **LLM 비용**: OpenAI/Gemini/Claude API 호출 비용 발생
3. **서버 부하**: 다수의 동시 스트리밍은 메모리/CPU 부하 증가

### slowapi 설정

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

# IP 주소 기반 Rate Limiting
limiter = Limiter(key_func=get_remote_address)
```

**`get_remote_address` 함수**:
- `X-Forwarded-For` 또는 `X-Real-IP` 헤더에서 실제 클라이언트 IP 추출
- 프록시/로드밸런서 환경 대응

---

## 계층 간 상호작용

### 독립 동작 원칙

두 계층은 **완전히 독립적**으로 동작합니다:

1. **Layer 1 통과** → Layer 2 검사 시작
2. **Layer 1 실패** → 즉시 HTTP 429 응답, Layer 2 도달 불가
3. **Layer 1 통과 + Layer 2 실패** → HTTP 429 응답

### 실제 동작 예시

#### 예시 1: `/chat/stream` 요청 (두 계층 모두 적용)

```
클라이언트 → Layer 1 (30/분 체크) → Layer 2 (100/15분 체크) → 엔드포인트 처리
```

| 시나리오 | Layer 1 (30/분) | Layer 2 (100/15분) | 결과 |
|---------|----------------|-------------------|------|
| 1분에 25회 요청 | ✅ 통과 | ✅ 통과 | ✅ 성공 |
| 1분에 35회 요청 | ❌ **실패** | (도달 불가) | ❌ 429 에러 |
| 15분에 95회 요청 (분산) | ✅ 통과 | ✅ 통과 | ✅ 성공 |
| 15분에 105회 요청 (분산) | ✅ 통과 | ❌ **실패** | ❌ 429 에러 |

#### 예시 2: `/chat` 요청 (Layer 1만 적용)

```
클라이언트 → Layer 1 (30/분 체크) → 엔드포인트 처리
```

Layer 2 (slowapi)는 `/chat/stream`에만 적용되므로 검사하지 않습니다.

### 더 엄격한 제한이 적용됨

실제로는 **더 짧은 시간 내에 더 많은 요청**을 막는 쪽이 우선 작동합니다:

- **단기 폭주 방지**: Layer 1 (30/분) - 1분 내 대량 요청 차단
- **장기 과용 방지**: Layer 2 (100/15분) - 장시간 과도한 사용 차단

---

## 응답 형식

### HTTP 429 Too Many Requests

두 계층 모두 제한을 초과하면 **HTTP 429** 응답을 반환합니다.

#### Layer 1 (글로벌 미들웨어) 응답

```json
{
  "error": "Too Many Requests",
  "message": "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
  "limit_type": "ip",          // "ip" 또는 "session"
  "retry_after": 60            // 60초 후 재시도
}
```

**응답 헤더**:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1735660800  # Unix timestamp
```

#### Layer 2 (slowapi) 응답

```json
{
  "error": "Rate limit exceeded: 100 per 15 minutes"
}
```

**응답 헤더**:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 900  # 15분 = 900초
```

### 정상 요청 응답 헤더

Layer 1은 모든 정상 응답에 Rate Limit 정보를 헤더로 추가합니다:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 30         # 제한값
X-RateLimit-Remaining: 25     # 남은 요청 수
X-RateLimit-Type: ip          # 제한 타입 ("ip" 또는 "session")
```

---

## 설정 변경 방법

### Layer 1: 글로벌 미들웨어 설정

**파일**: `app/middleware/rate_limiter.py`

```python
class RateLimiter:
    def __init__(
        self,
        ip_limit: int = 30,           # ← 여기를 수정
        session_limit: int = 10,      # ← 여기를 수정
        window_seconds: int = 60,     # ← 여기를 수정
    ):
        ...
```

**변경 예시**:
```python
# IP 제한을 50/분으로 증가
ip_limit: int = 50

# Session 제한을 20/분으로 증가
session_limit: int = 20

# 시간 윈도우를 2분으로 변경
window_seconds: int = 120
```

**제외 경로 추가**:
```python
class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, rate_limiter: RateLimiter, excluded_paths: list[str] | None = None):
        super().__init__(app)
        self.rate_limiter = rate_limiter

        # 여기에 제외 경로 추가
        self.excluded_paths = excluded_paths or [
            "/health",
            "/api/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/metrics",  # ← 새로운 경로 추가
        ]
```

### Layer 2: slowapi 설정

**파일**: `app/api/routers/chat_router.py`

```python
@router.post("/chat/stream")
@limiter.limit("100/15minutes")  # ← 여기를 수정
async def chat_stream(request: Request, chat_request: StreamChatRequest):
    ...
```

**변경 예시**:
```python
# 15분에 200개로 증가
@limiter.limit("200/15minutes")

# 10분에 50개로 감소
@limiter.limit("50/10minutes")

# 1시간에 500개로 변경
@limiter.limit("500/hour")
```

**다른 엔드포인트에 적용**:
```python
@router.post("/chat")
@limiter.limit("200/hour")  # /chat 엔드포인트에도 추가 제한
async def chat(request: Request, chat_request: ChatRequest):
    ...
```

### 설정 변경 후 재시작

```bash
# 개발 환경 (자동 리로드)
make dev-reload

# 프로덕션 환경 (수동 재시작)
docker-compose restart api
```

---

## 모니터링

### 로그에서 Rate Limit 이벤트 확인

#### Layer 1 로그

**제한 초과 시**:
```log
WARNING  Rate Limit 초과 (IP): ip=203.0.113.42, count=31/30
WARNING  Rate Limit 거부: path=/api/chat, ip=203.0.113.42, session_id=abc-123, type=ip
```

**메모리 보호 발동**:
```log
INFO  🛡️ 메모리 보호: 오래된 IP 제거 (총 9999개)
INFO  🛡️ 메모리 보호: 오래된 세션 제거 (총 49999개)
```

**백그라운드 정리**:
```log
INFO  🔄 Background cleanup task started: interval=86400s, grace_period=60s
INFO  🧹 Starting periodic memory cleanup...
INFO  ✅ Cleanup completed: IPs 5000→3000 (-2000), Sessions 30000→20000 (-10000)
```

#### Layer 2 로그

slowapi는 별도 로그를 남기지 않으므로, 애플리케이션 로그에서 확인합니다:

```log
ERROR  스트리밍 에러: Rate limit exceeded: 100 per 15 minutes
```

### Rate Limiter 통계 확인

**API 엔드포인트** (관리자 전용):
```bash
GET /api/admin/rate-limit/stats
```

**응답 예시**:
```json
{
  "active_ips": 1234,
  "active_sessions": 5678,
  "total_active": 6912
}
```

### 실시간 모니터링 스크립트

```python
# scripts/monitor_rate_limit.py
import asyncio
from app.middleware.rate_limiter import rate_limiter

async def monitor():
    while True:
        stats = await rate_limiter.get_stats()
        print(f"Active IPs: {stats['active_ips']}, Sessions: {stats['active_sessions']}")
        await asyncio.sleep(10)

asyncio.run(monitor())
```

---

## 요약

### 핵심 포인트

1. **이중 계층 독립 동작**: 두 계층은 독립적으로 동작하며, 둘 다 통과해야 요청 처리
2. **Layer 1 (글로벌)**: 모든 엔드포인트에 IP(30/분) + Session(10/분) 제한
3. **Layer 2 (slowapi)**: `/chat/stream` 엔드포인트에만 100/15분 추가 제한
4. **메모리 보호**: 최대 1만 IP + 5만 세션 추적, LRU 방식 제거
5. **백그라운드 정리**: 24시간 주기로 오래된 엔트리 자동 제거

### 설정 파일 위치 빠른 참조

| 계층 | 파일 경로 | 수정 대상 |
|------|----------|----------|
| **Layer 1** | `app/middleware/rate_limiter.py` | `RateLimiter.__init__()` |
| **Layer 2** | `app/api/routers/chat_router.py` | `@limiter.limit()` 데코레이터 |

### 문제 해결

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| 1분에 25회 요청인데 429 에러 | Layer 1 IP 제한 (30/분) | `ip_limit` 증가 |
| 15분에 95회 요청인데 429 에러 | Layer 2 제한 (100/15분) | `@limiter.limit()` 값 증가 |
| `/health` 엔드포인트도 429 에러 | 제외 경로 설정 누락 | `excluded_paths`에 추가 |
| 메모리 사용량 계속 증가 | 백그라운드 정리 미작동 | `rate_limiter.start_cleanup_task()` 호출 확인 |
