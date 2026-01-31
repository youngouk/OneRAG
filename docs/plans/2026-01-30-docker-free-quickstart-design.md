# Docker-Free 로컬 퀵스타트 설계 문서

**작성일**: 2026-01-30
**상태**: 설계 완료, 구현 대기

## 목표

비개발자도 Docker 없이 터미널 명령어 3줄로 RAG 시스템을 체험할 수 있는 로컬 퀵스타트 구축.

## 배경

현재 퀵스타트(`make quickstart`)는 Docker Desktop이 필수입니다. Weaviate 벡터 DB와 API 서버가 모두 Docker 컨테이너로 실행됩니다. 비개발자에게 Docker 설치는 높은 진입장벽이므로, Python만으로 동작하는 대안 경로가 필요합니다.

## 구현 범위

2개 Phase로 나눠 순차 진행합니다.

---

## Phase 1: 메인 시스템 독립 BM25 엔진

### 문제

현재 6종 벡터 DB 중 3종(ChromaDB, pgvector, MongoDB)은 BM25 키워드 검색을 지원하지 않습니다. BM25 실행 자체가 Weaviate/Pinecone/Qdrant 서버에 위임되어 있기 때문입니다.

기존 `app/modules/core/retrieval/bm25/` 모듈은 **전처리**(동의어 확장, 불용어 제거, 합성어 보호)만 담당하고, **BM25 검색 실행**은 벡터 DB 서버가 수행합니다.

### 해결

Python 기반 독립 BM25 실행 엔진을 추가하여, 벡터 DB가 BM25를 지원하지 않더라도 하이브리드 검색이 가능하게 합니다.

### 아키텍처

```
app/modules/core/retrieval/
├── bm25/                         # 기존 (전처리)
│   ├── stopwords.py              # 불용어 필터 (재사용)
│   ├── user_dictionary.py        # 합성어 보호 (재사용)
│   └── synonym_manager.py        # 동의어 관리 (재사용)
│
├── bm25_engine/                  # 신규 (BM25 실행 엔진)
│   ├── __init__.py
│   ├── tokenizer.py              # Kiwi 기반 한국어 토크나이저
│   ├── index.py                  # BM25 인덱스 (rank-bm25 래핑)
│   └── hybrid_merger.py          # RRF 기반 하이브리드 결과 병합
│
└── retrievers/
    ├── chroma_retriever.py       # 수정: 하이브리드 검색 지원 추가
    ├── pgvector_retriever.py     # 수정: 하이브리드 검색 지원 추가
    ├── mongodb_retriever.py      # 수정: 하이브리드 검색 지원 추가
    └── factory.py                # 수정: hybrid_support=True 업데이트
```

### 신규 모듈 설명

#### `bm25_engine/tokenizer.py`
- Kiwi 한국어 형태소 분석기를 래핑
- 문서/쿼리를 형태소 토큰으로 분리
- 기존 BM25 전처리 모듈(동의어/불용어/합성어)과 연동

#### `bm25_engine/index.py`
- `rank-bm25` 라이브러리의 `BM25Okapi` 래핑
- 문서 추가/삭제 시 인덱스 자동 갱신
- 쿼리 토큰으로 BM25 점수 계산

#### `bm25_engine/hybrid_merger.py`
- Dense 벡터 검색 결과 + BM25 키워드 검색 결과를 RRF(Reciprocal Rank Fusion)로 병합
- alpha 파라미터로 가중치 조절 (Weaviate와 동일한 인터페이스)

### 검색 흐름 (ChromaDB 하이브리드)

```
[쿼리 입력]
    ↓
[기존 BM25 전처리] (동의어/불용어/합성어)
    ↓
┌──────────────────┬───────────────────┐
│ ChromaDB         │ BM25Engine        │
│ Dense 벡터 검색   │ Kiwi 토큰화       │
│                  │ rank-bm25 스코어링  │
└────────┬─────────┴────────┬──────────┘
         └─── RRF 병합 ────┘
              ↓
         [결과 반환]
```

### 새 의존성

| 패키지 | 용도 | 설치 방식 |
|--------|------|----------|
| `kiwipiepy` | 한국어 형태소 분석 | 선택적 의존성 |
| `rank-bm25` | BM25 알고리즘 실행 | 선택적 의존성 |

### 기존 코드 영향 범위

- `RetrieverFactory`: ChromaDB, pgvector, MongoDB의 `hybrid_support` 플래그를 `True`로 변경
- `ChromaRetriever`: `bm25_engine`을 선택적으로 주입받아 하이브리드 검색 수행
- `PgVectorRetriever`, `MongoDBAtlasRetriever`: 동일하게 확장
- 기존 Weaviate/Pinecone/Qdrant 경로는 변경 없음

---

## Phase 2: Docker-Free 로컬 퀵스타트

### 사용자 경험

```bash
# Step 1: 클론 및 설치
git clone https://github.com/youngouk/OneRAG.git
cd OneRAG && uv sync

# Step 2: 환경 설정
cp quickstart/.env.quickstart .env
# .env에서 GOOGLE_API_KEY만 설정 (Gemini 무료)

# Step 3: 실행
make quickstart-local
```

### 네이밍

| 항목 | 기존 | 신규 |
|------|------|------|
| 명령어 | `make quickstart` | `make quickstart-local` |
| 설명 | Docker 퀵스타트 | Non-Dev 로컬 퀵스타트 |
| 벡터 DB | Weaviate (Docker) | ChromaDB (파일 기반) |
| BM25 | Weaviate 내장 | BM25Engine (Python) |

### 파일 구조

```
quickstart_local/
├── run.py            # 원클릭 실행 스크립트 (셋업 + 서버 + CLI)
├── chat.py           # Rich CLI 대화형 인터페이스
└── README.md         # Non-Dev 퀵스타트 가이드
```

### 실행 흐름 (`make quickstart-local`)

```
[1] 의존성 확인 (chromadb, kiwipiepy, rank-bm25, rich)
[2] 로컬 임베딩 모델 다운로드 (~1.2GB, 최초 1회)
[3] 샘플 데이터 → ChromaDB 적재 + BM25 인덱스 구축
[4] FastAPI 서버 로컬 실행
[5] Rich CLI 챗봇 시작
```

### RAG 대상 문서

기존 `quickstart/sample_data.json` 재사용 (OneRAG 시스템 설명 FAQ 25개 문서).

### 환경 설정

```env
VECTOR_DB_PROVIDER=chroma        # ChromaDB (Docker 불필요)
EMBEDDINGS_PROVIDER=local        # 로컬 임베딩 모델
LLM_PROVIDER=google              # Gemini 무료 티어
```

### Rich CLI 디자인

```
╭─────────────────────────────────────────╮
│  🤖 OneRAG 로컬 챗봇                    │
│  하이브리드 검색 (벡터 + 한글 키워드)      │
│  종료: quit | 도움: help                 │
╰─────────────────────────────────────────╯

❓ 질문: RAG_Standard 어떻게 설치해?

  🔍 검색 중...
  ┌─ 검색 결과 ─────────────────────────┐
  │ 📄 [벡터] 설치 가이드 (유사도: 0.92)  │
  │ 📄 [키워드] Quickstart 문서 (BM25: 8.3)│
  │ 📄 [벡터] 환경설정 문서 (유사도: 0.87)  │
  └─────────────────────────────────────┘

  💬 답변:
  RAG_Standard 설치는 3단계로 진행합니다:
  1. git clone으로 프로젝트 다운로드
  2. uv sync로 의존성 설치
  3. make quickstart로 실행

❓ 질문: _
```

### 전제 조건 비교

| 항목 | 기존 (Docker) | 신규 (로컬) |
|------|--------------|-----------|
| Docker Desktop | ✅ 필수 | ❌ 불필요 |
| Python 3.11+ | ❌ 불필요 | ✅ 필수 |
| uv | ❌ 불필요 | ✅ 필수 |
| Gemini API 키 | ✅ 필수 | ✅ 필수 |
| 디스크 공간 | ~2GB (Docker) | ~1.5GB (임베딩 모델) |

---

## 기술적 결정 사항

### 1. ChromaDB 선택 이유
- pip 설치만으로 사용 가능 (Docker 불필요)
- 파일 기반이라 영속화 자동 지원
- 프로젝트에서 이미 Multi Vector DB로 지원 중

### 2. Kiwi 선택 이유
- pip 설치만으로 사용 가능 (C 컴파일러 불필요, mecab-ko와 차별점)
- 한국어 형태소 분석 품질 우수
- Windows/Mac/Linux 모두 지원

### 3. CLI 메인 선택 이유
- 프론트엔드 연결 시 Node.js 추가 설치 필요 (비개발자에게 부담)
- Streamlit은 추가 의존성
- CLI가 가장 진입장벽 낮음 (복붙 한 줄)
- Rich 라이브러리로 시각적 품질 확보
- Swagger UI는 FastAPI 내장이므로 개발자용 보조 인터페이스로 자동 제공

### 4. uv 전용 (pip 미지원) 이유
- 프로젝트가 pyproject.toml + uv.lock 기반
- pip 지원 시 별도 requirements.txt 관리 부담
- uv 설치 자체가 한 줄 명령어로 간단

---

## 구현 순서

1. **Phase 1-1**: `bm25_engine/tokenizer.py` — Kiwi 토크나이저 래핑
2. **Phase 1-2**: `bm25_engine/index.py` — BM25 인덱스 관리
3. **Phase 1-3**: `bm25_engine/hybrid_merger.py` — RRF 병합 로직
4. **Phase 1-4**: `ChromaRetriever` 하이브리드 검색 확장
5. **Phase 1-5**: `RetrieverFactory` 업데이트
6. **Phase 1-6**: 테스트 작성 (단위 + 통합)
7. **Phase 2-1**: `quickstart_local/run.py` — 셋업 + 실행 스크립트
8. **Phase 2-2**: `quickstart_local/chat.py` — Rich CLI 인터페이스
9. **Phase 2-3**: Makefile `quickstart-local` 타겟 추가
10. **Phase 2-4**: README 문서 작성

---

## 성공 기준

- [ ] ChromaDB에서 하이브리드 검색(벡터 + 한글 키워드)이 동작
- [ ] `make quickstart-local`로 Docker 없이 전체 RAG 파이프라인 실행
- [ ] 비개발자가 README만 보고 3분 내에 첫 질문/답변 완료
- [ ] 기존 Docker 퀵스타트(`make quickstart`)에 영향 없음
- [ ] 기존 테스트 1,707개 모두 통과
