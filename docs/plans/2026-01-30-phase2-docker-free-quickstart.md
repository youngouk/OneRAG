# Phase 2: Docker-Free 로컬 퀵스타트 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Docker 없이 터미널 3줄로 ChromaDB + BM25 하이브리드 검색 RAG 챗봇을 실행하는 로컬 퀵스타트 구축.

**Architecture:** 기존 FastAPI 서버(`main.py`)를 그대로 재사용하되, `VECTOR_DB_PROVIDER=chroma` 환경변수로 ChromaDB 모드를 활성화한다. 새 `quickstart_local/` 디렉토리에 (1) ChromaDB 전용 데이터 로드 스크립트, (2) Rich CLI 챗봇, (3) 원클릭 실행 스크립트를 추가한다. Phase 1에서 구현한 BM25 엔진이 ChromaRetriever에 DI 주입되어 하이브리드 검색이 자동 활성화된다.

**Tech Stack:** ChromaDB (persistent), LocalEmbedder (Qwen3-0.6B), BM25Engine (kiwipiepy + rank-bm25), Rich (CLI), FastAPI (기존 서버)

---

## Task 1: ChromaDB 전용 데이터 로드 스크립트

**Files:**
- Create: `quickstart_local/load_data.py`
- Read: `quickstart/load_sample_data.py` (Weaviate 버전 참고)
- Read: `quickstart/sample_data.json` (동일 데이터 재사용)
- Read: `app/infrastructure/storage/vector/chroma_store.py` (ChromaVectorStore 인터페이스)
- Test: `tests/unit/quickstart_local/test_load_data.py`

**Step 1: Write the failing test**

Create `tests/unit/quickstart_local/__init__.py` (빈 파일) and `tests/unit/quickstart_local/test_load_data.py`:

```python
"""
quickstart_local 데이터 로드 스크립트 단위 테스트

ChromaDB에 샘플 데이터를 올바르게 적재하는지 검증합니다.
"""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


class TestLoadDataHelpers:
    """데이터 로드 헬퍼 함수 테스트"""

    def test_prepare_documents_returns_list(self):
        """
        샘플 데이터를 ChromaDB 형식으로 변환

        Given: sample_data.json의 문서 1개
        When: prepare_documents() 호출
        Then: ChromaDB 호환 형식의 리스트 반환
        """
        from quickstart_local.load_data import prepare_documents

        raw_docs = [
            {
                "id": "faq-001",
                "title": "RAG 시스템이란?",
                "content": "RAG는 검색 증강 생성 기술입니다.",
                "metadata": {"category": "기술 소개", "tags": ["RAG"]},
            }
        ]

        result = prepare_documents(raw_docs)

        assert len(result) == 1
        assert result[0]["id"] == "faq-001"
        assert "RAG 시스템이란?" in result[0]["content"]
        assert "RAG는 검색 증강 생성" in result[0]["content"]
        assert result[0]["metadata"]["category"] == "기술 소개"
        assert result[0]["metadata"]["source"] == "quickstart_sample"

    def test_prepare_documents_merges_title_and_content(self):
        """
        title + content를 합쳐서 content 필드 생성

        Given: title과 content가 별도인 문서
        When: prepare_documents() 호출
        Then: "title\n\ncontent" 형식으로 병합
        """
        from quickstart_local.load_data import prepare_documents

        raw_docs = [
            {
                "id": "test-001",
                "title": "제목",
                "content": "본문 내용",
                "metadata": {"category": "테스트"},
            }
        ]

        result = prepare_documents(raw_docs)
        assert result[0]["content"] == "제목\n\n본문 내용"

    def test_build_bm25_index_returns_index(self):
        """
        BM25 인덱스 구축

        Given: 문서 리스트
        When: build_bm25_index() 호출
        Then: BM25Index 인스턴스 반환 (검색 가능)
        """
        pytest.importorskip("kiwipiepy")
        pytest.importorskip("rank_bm25")

        from quickstart_local.load_data import build_bm25_index

        docs = [
            {"id": "1", "content": "RAG 시스템 설치 가이드", "metadata": {}},
            {"id": "2", "content": "채팅 API 사용법", "metadata": {}},
        ]

        index = build_bm25_index(docs)

        # BM25Index 인스턴스인지 확인
        assert hasattr(index, "search")
        # 검색 동작 확인
        results = index.search("설치", top_k=2)
        assert len(results) > 0
```

**Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/quickstart_local/test_load_data.py -v --timeout=30`
Expected: FAIL with `ModuleNotFoundError: No module named 'quickstart_local'`

**Step 3: Write the implementation**

Create `quickstart_local/__init__.py` (빈 파일) and `quickstart_local/load_data.py`:

```python
#!/usr/bin/env python3
"""
ChromaDB 전용 샘플 데이터 로드 스크립트

Docker 없이 ChromaDB에 샘플 FAQ 데이터를 적재합니다.
BM25 인덱스도 함께 구축하여 하이브리드 검색을 준비합니다.

사용법:
    uv run python quickstart_local/load_data.py

의존성:
    - chromadb: 벡터 스토어
    - sentence-transformers: 로컬 임베딩
    - kiwipiepy, rank-bm25: BM25 인덱스 (선택적)
"""

import asyncio
import json
import pickle
import sys
from pathlib import Path
from typing import Any

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 상수
CHROMA_PERSIST_DIR = str(project_root / "quickstart_local" / ".chroma_data")
BM25_INDEX_PATH = str(project_root / "quickstart_local" / ".bm25_index.pkl")
COLLECTION_NAME = "documents"
SAMPLE_DATA_PATH = project_root / "quickstart" / "sample_data.json"


def prepare_documents(raw_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    sample_data.json 문서를 ChromaDB 적재 형식으로 변환

    Args:
        raw_docs: sample_data.json의 문서 리스트

    Returns:
        ChromaDB 호환 형식의 문서 리스트
        각 문서: {"id": str, "content": str, "metadata": dict}
    """
    result: list[dict[str, Any]] = []

    for doc in raw_docs:
        # title + content 병합 (검색 최적화)
        full_content = f"{doc['title']}\n\n{doc['content']}"

        metadata: dict[str, Any] = {
            "source_file": doc["title"],
            "file_type": doc.get("metadata", {}).get("category", "FAQ"),
            "source": "quickstart_sample",
        }

        # category 추가
        category = doc.get("metadata", {}).get("category", "")
        if category:
            metadata["category"] = category

        result.append({
            "id": doc["id"],
            "content": full_content,
            "metadata": metadata,
        })

    return result


def build_bm25_index(docs: list[dict[str, Any]]) -> Any:
    """
    BM25 인덱스를 구축합니다.

    Args:
        docs: 문서 리스트 (id, content, metadata 포함)

    Returns:
        BM25Index 인스턴스

    Raises:
        ImportError: kiwipiepy 또는 rank-bm25가 미설치된 경우
    """
    from app.modules.core.retrieval.bm25_engine import BM25Index, KoreanTokenizer

    # 불용어 필터 연동 (있으면)
    stopword_filter = None
    try:
        from app.modules.core.retrieval.bm25.stopwords import StopwordFilter
        stopword_filter = StopwordFilter(use_defaults=True, enabled=True)
    except ImportError:
        pass

    tokenizer = KoreanTokenizer(stopword_filter=stopword_filter)
    index = BM25Index(tokenizer=tokenizer)
    index.build(docs)

    return index


async def load_to_chroma(
    docs: list[dict[str, Any]],
    embeddings: list[list[float]],
    persist_dir: str = CHROMA_PERSIST_DIR,
    collection_name: str = COLLECTION_NAME,
) -> int:
    """
    ChromaDB에 문서 적재

    Args:
        docs: 준비된 문서 리스트
        embeddings: 임베딩 벡터 리스트
        persist_dir: ChromaDB 영속 디렉토리
        collection_name: 컬렉션 이름

    Returns:
        적재된 문서 수
    """
    from app.infrastructure.storage.vector.chroma_store import ChromaVectorStore

    store = ChromaVectorStore(persist_directory=persist_dir)

    # ChromaVectorStore 형식으로 변환
    chroma_docs = []
    for doc, vector in zip(docs, embeddings, strict=True):
        chroma_docs.append({
            "id": doc["id"],
            "vector": vector,
            "metadata": {
                **doc["metadata"],
                "content": doc["content"],  # 검색 결과에서 내용 반환용
            },
        })

    count = await store.add_documents(
        collection=collection_name,
        documents=chroma_docs,
    )

    return count


def save_bm25_index(index: Any, path: str = BM25_INDEX_PATH) -> None:
    """BM25 인덱스를 파일로 저장"""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(index, f)


def load_bm25_index(path: str = BM25_INDEX_PATH) -> Any:
    """저장된 BM25 인덱스 로드"""
    with open(path, "rb") as f:
        return pickle.load(f)  # noqa: S301


async def main() -> None:
    """메인 실행 함수"""
    print("🚀 Docker-Free 로컬 퀵스타트 - 데이터 로드")
    print()

    # 1. 샘플 데이터 로드
    if not SAMPLE_DATA_PATH.exists():
        print(f"❌ 샘플 데이터 파일을 찾을 수 없습니다: {SAMPLE_DATA_PATH}")
        sys.exit(1)

    with open(SAMPLE_DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    raw_docs = data.get("documents", [])
    print(f"📄 {len(raw_docs)}개 문서 로드")

    # 2. 문서 준비
    docs = prepare_documents(raw_docs)

    # 3. 로컬 임베딩 생성
    print("🤖 로컬 임베딩 모델 초기화 중...")
    print("   (첫 실행 시 모델 다운로드에 1-2분 소요)")

    from app.modules.core.embedding.local_embedder import LocalEmbedder

    embedder = LocalEmbedder(
        model_name="Qwen/Qwen3-Embedding-0.6B",
        output_dimensionality=1024,
        batch_size=32,
        normalize=True,
    )
    print("✅ 임베딩 모델 로드 완료!")

    texts = [doc["content"] for doc in docs]
    print("🔢 임베딩 생성 중...")
    embeddings = embedder.embed_documents(texts)
    print(f"✅ {len(embeddings)}개 임베딩 생성 완료 (차원: {len(embeddings[0])})")

    # 4. ChromaDB 적재
    print("📥 ChromaDB에 문서 적재 중...")
    count = await load_to_chroma(docs, embeddings)
    print(f"✅ {count}개 문서 ChromaDB 적재 완료 ({CHROMA_PERSIST_DIR})")

    # 5. BM25 인덱스 구축
    print("🔍 BM25 인덱스 구축 중...")
    try:
        bm25_index = build_bm25_index(docs)
        save_bm25_index(bm25_index)
        print(f"✅ BM25 인덱스 구축 완료 ({BM25_INDEX_PATH})")
    except ImportError:
        print("⚠️  BM25 의존성 미설치 - Dense 검색만 사용합니다")
        print("   설치: uv sync --extra bm25")

    print()
    print("🎉 데이터 로드 완료!")


if __name__ == "__main__":
    asyncio.run(main())
```

**Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/quickstart_local/test_load_data.py -v --timeout=60`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add quickstart_local/__init__.py quickstart_local/load_data.py \
  tests/unit/quickstart_local/__init__.py tests/unit/quickstart_local/test_load_data.py
git commit -m "기능: ChromaDB 전용 데이터 로드 스크립트 추가 (quickstart_local)"
```

---

## Task 2: Rich CLI 챗봇 인터페이스

**Files:**
- Create: `quickstart_local/chat.py`
- Test: `tests/unit/quickstart_local/test_chat.py`
- Read: `app/api/chat.py` (기존 채팅 API 참고)

**Step 1: Write the failing test**

Create `tests/unit/quickstart_local/test_chat.py`:

```python
"""
Rich CLI 챗봇 단위 테스트

CLI 챗봇의 핵심 함수를 테스트합니다.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestChatHelpers:
    """CLI 챗봇 헬퍼 함수 테스트"""

    def test_format_search_results_returns_string(self):
        """
        검색 결과를 Rich 포맷 문자열로 변환

        Given: SearchResult 객체 리스트
        When: format_search_results() 호출
        Then: 포맷된 문자열 반환
        """
        from quickstart_local.chat import format_search_results

        results = [
            {"content": "RAG 시스템 설치 가이드", "score": 0.92, "source": "guide-001"},
            {"content": "채팅 API 사용법", "score": 0.85, "source": "guide-002"},
        ]

        formatted = format_search_results(results)

        assert "RAG 시스템 설치 가이드" in formatted
        assert "0.92" in formatted

    def test_format_search_results_empty(self):
        """
        빈 검색 결과 처리

        Given: 빈 결과 리스트
        When: format_search_results() 호출
        Then: "검색 결과 없음" 메시지 반환
        """
        from quickstart_local.chat import format_search_results

        formatted = format_search_results([])
        assert "검색 결과" in formatted or "없" in formatted

    @pytest.mark.asyncio
    async def test_search_documents_calls_retriever(self):
        """
        검색 함수가 ChromaRetriever를 올바르게 호출하는지 확인

        Given: Mock retriever
        When: search_documents() 호출
        Then: retriever.search()가 쿼리와 함께 호출됨
        """
        from quickstart_local.chat import search_documents

        mock_retriever = AsyncMock()
        mock_retriever.search.return_value = []

        results = await search_documents("테스트 쿼리", retriever=mock_retriever)

        mock_retriever.search.assert_called_once()
        assert isinstance(results, list)
```

**Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/quickstart_local/test_chat.py -v --timeout=30`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Write the implementation**

Create `quickstart_local/chat.py`:

```python
#!/usr/bin/env python3
"""
Rich CLI 대화형 챗봇

Docker 없이 로컬에서 RAG 하이브리드 검색을 체험하는 CLI 인터페이스입니다.
FastAPI 서버 없이 직접 검색 파이프라인을 호출합니다.

사용법:
    uv run python quickstart_local/chat.py

의존성:
    - rich: CLI UI
    - chromadb: 벡터 검색
    - sentence-transformers: 임베딩
    - kiwipiepy, rank-bm25: BM25 검색 (선택적)
"""

import asyncio
import pickle
import sys
from pathlib import Path
from typing import Any

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from quickstart_local.load_data import (
    BM25_INDEX_PATH,
    CHROMA_PERSIST_DIR,
    COLLECTION_NAME,
)

# 상수
TOP_K = 5


def format_search_results(results: list[dict[str, Any]]) -> str:
    """
    검색 결과를 포맷된 문자열로 변환

    Args:
        results: 검색 결과 리스트 (content, score, source 필드)

    Returns:
        Rich 마크업이 포함된 문자열
    """
    if not results:
        return "[dim]검색 결과가 없습니다.[/dim]"

    lines = []
    for i, r in enumerate(results, 1):
        score = r.get("score", 0.0)
        content = r.get("content", "")[:80]
        source = r.get("source", "unknown")
        lines.append(f"  {i}. [bold]{content}...[/bold] (점수: {score:.2f})")

    return "\n".join(lines)


async def search_documents(
    query: str,
    retriever: Any = None,
    bm25_index: Any = None,
    merger: Any = None,
    top_k: int = TOP_K,
) -> list[dict[str, Any]]:
    """
    ChromaDB + BM25 하이브리드 검색 수행

    Args:
        query: 검색 쿼리
        retriever: ChromaRetriever 인스턴스
        bm25_index: BM25Index 인스턴스 (선택적)
        merger: HybridMerger 인스턴스 (선택적)
        top_k: 반환할 결과 수

    Returns:
        검색 결과 리스트
    """
    if retriever is None:
        return []

    search_results = await retriever.search(
        query=query,
        top_k=top_k,
    )

    # SearchResult → dict 변환
    results = []
    for sr in search_results:
        results.append({
            "content": sr.content,
            "score": sr.score,
            "source": sr.id,
            "metadata": sr.metadata,
        })

    return results


def initialize_components() -> tuple[Any, Any | None, Any | None]:
    """
    검색 파이프라인 컴포넌트 초기화

    Returns:
        (retriever, bm25_index, merger) 튜플
    """
    from app.infrastructure.storage.vector.chroma_store import ChromaVectorStore
    from app.modules.core.embedding.local_embedder import LocalEmbedder
    from app.modules.core.retrieval.retrievers.chroma_retriever import ChromaRetriever

    # 1. 임베딩 모델
    embedder = LocalEmbedder(
        model_name="Qwen/Qwen3-Embedding-0.6B",
        output_dimensionality=1024,
        batch_size=32,
        normalize=True,
    )

    # 2. ChromaVectorStore (persistent)
    store = ChromaVectorStore(persist_directory=CHROMA_PERSIST_DIR)

    # 3. BM25 인덱스 + HybridMerger (선택적)
    bm25_index = None
    merger = None
    try:
        if Path(BM25_INDEX_PATH).exists():
            with open(BM25_INDEX_PATH, "rb") as f:
                bm25_index = pickle.load(f)  # noqa: S301

            from app.modules.core.retrieval.bm25_engine import HybridMerger
            merger = HybridMerger(alpha=0.6)
    except (ImportError, Exception):
        pass

    # 4. ChromaRetriever (하이브리드 DI 주입)
    retriever = ChromaRetriever(
        embedder=embedder,
        store=store,
        collection_name=COLLECTION_NAME,
        top_k=TOP_K,
        bm25_index=bm25_index,
        hybrid_merger=merger,
    )

    return retriever, bm25_index, merger


async def chat_loop() -> None:
    """메인 대화 루프"""
    try:
        from rich.console import Console
        from rich.panel import Panel
        from rich.text import Text
    except ImportError:
        print("❌ rich 패키지가 필요합니다: uv pip install rich")
        sys.exit(1)

    console = Console()

    # 헤더 출력
    header = Text()
    header.append("OneRAG 로컬 챗봇\n", style="bold cyan")
    header.append("하이브리드 검색 (벡터 + 한글 키워드)\n", style="dim")
    header.append("종료: quit | 도움: help", style="dim")
    console.print(Panel(header, border_style="cyan"))
    console.print()

    # 컴포넌트 초기화
    console.print("[dim]검색 엔진 초기화 중...[/dim]")
    retriever, bm25_index, merger = initialize_components()

    hybrid_status = "활성" if bm25_index is not None else "비활성 (Dense만 사용)"
    console.print(f"[green]✅ 초기화 완료[/green] (하이브리드: {hybrid_status})")
    console.print()

    # 대화 루프
    while True:
        try:
            query = console.input("[bold yellow]❓ 질문: [/bold yellow]").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]종료합니다.[/dim]")
            break

        if not query:
            continue
        if query.lower() in ("quit", "exit", "q"):
            console.print("[dim]종료합니다.[/dim]")
            break
        if query.lower() == "help":
            console.print()
            console.print("[bold]💬 예시 질문:[/bold]")
            console.print("  • RAG 시스템이란?")
            console.print("  • 설치 방법 알려줘")
            console.print("  • 하이브리드 검색이 뭐야?")
            console.print("  • 환경변수 설정 어떻게 해?")
            console.print()
            continue

        # 검색 실행
        console.print("[dim]  🔍 검색 중...[/dim]")
        results = await search_documents(
            query=query,
            retriever=retriever,
        )

        # 결과 출력
        if results:
            console.print(f"\n  [bold]📄 검색 결과 ({len(results)}건):[/bold]")
            for i, r in enumerate(results[:5], 1):
                score = r.get("score", 0.0)
                content = r.get("content", "")
                # 첫 100자만 표시
                preview = content[:100].replace("\n", " ")
                console.print(f"    {i}. {preview}... [dim](점수: {score:.2f})[/dim]")
        else:
            console.print("  [dim]검색 결과가 없습니다.[/dim]")

        console.print()


def main() -> None:
    """메인 진입점"""
    asyncio.run(chat_loop())


if __name__ == "__main__":
    main()
```

**Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/quickstart_local/test_chat.py -v --timeout=30`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add quickstart_local/chat.py tests/unit/quickstart_local/test_chat.py
git commit -m "기능: Rich CLI 대화형 챗봇 추가 (quickstart_local)"
```

---

## Task 3: 원클릭 실행 스크립트 + 환경 설정

**Files:**
- Create: `quickstart_local/run.py`
- Create: `quickstart_local/.env.local`
- Test: `tests/unit/quickstart_local/test_run.py`

**Step 1: Write the failing test**

Create `tests/unit/quickstart_local/test_run.py`:

```python
"""
원클릭 실행 스크립트 단위 테스트

의존성 확인 로직을 테스트합니다.
"""

from unittest.mock import patch


class TestRunHelpers:
    """실행 스크립트 헬퍼 함수 테스트"""

    def test_check_dependencies_all_installed(self):
        """
        모든 의존성이 설치된 경우

        Given: 필수 패키지 모두 설치됨
        When: check_dependencies() 호출
        Then: (True, []) 반환
        """
        from quickstart_local.run import check_dependencies

        ok, missing = check_dependencies()

        # chromadb는 프로젝트 의존성이므로 설치됨
        assert ok is True
        assert len(missing) == 0

    def test_check_env_file_missing(self):
        """
        .env 파일 미존재 시 경고

        Given: .env 파일이 없는 경로
        When: check_env_file() 호출
        Then: False 반환
        """
        from quickstart_local.run import check_env_file

        result = check_env_file("/nonexistent/path/.env")
        assert result is False

    def test_check_data_loaded_false_when_no_dir(self):
        """
        데이터 미적재 상태 확인

        Given: ChromaDB 데이터 디렉토리가 없음
        When: check_data_loaded() 호출
        Then: False 반환
        """
        from quickstart_local.run import check_data_loaded

        result = check_data_loaded("/nonexistent/chroma_data")
        assert result is False
```

**Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/quickstart_local/test_run.py -v --timeout=10`
Expected: FAIL

**Step 3: Write the implementation**

Create `quickstart_local/.env.local`:

```env
# OneRAG Docker-Free 로컬 퀵스타트 환경 설정
#
# 사용법:
#   cp quickstart_local/.env.local .env
#   # .env에서 GOOGLE_API_KEY만 설정
#   make quickstart-local

# ============================================================
# 필수 설정 - LLM API 키 (하나만 선택)
# ============================================================

# Option 1: Google Gemini (추천 - 무료 티어 제공)
GOOGLE_API_KEY=your-google-api-key-here

# Option 2: OpenAI GPT
# OPENAI_API_KEY=your-openai-api-key-here

# ============================================================
# 자동 설정 (수정 불필요)
# ============================================================

ENVIRONMENT=development

# 벡터 DB: ChromaDB (Docker 불필요!)
VECTOR_DB_PROVIDER=chroma
CHROMA_PERSIST_DIR=./quickstart_local/.chroma_data

# 임베딩: 로컬 모델 (API 키 불필요)
EMBEDDINGS_PROVIDER=local

# LLM 설정
LLM_PROVIDER=google
LLM_MODEL=gemini-2.0-flash

# 서버 설정
HOST=0.0.0.0
PORT=8000
DEBUG=true

# 인증 (개발용)
FASTAPI_AUTH_KEY=quickstart-dev-key-change-in-production
```

Create `quickstart_local/run.py`:

```python
#!/usr/bin/env python3
"""
Docker-Free 로컬 퀵스타트 원클릭 실행

1단계: 의존성 확인
2단계: 데이터 로드 (미적재 시)
3단계: CLI 챗봇 실행

사용법:
    uv run python quickstart_local/run.py
"""

import os
import subprocess
import sys
from pathlib import Path

# 프로젝트 루트
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 상수
REQUIRED_PACKAGES = ["chromadb", "sentence_transformers", "rich"]
OPTIONAL_PACKAGES = ["kiwipiepy", "rank_bm25"]
CHROMA_DATA_DIR = str(project_root / "quickstart_local" / ".chroma_data")
ENV_FILE_PATH = str(project_root / ".env")


def check_dependencies() -> tuple[bool, list[str]]:
    """
    필수 의존성 설치 여부 확인

    Returns:
        (모두 설치됨 여부, 누락된 패키지 리스트)
    """
    missing = []
    for pkg in REQUIRED_PACKAGES:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)

    return len(missing) == 0, missing


def check_optional_dependencies() -> list[str]:
    """
    선택적 의존성 확인 (BM25 하이브리드 검색용)

    Returns:
        누락된 선택적 패키지 리스트
    """
    missing = []
    for pkg in OPTIONAL_PACKAGES:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    return missing


def check_env_file(path: str = ENV_FILE_PATH) -> bool:
    """
    .env 파일 존재 여부 확인

    Args:
        path: .env 파일 경로

    Returns:
        파일 존재 여부
    """
    return Path(path).exists()


def check_data_loaded(chroma_dir: str = CHROMA_DATA_DIR) -> bool:
    """
    ChromaDB 데이터 적재 여부 확인

    Args:
        chroma_dir: ChromaDB 데이터 디렉토리 경로

    Returns:
        데이터가 적재되었는지 여부
    """
    chroma_path = Path(chroma_dir)
    if not chroma_path.exists():
        return False
    # ChromaDB는 sqlite3 파일을 생성함
    return any(chroma_path.iterdir())


def main() -> None:
    """메인 실행 함수"""
    print("=" * 50)
    print("🚀 OneRAG Docker-Free 로컬 퀵스타트")
    print("=" * 50)
    print()

    # Step 1: 의존성 확인
    print("[1/3] 의존성 확인 중...")
    ok, missing = check_dependencies()
    if not ok:
        print(f"❌ 필수 패키지 미설치: {', '.join(missing)}")
        print("   설치: uv sync")
        sys.exit(1)
    print("  ✅ 필수 의존성 확인 완료")

    optional_missing = check_optional_dependencies()
    if optional_missing:
        print(f"  ⚠️  BM25 의존성 미설치: {', '.join(optional_missing)}")
        print("     하이브리드 검색을 위해 설치 권장: uv sync --extra bm25")
        print("     (Dense 검색만으로도 동작합니다)")
    else:
        print("  ✅ BM25 하이브리드 검색 활성화")
    print()

    # Step 2: .env 파일 확인
    if not check_env_file():
        print("[2/3] .env 파일 생성 중...")
        local_env = project_root / "quickstart_local" / ".env.local"
        if local_env.exists():
            import shutil
            shutil.copy(str(local_env), ENV_FILE_PATH)
            print("  ✅ .env 파일 복사 완료")
            print("  ⚠️  .env 파일을 열어 GOOGLE_API_KEY를 설정하세요!")
            print("     발급: https://aistudio.google.com/apikey (무료)")
            print()
        else:
            print("  ❌ quickstart_local/.env.local 파일을 찾을 수 없습니다")
            sys.exit(1)
    else:
        print("[2/3] .env 파일 확인 완료")
        print()

    # Step 3: 데이터 로드 (미적재 시)
    if not check_data_loaded():
        print("[3/3] 샘플 데이터 로드 중...")
        print()
        load_script = project_root / "quickstart_local" / "load_data.py"
        result = subprocess.run(
            [sys.executable, str(load_script)],
            cwd=str(project_root),
        )
        if result.returncode != 0:
            print("❌ 데이터 로드 실패")
            sys.exit(1)
        print()
    else:
        print("[3/3] 데이터 이미 적재됨 (건너뜀)")
        print()

    # Step 4: CLI 챗봇 실행
    print("=" * 50)
    print("💬 CLI 챗봇을 시작합니다...")
    print("=" * 50)
    print()
    chat_script = project_root / "quickstart_local" / "chat.py"
    subprocess.run([sys.executable, str(chat_script)], cwd=str(project_root))


if __name__ == "__main__":
    main()
```

**Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/quickstart_local/test_run.py -v --timeout=10`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add quickstart_local/run.py quickstart_local/.env.local \
  tests/unit/quickstart_local/test_run.py
git commit -m "기능: 원클릭 실행 스크립트 및 환경 설정 추가 (quickstart_local)"
```

---

## Task 4: Makefile 타겟 추가

**Files:**
- Modify: `Makefile`

**Step 1: Write the change**

`Makefile`에 다음 타겟들을 추가합니다 (Quickstart 섹션 하단):

```makefile
# =============================================================================
# Docker-Free 로컬 퀵스타트 (ChromaDB + BM25 하이브리드)
# =============================================================================

# Docker-Free 원클릭 실행
quickstart-local: check-uv check-env
	@echo "🚀 Docker-Free 로컬 퀵스타트 시작..."
	uv run python quickstart_local/run.py

# 로컬 퀵스타트 데이터만 로드
quickstart-local-load: check-uv
	@echo "📥 ChromaDB 샘플 데이터 로드 중..."
	uv run python quickstart_local/load_data.py

# 로컬 퀵스타트 CLI 챗봇만 실행
quickstart-local-chat: check-uv
	@echo "💬 CLI 챗봇 실행..."
	uv run python quickstart_local/chat.py

# 로컬 퀵스타트 데이터 초기화
quickstart-local-clean:
	@echo "🗑️  로컬 퀵스타트 데이터 삭제 중..."
	rm -rf quickstart_local/.chroma_data
	rm -f quickstart_local/.bm25_index.pkl
	@echo "✅ 초기화 완료"
```

또한 `help` 타겟에 Docker-Free 관련 도움말을 추가합니다:

```makefile
	@echo ""
	@echo "🏠 Docker-Free 로컬 퀵스타트 (Docker 불필요!):"
	@echo "  quickstart-local      - Docker 없이 원클릭 실행 (ChromaDB + BM25)"
	@echo "  quickstart-local-load - ChromaDB 샘플 데이터 로드"
	@echo "  quickstart-local-chat - CLI 챗봇 실행"
	@echo "  quickstart-local-clean- 로컬 퀵스타트 데이터 삭제"
```

**Step 2: Verify**

Run: `make help` → Docker-Free 섹션이 출력되는지 확인
Run: `make quickstart-local-clean` → 정상 실행 확인

**Step 3: Commit**

```bash
git add Makefile
git commit -m "기능: Makefile에 Docker-Free 로컬 퀵스타트 타겟 추가"
```

---

## Task 5: .gitignore 업데이트 + 전체 통합 테스트

**Files:**
- Modify: `.gitignore`
- Run: 전체 테스트 스위트

**Step 1: .gitignore에 로컬 퀵스타트 데이터 제외**

```gitignore
# Docker-Free 로컬 퀵스타트 데이터
quickstart_local/.chroma_data/
quickstart_local/.bm25_index.pkl
```

**Step 2: 전체 린트 + 테스트**

Run:
```bash
uv run ruff check quickstart_local/ tests/unit/quickstart_local/
uv run pytest tests/unit/quickstart_local/ -v --timeout=60
uv run pytest --timeout=60 -q
```

Expected:
- ruff: 0 errors
- quickstart_local 테스트: 9 passed (Task 1: 3, Task 2: 3, Task 3: 3)
- 전체 테스트: 1832+ passed (기존 1823 + 신규 9)

**Step 3: Commit**

```bash
git add .gitignore
git commit -m "설정: .gitignore에 로컬 퀵스타트 데이터 디렉토리 제외"
```

---

## Task 6: 통합 커밋 + 검증

**Files:**
- 전체 변경 확인

**Step 1: 최종 검증**

```bash
# 전체 테스트
uv run pytest --timeout=60 -q

# ruff
uv run ruff check quickstart_local/ tests/unit/quickstart_local/

# 파일 구조 확인
ls -la quickstart_local/
```

Expected 파일 구조:
```
quickstart_local/
├── __init__.py          # 패키지 초기화
├── .env.local           # 환경 설정 템플릿
├── run.py               # 원클릭 실행
├── load_data.py         # ChromaDB 데이터 로드
└── chat.py              # Rich CLI 챗봇
```

**Step 2: git log 확인**

```bash
git log --oneline -6
```

Expected (역순):
```
기능: ChromaDB 전용 데이터 로드 스크립트 추가 (quickstart_local)
기능: Rich CLI 대화형 챗봇 추가 (quickstart_local)
기능: 원클릭 실행 스크립트 및 환경 설정 추가 (quickstart_local)
기능: Makefile에 Docker-Free 로컬 퀵스타트 타겟 추가
설정: .gitignore에 로컬 퀵스타트 데이터 디렉토리 제외
```

---

## 성공 기준 체크리스트

- [ ] `quickstart_local/load_data.py`가 ChromaDB에 25개 문서 적재
- [ ] `quickstart_local/load_data.py`가 BM25 인덱스 파일 생성
- [ ] `quickstart_local/chat.py`가 Rich CLI로 검색 결과 표시
- [ ] `quickstart_local/run.py`가 의존성 확인 → 데이터 로드 → 챗봇 순서로 실행
- [ ] `make quickstart-local`이 원클릭으로 전체 과정 수행
- [ ] 기존 Docker 퀵스타트(`make quickstart`)에 영향 없음
- [ ] 기존 테스트 전체 통과 (1823+)
- [ ] 신규 테스트 9개 통과
