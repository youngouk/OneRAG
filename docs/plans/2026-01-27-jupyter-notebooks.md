# Jupyter 노트북 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Google Colab 호환 Jupyter 노트북 3종을 생성하여 초보자가 5분 만에 RAG 시스템을 체험할 수 있게 함

**Architecture:** 각 노트북은 독립 실행 가능하며, Colab 환경에서 원클릭 실행을 지원. 셀 단위 실행으로 단계별 학습이 가능하도록 구성.

**Tech Stack:** Jupyter Notebook, Python 3.11+, requests, pandas, matplotlib

---

## 사전 요구사항

- RAG_Standard API 서버 실행 중 (`make quickstart`)
- Python 의존성: `requests`, `pandas`, `matplotlib` (노트북 내 자동 설치)

---

## Task 1: 노트북 디렉토리 구조 생성

**Files:**
- Create: `notebooks/README.md`

**Step 1: 디렉토리 및 README 생성**

```bash
mkdir -p notebooks
```

```markdown
# RAG_Standard Jupyter Notebooks

Google Colab 또는 로컬 Jupyter에서 RAG 시스템을 체험할 수 있는 노트북 모음입니다.

## 노트북 목록

| 노트북 | 설명 | Colab |
|--------|------|-------|
| [01_quickstart.ipynb](01_quickstart.ipynb) | 5분 만에 RAG 체험 | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/youngouk/RAG_Standard/blob/main/notebooks/01_quickstart.ipynb) |
| [02_api_exploration.ipynb](02_api_exploration.ipynb) | REST API 완전 가이드 | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/youngouk/RAG_Standard/blob/main/notebooks/02_api_exploration.ipynb) |
| [03_evaluation_demo.ipynb](03_evaluation_demo.ipynb) | 평가 시스템 탐방 | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/youngouk/RAG_Standard/blob/main/notebooks/03_evaluation_demo.ipynb) |

## 실행 방법

### 로컬 실행
```bash
# 1. RAG 서버 시작
make quickstart

# 2. Jupyter 실행
uv run jupyter notebook notebooks/
```

### Google Colab 실행
1. 위 표의 "Open In Colab" 버튼 클릭
2. ngrok 또는 공개 API URL 설정 (Colab에서 localhost 접근 불가)

## 요구사항

- RAG_Standard API 서버 실행 중 (`http://localhost:8000`)
- Python 3.11+
```

**Step 2: 변경사항 커밋**

```bash
git add notebooks/README.md
git commit -m "문서: notebooks 디렉토리 및 README 생성"
```

---

## Task 2: 01_quickstart.ipynb - 5분 만에 RAG 체험

**Files:**
- Create: `notebooks/01_quickstart.ipynb`
- Test: 노트북 셀 실행 검증

**Step 1: 노트북 파일 생성**

노트북 구조 (셀 순서):

### Cell 1 (Markdown): 제목 및 소개
```markdown
# 🚀 RAG_Standard 5분 퀵스타트

이 노트북에서는 RAG(Retrieval-Augmented Generation) 시스템을 5분 만에 체험합니다.

## 학습 내용
1. RAG 시스템에 질문하기
2. 검색된 문서 확인하기
3. 스트리밍 응답 체험하기

## 사전 요구사항
- RAG_Standard 서버 실행 중 (`make quickstart`)
- 기본 URL: `http://localhost:8000`
```

### Cell 2 (Code): 환경 설정
```python
# 환경 설정
import requests
import json

# API 서버 URL 설정
# Colab 사용 시 ngrok URL로 변경하세요
BASE_URL = "http://localhost:8000"

# 연결 테스트
try:
    response = requests.get(f"{BASE_URL}/ping", timeout=5)
    if response.status_code == 200:
        print("✅ RAG 서버 연결 성공!")
        print(f"   응답: {response.json()}")
    else:
        print(f"⚠️ 서버 응답 코드: {response.status_code}")
except requests.exceptions.ConnectionError:
    print("❌ 서버에 연결할 수 없습니다.")
    print("   'make quickstart' 명령으로 서버를 먼저 시작하세요.")
```

### Cell 3 (Markdown): 첫 번째 질문
```markdown
## 1️⃣ 첫 번째 질문하기

RAG 시스템에 질문을 보내봅시다. 시스템은 관련 문서를 검색하고 AI가 답변을 생성합니다.
```

### Cell 4 (Code): 채팅 API 호출
```python
# 채팅 API 호출
question = "RAG_Standard 어떻게 설치해?"

response = requests.post(
    f"{BASE_URL}/chat",
    json={"message": question},
    timeout=30
)

if response.status_code == 200:
    result = response.json()
    print(f"📝 질문: {question}")
    print(f"\n💬 답변:\n{result['answer']}")
    print(f"\n⏱️ 처리 시간: {result.get('processing_time', 'N/A')}초")
else:
    print(f"❌ 오류: {response.status_code}")
    print(response.text)
```

### Cell 5 (Markdown): 검색 결과 확인
```markdown
## 2️⃣ 검색된 문서 확인

RAG는 질문과 관련된 문서를 먼저 검색합니다. 어떤 문서가 검색되었는지 확인해봅시다.
```

### Cell 6 (Code): 소스 문서 표시
```python
# 검색된 소스 문서 표시
if response.status_code == 200:
    sources = result.get('sources', [])
    print(f"📚 검색된 문서: {len(sources)}개\n")

    for i, source in enumerate(sources, 1):
        print(f"--- 문서 {i} ---")
        print(f"📄 출처: {source.get('document', 'N/A')}")
        print(f"📊 관련도: {source.get('relevance', 0):.1%}")
        print(f"📝 미리보기: {source.get('content_preview', 'N/A')[:100]}...")
        print()
else:
    print("이전 셀을 먼저 실행하세요.")
```

### Cell 7 (Markdown): 다양한 질문
```markdown
## 3️⃣ 다양한 질문 시도

아래 예시 질문들을 시도해보세요:
- "채팅 API 사용법 알려줘"
- "환경변수 뭐 설정해야 돼?"
- "DI 컨테이너가 뭐야?"
- "테스트 어떻게 실행해?"
```

### Cell 8 (Code): 사용자 질문
```python
# 직접 질문해보세요!
your_question = "채팅 API 사용법 알려줘"  # 여기를 수정하세요

response = requests.post(
    f"{BASE_URL}/chat",
    json={"message": your_question},
    timeout=30
)

if response.status_code == 200:
    result = response.json()
    print(f"📝 질문: {your_question}")
    print(f"\n💬 답변:\n{result['answer']}")
else:
    print(f"❌ 오류: {response.text}")
```

### Cell 9 (Markdown): 스트리밍 응답
```markdown
## 4️⃣ 스트리밍 응답 체험

긴 답변도 실시간으로 받아볼 수 있습니다. SSE(Server-Sent Events)를 사용합니다.
```

### Cell 10 (Code): 스트리밍 채팅
```python
# 스트리밍 채팅 (SSE)
import sseclient  # pip install sseclient-py

question = "RAG 시스템의 장점을 자세히 설명해줘"

try:
    response = requests.post(
        f"{BASE_URL}/chat/stream",
        json={"message": question},
        stream=True,
        timeout=60
    )

    print(f"📝 질문: {question}\n")
    print("💬 답변 (실시간):")

    client = sseclient.SSEClient(response)
    for event in client.events():
        data = json.loads(event.data)
        if event.event == "chunk":
            print(data.get("data", ""), end="", flush=True)
        elif event.event == "done":
            print(f"\n\n✅ 완료! (총 {data.get('total_chunks', 0)}개 청크)")
            break
        elif event.event == "error":
            print(f"\n❌ 오류: {data.get('message', 'Unknown error')}")
            break

except ImportError:
    print("sseclient-py 패키지가 필요합니다.")
    print("설치: pip install sseclient-py")
except Exception as e:
    print(f"❌ 오류: {e}")
```

### Cell 11 (Markdown): 다음 단계
```markdown
## 🎉 축하합니다!

RAG 시스템의 기본 사용법을 익혔습니다.

### 다음 단계
- **[02_api_exploration.ipynb](02_api_exploration.ipynb)**: REST API 완전 가이드
- **[03_evaluation_demo.ipynb](03_evaluation_demo.ipynb)**: 평가 시스템 탐방

### 더 알아보기
- [API 레퍼런스](../docs/API_REFERENCE.md)
- [스트리밍 가이드](../docs/streaming-api-guide.md)
- [평가 시스템](../docs/EVALUATION_SYSTEM.md)
```

**Step 2: 노트북 실행 테스트**

```bash
# 노트북 유효성 검사 (JSON 형식 확인)
python -c "import json; json.load(open('notebooks/01_quickstart.ipynb'))"
```

**Step 3: 변경사항 커밋**

```bash
git add notebooks/01_quickstart.ipynb
git commit -m "기능: 01_quickstart.ipynb 노트북 추가 - 5분 RAG 체험"
```

---

## Task 3: 02_api_exploration.ipynb - REST API 완전 가이드

**Files:**
- Create: `notebooks/02_api_exploration.ipynb`

**Step 1: 노트북 파일 생성**

노트북 구조 (셀 순서):

### Cell 1 (Markdown): 제목
```markdown
# 🔌 RAG_Standard REST API 완전 가이드

이 노트북에서는 RAG_Standard의 모든 REST API를 탐색합니다.

## 학습 내용
1. 헬스 체크 및 시스템 상태
2. 채팅 API (기본, 스트리밍, WebSocket)
3. 세션 관리
4. 피드백 및 평가
5. 관리자 API

## API 문서
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
```

### Cell 2 (Code): 설정 및 헬퍼 함수
```python
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"
ADMIN_API_KEY = "your-api-key"  # .env의 FASTAPI_AUTH_KEY 값

def pretty_print(data):
    """JSON 데이터를 보기 좋게 출력"""
    print(json.dumps(data, indent=2, ensure_ascii=False))

def api_call(method, endpoint, **kwargs):
    """API 호출 헬퍼"""
    url = f"{BASE_URL}{endpoint}"
    response = requests.request(method, url, timeout=30, **kwargs)
    print(f"{method} {endpoint} → {response.status_code}")
    return response

# 연결 확인
response = api_call("GET", "/ping")
pretty_print(response.json())
```

### Cell 3 (Markdown): 헬스 체크 API
```markdown
## 1️⃣ 헬스 체크 API

시스템 상태를 확인하는 엔드포인트들입니다.
```

### Cell 4 (Code): 헬스 체크
```python
# GET /health - 기본 헬스 체크
response = api_call("GET", "/health")
pretty_print(response.json())
```

### Cell 5 (Code): 시스템 통계
```python
# GET /stats - 시스템 리소스 통계
response = api_call("GET", "/stats")
data = response.json()

print(f"⏱️ 가동 시간: {data.get('uptime_human', 'N/A')}")
print(f"💻 CPU 사용률: {data.get('cpu_percent', 0):.1f}%")
print(f"🧠 메모리 사용률: {data.get('memory_usage', {}).get('percentage', 0):.1f}%")
```

### Cell 6 (Code): 캐시 통계
```python
# GET /cache-stats - 리랭킹 캐시 통계
response = api_call("GET", "/cache-stats")
data = response.json()

print(f"📊 캐시 히트율: {data.get('hit_rate', 0):.1%}")
print(f"💾 캐시 크기: {data.get('cache_size', 0)}/{data.get('max_size', 0)}")
print(f"⏱️ 절약 시간: {data.get('saved_time_ms', 0):.0f}ms")
```

### Cell 7 (Markdown): 채팅 API
```markdown
## 2️⃣ 채팅 API

RAG 기반 채팅의 핵심 API입니다.
```

### Cell 8 (Code): 기본 채팅
```python
# POST /chat - 기본 채팅
response = api_call("POST", "/chat", json={
    "message": "RAG 시스템의 장점은?",
    "session_id": None,  # 새 세션 생성
    "stream": False,
    "use_agent": False
})

data = response.json()
print(f"\n💬 답변:\n{data.get('answer', '')[:500]}...")
print(f"\n📊 메타데이터:")
print(f"  - 세션 ID: {data.get('session_id')}")
print(f"  - 처리 시간: {data.get('processing_time', 0):.2f}초")
print(f"  - 토큰 사용: {data.get('tokens_used', 0)}")

# 세션 ID 저장
SESSION_ID = data.get('session_id')
```

### Cell 9 (Code): 채팅 통계
```python
# GET /chat/stats - 채팅 통계
response = api_call("GET", "/chat/stats")
pretty_print(response.json())
```

### Cell 10 (Markdown): 세션 관리
```markdown
## 3️⃣ 세션 관리

대화 세션을 관리하는 API입니다.
```

### Cell 11 (Code): 세션 생성
```python
# POST /chat/session - 새 세션 생성
response = api_call("POST", "/chat/session", json={
    "metadata": {"purpose": "notebook_demo"}
})
new_session = response.json()
pretty_print(new_session)
```

### Cell 12 (Code): 세션 정보
```python
# GET /chat/session/{id}/info - 세션 상세 정보
if SESSION_ID:
    response = api_call("GET", f"/chat/session/{SESSION_ID}/info")
    pretty_print(response.json())
else:
    print("먼저 채팅을 실행하여 세션을 생성하세요.")
```

### Cell 13 (Code): 채팅 히스토리
```python
# GET /chat/history/{session_id} - 대화 내역 조회
if SESSION_ID:
    response = api_call("GET", f"/chat/history/{SESSION_ID}", params={
        "limit": 10,
        "offset": 0
    })
    data = response.json()

    print(f"📜 대화 내역 ({data.get('total_messages', 0)}개 메시지)\n")
    for msg in data.get('messages', []):
        role = "👤" if msg['role'] == 'user' else "🤖"
        print(f"{role} {msg['content'][:100]}...")
else:
    print("먼저 채팅을 실행하여 세션을 생성하세요.")
```

### Cell 14 (Markdown): 피드백 API
```markdown
## 4️⃣ 피드백 API

답변 품질에 대한 피드백을 제출합니다.
```

### Cell 15 (Code): 피드백 제출
```python
# POST /chat/feedback - 피드백 제출
if SESSION_ID:
    response = api_call("POST", "/chat/feedback", json={
        "session_id": SESSION_ID,
        "message_id": "demo-message",
        "rating": 1,  # 1: 좋아요, -1: 싫어요
        "comment": "노트북 데모에서 테스트",
        "query": "테스트 질문",
        "response": "테스트 응답"
    })
    pretty_print(response.json())
else:
    print("먼저 채팅을 실행하여 세션을 생성하세요.")
```

### Cell 16 (Markdown): 관리자 API
```markdown
## 5️⃣ 관리자 API

⚠️ `X-API-Key` 헤더 인증이 필요합니다.
```

### Cell 17 (Code): 관리자 API 헬퍼
```python
def admin_api(method, endpoint, **kwargs):
    """관리자 API 호출 (인증 헤더 포함)"""
    headers = kwargs.pop('headers', {})
    headers['X-API-Key'] = ADMIN_API_KEY
    return api_call(method, endpoint, headers=headers, **kwargs)
```

### Cell 18 (Code): 시스템 상태
```python
# GET /api/admin/status - 시스템 전체 상태
response = admin_api("GET", "/api/admin/status")

if response.status_code == 200:
    data = response.json()
    print(f"🟢 상태: {data.get('status')}")
    print(f"⏱️ 가동 시간: {data.get('uptime', 0):.0f}초")
    print(f"📄 총 문서: {data.get('total_documents', 0)}개")
    print(f"🔢 벡터 수: {data.get('vector_count', 0)}개")
elif response.status_code == 401:
    print("❌ 인증 실패: ADMIN_API_KEY를 확인하세요")
else:
    print(f"❌ 오류: {response.status_code}")
```

### Cell 19 (Code): 실시간 메트릭
```python
# GET /api/admin/realtime-metrics - 실시간 모니터링
response = admin_api("GET", "/api/admin/realtime-metrics")

if response.status_code == 200:
    data = response.json()
    print(f"📊 분당 요청: {data.get('chat_requests_per_minute', 0)}")
    print(f"⏱️ 평균 응답시간: {data.get('average_response_time', 0):.2f}초")
    print(f"🔴 에러율: {data.get('error_rate', 0):.2%}")
```

### Cell 20 (Markdown): 다음 단계
```markdown
## 🎉 완료!

REST API의 주요 기능을 모두 탐색했습니다.

### 추가 리소스
- **Swagger UI**: http://localhost:8000/docs (모든 API 대화형 테스트)
- **[API 레퍼런스](../docs/API_REFERENCE.md)**: 전체 엔드포인트 상세 설명

### 다음 노트북
- **[03_evaluation_demo.ipynb](03_evaluation_demo.ipynb)**: 평가 시스템 탐방
```

**Step 2: 변경사항 커밋**

```bash
git add notebooks/02_api_exploration.ipynb
git commit -m "기능: 02_api_exploration.ipynb 노트북 추가 - REST API 가이드"
```

---

## Task 4: 03_evaluation_demo.ipynb - 평가 시스템 탐방

**Files:**
- Create: `notebooks/03_evaluation_demo.ipynb`

**Step 1: 노트북 파일 생성**

노트북 구조 (셀 순서):

### Cell 1 (Markdown): 제목
```markdown
# 📊 RAG_Standard 평가 시스템 탐방

이 노트북에서는 RAG 시스템의 답변 품질을 평가하는 방법을 배웁니다.

## 학습 내용
1. 평가 시스템 개요
2. 실시간 품질 점수 확인
3. 피드백을 통한 품질 개선
4. 배치 평가 실행 (관리자)

## 평가 지표
- **Faithfulness (충실도)**: 답변이 검색된 문서에 근거하는가?
- **Relevance (관련성)**: 답변이 질문 의도에 부합하는가?
```

### Cell 2 (Code): 설정
```python
import requests
import json
import pandas as pd
import matplotlib.pyplot as plt

BASE_URL = "http://localhost:8000"
ADMIN_API_KEY = "your-api-key"

def api_call(method, endpoint, admin=False, **kwargs):
    url = f"{BASE_URL}{endpoint}"
    headers = kwargs.pop('headers', {})
    if admin:
        headers['X-API-Key'] = ADMIN_API_KEY
    return requests.request(method, url, headers=headers, timeout=30, **kwargs)

# 한글 폰트 설정 (matplotlib)
plt.rcParams['font.family'] = 'AppleGothic'  # Mac
# plt.rcParams['font.family'] = 'Malgun Gothic'  # Windows
plt.rcParams['axes.unicode_minus'] = False
```

### Cell 3 (Markdown): 품질 점수 확인
```markdown
## 1️⃣ 실시간 품질 점수 확인

RAG 시스템은 Self-RAG 기능으로 답변 생성 시 품질 점수를 함께 반환합니다.
```

### Cell 4 (Code): 품질 점수 포함 채팅
```python
# 채팅 요청 및 품질 점수 확인
questions = [
    "RAG_Standard 설치 방법은?",
    "하이브리드 검색이 뭐야?",
    "DI 컨테이너의 장점은?",
]

results = []
for q in questions:
    response = api_call("POST", "/chat", json={"message": q})
    if response.status_code == 200:
        data = response.json()
        quality = data.get('metadata', {}).get('quality', {})
        results.append({
            '질문': q[:20] + '...',
            '품질 점수': quality.get('score', 0),
            '신뢰도': quality.get('confidence', 'N/A'),
            'Self-RAG': '✅' if quality.get('self_rag_applied') else '❌'
        })

df = pd.DataFrame(results)
print(df.to_string(index=False))
```

### Cell 5 (Code): 품질 점수 시각화
```python
# 품질 점수 시각화
if results:
    fig, ax = plt.subplots(figsize=(10, 5))

    questions_short = [r['질문'] for r in results]
    scores = [r['품질 점수'] for r in results]

    bars = ax.barh(questions_short, scores, color='steelblue')
    ax.set_xlabel('품질 점수')
    ax.set_title('질문별 답변 품질 점수')
    ax.set_xlim(0, 1)

    # 점수 표시
    for bar, score in zip(bars, scores):
        ax.text(score + 0.02, bar.get_y() + bar.get_height()/2,
                f'{score:.2f}', va='center')

    plt.tight_layout()
    plt.show()
```

### Cell 6 (Markdown): 피드백 시스템
```markdown
## 2️⃣ 피드백을 통한 품질 개선

사용자 피드백은 Golden Dataset 구축에 활용됩니다.

### 피드백 워크플로우
1. 사용자가 답변에 👍/👎 피드백
2. 좋은 피드백은 Golden Dataset 후보로 등록
3. 관리자가 검토하여 정답셋에 추가
4. 정답셋으로 시스템 성능 벤치마크
```

### Cell 7 (Code): 피드백 제출 예시
```python
# 피드백 제출 시뮬레이션
feedback_examples = [
    {"rating": 1, "comment": "정확하고 도움이 됨"},
    {"rating": -1, "comment": "질문과 관련 없는 답변"},
    {"rating": 1, "comment": "상세한 설명 감사"},
]

print("📝 피드백 예시:\n")
for i, fb in enumerate(feedback_examples, 1):
    emoji = "👍" if fb['rating'] == 1 else "👎"
    print(f"{i}. {emoji} {fb['comment']}")

print("\n피드백은 POST /chat/feedback API로 제출합니다.")
```

### Cell 8 (Markdown): 배치 평가
```markdown
## 3️⃣ 배치 평가 (관리자)

⚠️ 관리자 API 키가 필요합니다.

배치 평가는 여러 질문-답변 쌍을 한번에 평가합니다.
```

### Cell 9 (Code): 배치 평가 요청
```python
# 배치 평가 요청 (관리자 전용)
eval_data = {
    "dataset": [
        {
            "query": "RAG_Standard 설치 방법은?",
            "response": "git clone으로 저장소를 클론하고 uv sync로 의존성을 설치합니다.",
            "context": "Quickstart: git clone, uv sync, make quickstart"
        },
        {
            "query": "하이브리드 검색이란?",
            "response": "Dense(의미) 검색과 Sparse(BM25) 검색을 결합한 방식입니다.",
            "context": "Weaviate: Dense + Sparse 하이브리드 검색"
        }
    ],
    "metrics": ["faithfulness", "relevance"]
}

response = api_call("POST", "/api/admin/evaluate", admin=True, json=eval_data)

if response.status_code == 200:
    results = response.json()
    print("📊 배치 평가 결과:\n")
    for i, r in enumerate(results.get('results', []), 1):
        print(f"항목 {i}:")
        print(f"  - Faithfulness: {r.get('faithfulness', 0):.2f}")
        print(f"  - Relevance: {r.get('relevance', 0):.2f}")
        print()
elif response.status_code == 401:
    print("❌ 인증 실패: ADMIN_API_KEY를 확인하세요")
elif response.status_code == 404:
    print("ℹ️ 배치 평가 API가 비활성화되어 있습니다.")
else:
    print(f"❌ 오류: {response.status_code}")
```

### Cell 10 (Markdown): 평가 지표 설명
```markdown
## 📖 평가 지표 상세 설명

### Internal Metrics (자체 지표)
| 지표 | 설명 | 측정 방식 |
|------|------|----------|
| Faithfulness | 답변이 검색된 문서에 근거하는가 | 문장별 출처 확인 |
| Relevance | 답변이 질문 의도에 부합하는가 | 의미 유사도 계산 |

### Ragas Metrics (외부 표준 지표)
| 지표 | 설명 |
|------|------|
| Context Precision | 관련 문서가 상단에 위치하는가 |
| Answer Semantic Similarity | 정답과의 의미적 유사도 |

### 점수 해석
- **0.8 이상**: 우수 (신뢰할 수 있음)
- **0.6 ~ 0.8**: 양호 (대체로 정확)
- **0.6 미만**: 개선 필요 (검증 권장)
```

### Cell 11 (Markdown): 다음 단계
```markdown
## 🎉 완료!

RAG 평가 시스템의 핵심 개념을 익혔습니다.

### 추가 리소스
- **[평가 시스템 문서](../docs/EVALUATION_SYSTEM.md)**: 상세 아키텍처
- **CLI 평가**: `make eval` (로컬에서 배치 평가)

### 실습 과제
1. 다양한 질문으로 품질 점수 비교해보기
2. 피드백 API를 사용해 데이터 수집해보기
3. 품질 점수와 실제 답변 품질 상관관계 분석
```

**Step 2: 변경사항 커밋**

```bash
git add notebooks/03_evaluation_demo.ipynb
git commit -m "기능: 03_evaluation_demo.ipynb 노트북 추가 - 평가 시스템 데모"
```

---

## Task 5: 노트북 테스트 및 검증

**Files:**
- Test: `notebooks/*.ipynb`

**Step 1: 노트북 JSON 유효성 검사**

```bash
# 모든 노트북 JSON 형식 검증
python -c "
import json
import glob

for nb_path in glob.glob('notebooks/*.ipynb'):
    try:
        with open(nb_path) as f:
            json.load(f)
        print(f'✅ {nb_path}')
    except json.JSONDecodeError as e:
        print(f'❌ {nb_path}: {e}')
"
```

Expected: 모든 노트북 ✅

**Step 2: 노트북 셀 개수 확인**

```bash
python -c "
import json
import glob

for nb_path in glob.glob('notebooks/*.ipynb'):
    with open(nb_path) as f:
        nb = json.load(f)
    cells = nb.get('cells', [])
    code_cells = sum(1 for c in cells if c['cell_type'] == 'code')
    md_cells = sum(1 for c in cells if c['cell_type'] == 'markdown')
    print(f'{nb_path}: {len(cells)} cells ({code_cells} code, {md_cells} markdown)')
"
```

**Step 3: README 업데이트 (Colab 배지 확인)**

노트북이 GitHub에 푸시된 후 Colab 배지가 작동하는지 확인.

---

## Task 6: 최종 검증 및 커밋

**Step 1: 전체 테스트 실행**

```bash
make test
```

Expected: 모든 테스트 통과

**Step 2: 린트 검사**

```bash
make lint
```

Expected: 오류 없음

**Step 3: 최종 커밋 및 푸시**

```bash
git add .
git status
git commit -m "기능: Jupyter 노트북 3종 추가 (퀵스타트, API 탐색, 평가 데모)

- notebooks/01_quickstart.ipynb: 5분 만에 RAG 체험
- notebooks/02_api_exploration.ipynb: REST API 완전 가이드
- notebooks/03_evaluation_demo.ipynb: 평가 시스템 탐방
- notebooks/README.md: 노트북 목록 및 실행 가이드

Google Colab 호환, 셀 단위 실행 가능

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git push origin main
```

---

## 검증 체크리스트

- [ ] `notebooks/README.md` 생성됨
- [ ] `notebooks/01_quickstart.ipynb` 유효한 JSON
- [ ] `notebooks/02_api_exploration.ipynb` 유효한 JSON
- [ ] `notebooks/03_evaluation_demo.ipynb` 유효한 JSON
- [ ] 모든 테스트 통과 (`make test`)
- [ ] 린트 통과 (`make lint`)
- [ ] GitHub에 푸시 완료
- [ ] Colab 배지 작동 확인

---

## 예상 결과물

```
notebooks/
├── README.md                    # 노트북 목록 및 가이드
├── 01_quickstart.ipynb          # 5분 RAG 체험 (11셀)
├── 02_api_exploration.ipynb     # REST API 가이드 (20셀)
└── 03_evaluation_demo.ipynb     # 평가 시스템 데모 (11셀)
```

총 소요 시간: 약 3-4시간
