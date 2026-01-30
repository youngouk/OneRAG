# Phase 1: 독립 BM25 엔진 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** BM25 미지원 벡터 DB(ChromaDB, pgvector, MongoDB)에서도 하이브리드 검색이 가능하도록 Python 기반 독립 BM25 엔진을 DI 패턴으로 추가한다.

**Architecture:** 기존 `bm25/` 전처리 모듈을 재사용하고, 새로운 `bm25_engine/` 모듈에 Kiwi 토크나이저 + rank-bm25 인덱스 + RRF 병합기를 구현한다. ChromaRetriever에 BM25Engine을 선택적으로 DI 주입하여, BM25Engine이 있으면 하이브리드 검색, 없으면 기존 Dense 전용 검색으로 동작한다. 기존 Weaviate/Pinecone/Qdrant 경로는 변경하지 않는다.

**Tech Stack:** Python 3.11+, kiwipiepy (한국어 형태소 분석), rank-bm25 (BM25 알고리즘), pytest + pytest-asyncio (TDD)

---

## 핵심 참조 파일

| 파일 | 역할 |
|------|------|
| `app/modules/core/retrieval/interfaces.py` | IRetriever Protocol, SearchResult 정의 |
| `app/modules/core/retrieval/bm25/__init__.py` | 기존 전처리 모듈 (SynonymManager, StopwordFilter, UserDictionary) |
| `app/modules/core/retrieval/retrievers/chroma_retriever.py` | 수정 대상: Dense 전용 → 하이브리드 검색 |
| `app/modules/core/retrieval/retrievers/factory.py` | 수정 대상: ChromaDB hybrid_support 플래그 |
| `app/core/di_container.py` | 수정 대상: BM25Engine DI 등록 |
| `app/modules/core/retrieval/retrievers/weaviate_retriever.py` | 참조: _preprocess_query() 패턴 |
| `tests/unit/retrieval/retrievers/test_chroma_retriever.py` | 기존 테스트 (확장 대상) |
| `tests/unit/retrieval/bm25/` | 기존 BM25 전처리 테스트 (패턴 참조) |

---

## Task 1: KoreanTokenizer — Kiwi 한국어 토크나이저 래핑

**Files:**
- Create: `app/modules/core/retrieval/bm25_engine/__init__.py`
- Create: `app/modules/core/retrieval/bm25_engine/tokenizer.py`
- Test: `tests/unit/retrieval/bm25_engine/test_tokenizer.py`
- Create: `tests/unit/retrieval/bm25_engine/__init__.py`

**Step 1: 테스트 디렉토리 및 __init__.py 생성**

`tests/unit/retrieval/bm25_engine/__init__.py`:
```python
```

`app/modules/core/retrieval/bm25_engine/__init__.py`:
```python
```

**Step 2: 실패하는 테스트 작성**

`tests/unit/retrieval/bm25_engine/test_tokenizer.py`:
```python
"""
KoreanTokenizer 단위 테스트

Kiwi 기반 한국어 형태소 분석 토크나이저.
kiwipiepy가 설치되지 않은 환경에서도 테스트가 로드되어야 합니다.

테스트 범위:
1. 기본 토큰화
2. 빈 입력 처리
3. 배치 토큰화
4. 기존 전처리 모듈과의 연동
5. Kiwi 미설치 시 Graceful Degradation
"""

import pytest

# kiwipiepy 선택적 의존성 - 미설치 환경에서도 테스트 로드 가능
kiwi_available = pytest.importorskip("kiwipiepy")


class TestKoreanTokenizerBasic:
    """KoreanTokenizer 기본 기능 테스트"""

    def test_tokenize_korean_sentence(self) -> None:
        """
        한국어 문장 토큰화

        Given: 한국어 문장 "삼성전자의 주가가 올랐습니다"
        When: tokenize() 호출
        Then: 의미 있는 형태소 토큰 리스트 반환 (조사/어미 제거)
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        tokens = tokenizer.tokenize("삼성전자의 주가가 올랐습니다")

        # 검증: 명사/동사 어간 등 의미 있는 토큰만 추출
        assert "삼성전자" in tokens
        assert "주가" in tokens
        # 조사 "의", "가" 등은 제거되어야 함
        assert "의" not in tokens

    def test_tokenize_english_mixed(self) -> None:
        """
        한영 혼합 문장 토큰화

        Given: "RAG 시스템을 설치합니다"
        When: tokenize() 호출
        Then: 영문 토큰도 포함
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        tokens = tokenizer.tokenize("RAG 시스템을 설치합니다")

        assert "RAG" in tokens or "rag" in tokens.copy() or any("RAG" in t or "rag" in t for t in tokens)
        assert "시스템" in tokens
        assert "설치" in tokens

    def test_tokenize_empty_string(self) -> None:
        """
        빈 문자열 처리

        Given: 빈 문자열
        When: tokenize() 호출
        Then: 빈 리스트 반환, 에러 없음
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        tokens = tokenizer.tokenize("")

        assert tokens == []

    def test_tokenize_returns_list_of_strings(self) -> None:
        """
        반환 타입 확인

        Given: 정상 한국어 문장
        When: tokenize() 호출
        Then: list[str] 타입 반환
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        tokens = tokenizer.tokenize("테스트 문장입니다")

        assert isinstance(tokens, list)
        assert all(isinstance(t, str) for t in tokens)


class TestKoreanTokenizerBatch:
    """KoreanTokenizer 배치 토큰화 테스트"""

    def test_tokenize_batch(self) -> None:
        """
        다수 문서 일괄 토큰화

        Given: 문서 3개
        When: tokenize_batch() 호출
        Then: 각 문서별 토큰 리스트 반환
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        docs = [
            "삼성전자 주가 분석",
            "애플 아이폰 출시",
            "RAG 시스템 설치 가이드",
        ]
        result = tokenizer.tokenize_batch(docs)

        # 검증: 3개 문서 → 3개 토큰 리스트
        assert len(result) == 3
        assert all(isinstance(tokens, list) for tokens in result)
        assert all(len(tokens) > 0 for tokens in result)

    def test_tokenize_batch_empty_list(self) -> None:
        """
        빈 리스트 처리

        Given: 빈 리스트
        When: tokenize_batch() 호출
        Then: 빈 리스트 반환
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        result = tokenizer.tokenize_batch([])

        assert result == []


class TestKoreanTokenizerWithPreprocessors:
    """기존 BM25 전처리 모듈과의 연동 테스트"""

    def test_tokenize_with_stopword_filter(self) -> None:
        """
        불용어 필터와 함께 사용

        Given: StopwordFilter가 주입된 토크나이저
        When: tokenize() 호출
        Then: 불용어가 제거된 토큰 리스트 반환
        """
        from app.modules.core.retrieval.bm25.stopwords import StopwordFilter
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        stopword_filter = StopwordFilter(use_defaults=True, enabled=True)
        tokenizer = KoreanTokenizer(stopword_filter=stopword_filter)

        tokens = tokenizer.tokenize("있는 맛집 같은 것")

        # 검증: 불용어 "있는", "같은", "것" 등이 제거됨
        assert "맛집" in tokens
        # 기본 불용어에 포함된 단어는 제거
        for stopword in ["있는", "같은", "것"]:
            assert stopword not in tokens

    def test_tokenize_without_preprocessors(self) -> None:
        """
        전처리 모듈 없이도 정상 동작

        Given: 전처리 모듈 없는 토크나이저
        When: tokenize() 호출
        Then: 형태소 분석만 수행, 에러 없음
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        tokens = tokenizer.tokenize("테스트 문장입니다")

        assert len(tokens) > 0
```

**Step 3: 테스트 실행하여 실패 확인**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run pytest tests/unit/retrieval/bm25_engine/test_tokenizer.py -v --timeout=10`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.modules.core.retrieval.bm25_engine'`

**Step 4: 최소 구현 작성**

`app/modules/core/retrieval/bm25_engine/__init__.py`:
```python
"""
BM25 실행 엔진 모듈

벡터 DB가 BM25를 내장하지 않는 경우(ChromaDB, pgvector, MongoDB)에
Python 기반 독립 BM25 검색을 제공합니다.

구성요소:
- KoreanTokenizer: Kiwi 기반 한국어 형태소 토크나이저
- BM25Index: rank-bm25 래핑 인덱스
- HybridMerger: Dense + BM25 결과 RRF 병합
"""
```

`app/modules/core/retrieval/bm25_engine/tokenizer.py`:
```python
"""
한국어 형태소 토크나이저

Kiwi 한국어 형태소 분석기를 래핑하여 BM25 검색에 필요한
토큰화 기능을 제공합니다.

의존성:
- kiwipiepy: pip install kiwipiepy (선택적)

기존 BM25 전처리 모듈(StopwordFilter, SynonymManager, UserDictionary)과
선택적으로 연동하여 검색 품질을 높입니다.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.modules.core.retrieval.bm25.stopwords import StopwordFilter
    from app.modules.core.retrieval.bm25.synonym_manager import SynonymManager
    from app.modules.core.retrieval.bm25.user_dictionary import UserDictionary

logger = logging.getLogger(__name__)

# Kiwi에서 추출할 의미 있는 품사 태그
# NNG: 일반 명사, NNP: 고유 명사, NNB: 의존 명사
# VV: 동사, VA: 형용사, MAG: 일반 부사
# SL: 외국어, SN: 숫자, SH: 한자
_MEANINGFUL_POS_TAGS = frozenset(
    {"NNG", "NNP", "VV", "VA", "MAG", "SL", "SN", "SH"}
)


class KoreanTokenizer:
    """
    Kiwi 기반 한국어 형태소 토크나이저

    BM25 검색을 위해 텍스트를 의미 있는 형태소 토큰으로 분리합니다.
    조사, 어미 등 검색에 불필요한 품사는 제거합니다.

    Args:
        stopword_filter: 불용어 필터 (선택적, DI 주입)
        synonym_manager: 동의어 관리자 (선택적, DI 주입)
        user_dictionary: 사용자 사전 (선택적, DI 주입)

    사용 예시:
        tokenizer = KoreanTokenizer()
        tokens = tokenizer.tokenize("삼성전자의 주가가 올랐습니다")
        # → ["삼성전자", "주가", "오르"]
    """

    def __init__(
        self,
        stopword_filter: StopwordFilter | None = None,
        synonym_manager: SynonymManager | None = None,
        user_dictionary: UserDictionary | None = None,
    ) -> None:
        self._stopword_filter = stopword_filter
        self._synonym_manager = synonym_manager
        self._user_dictionary = user_dictionary

        # Kiwi 인스턴스 (지연 초기화)
        self._kiwi = self._initialize_kiwi()

        logger.info(
            "KoreanTokenizer 초기화 완료 "
            f"(stopword_filter={'있음' if stopword_filter else '없음'}, "
            f"synonym_manager={'있음' if synonym_manager else '없음'}, "
            f"user_dictionary={'있음' if user_dictionary else '없음'})"
        )

    def _initialize_kiwi(self) -> "Kiwi":  # type: ignore[name-defined]  # noqa: F821
        """Kiwi 형태소 분석기 초기화"""
        try:
            from kiwipiepy import Kiwi

            kiwi = Kiwi()
            logger.debug("Kiwi 형태소 분석기 로드 완료")
            return kiwi
        except ImportError as e:
            raise ImportError(
                "KoreanTokenizer를 사용하려면 kiwipiepy가 필요합니다. "
                "설치: uv add kiwipiepy 또는 pip install kiwipiepy"
            ) from e

    def tokenize(self, text: str) -> list[str]:
        """
        텍스트를 의미 있는 형태소 토큰으로 분리

        전처리 파이프라인:
        1. UserDictionary 보호 (합성어 보호)
        2. SynonymManager 확장 (동의어 정규화)
        3. Kiwi 형태소 분석 (의미 있는 품사만 추출)
        4. StopwordFilter 적용 (불용어 제거)
        5. UserDictionary 복원

        Args:
            text: 토큰화할 텍스트

        Returns:
            의미 있는 형태소 토큰 리스트
        """
        if not text or not text.strip():
            return []

        processed_text = text
        restore_map: dict[str, str] = {}

        # 1. UserDictionary 보호 (합성어 → 임시 토큰)
        if self._user_dictionary:
            processed_text, restore_map = self._user_dictionary.protect_entries(
                processed_text
            )

        # 2. SynonymManager 확장 (동의어 → 표준어)
        if self._synonym_manager:
            processed_text = self._synonym_manager.expand_query(processed_text)

        # 3. Kiwi 형태소 분석 — 의미 있는 품사만 추출
        tokens: list[str] = []
        for token in self._kiwi.tokenize(processed_text):
            if token.tag in _MEANINGFUL_POS_TAGS:
                form = token.form
                # UserDictionary 복원
                if restore_map:
                    form = self._user_dictionary.restore_entries(  # type: ignore[union-attr]
                        form, restore_map
                    )
                tokens.append(form)

        # 4. StopwordFilter 적용
        if self._stopword_filter:
            tokens = self._stopword_filter.filter(tokens)

        return tokens

    def tokenize_batch(self, texts: list[str]) -> list[list[str]]:
        """
        다수 텍스트 일괄 토큰화

        Args:
            texts: 토큰화할 텍스트 리스트

        Returns:
            각 텍스트별 토큰 리스트의 리스트
        """
        return [self.tokenize(text) for text in texts]
```

**Step 5: 테스트 실행하여 통과 확인**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run pytest tests/unit/retrieval/bm25_engine/test_tokenizer.py -v --timeout=10`
Expected: PASS (kiwipiepy 설치 필요 — 미설치 시 SKIP)

**Step 6: 커밋**

```bash
git add app/modules/core/retrieval/bm25_engine/__init__.py app/modules/core/retrieval/bm25_engine/tokenizer.py tests/unit/retrieval/bm25_engine/__init__.py tests/unit/retrieval/bm25_engine/test_tokenizer.py
git commit -m "기능: Kiwi 기반 한국어 토크나이저 (BM25 엔진 Phase 1-1)"
```

---

## Task 2: BM25Index — rank-bm25 래핑 인덱스

**Files:**
- Create: `app/modules/core/retrieval/bm25_engine/index.py`
- Test: `tests/unit/retrieval/bm25_engine/test_index.py`

**Step 1: 실패하는 테스트 작성**

`tests/unit/retrieval/bm25_engine/test_index.py`:
```python
"""
BM25Index 단위 테스트

rank-bm25 라이브러리를 래핑한 BM25 인덱스.
문서 인덱싱 및 키워드 검색 기능을 테스트합니다.

테스트 범위:
1. 문서 인덱싱
2. 쿼리 검색 (점수 및 랭킹)
3. 빈 인덱스 처리
4. 점수 정규화 (0~1)
5. 메타데이터 필터링
"""

import pytest

# rank_bm25 선택적 의존성
pytest.importorskip("rank_bm25")
# kiwipiepy도 필요
pytest.importorskip("kiwipiepy")


class TestBM25IndexBuild:
    """BM25Index 인덱스 구축 테스트"""

    def test_build_index_from_documents(self) -> None:
        """
        문서 리스트로 인덱스 구축

        Given: 문서 3개 (id, content, metadata 포함)
        When: build() 호출
        Then: 인덱스 구축 성공, document_count == 3
        """
        from app.modules.core.retrieval.bm25_engine.index import BM25Index
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        index = BM25Index(tokenizer=tokenizer)

        documents = [
            {"id": "doc-1", "content": "삼성전자 주가 분석 리포트", "metadata": {"source": "finance"}},
            {"id": "doc-2", "content": "애플 아이폰 신제품 출시", "metadata": {"source": "tech"}},
            {"id": "doc-3", "content": "RAG 시스템 설치 가이드", "metadata": {"source": "docs"}},
        ]
        index.build(documents)

        assert index.document_count == 3

    def test_build_empty_documents(self) -> None:
        """
        빈 문서 리스트로 인덱스 구축

        Given: 빈 리스트
        When: build() 호출
        Then: document_count == 0, 에러 없음
        """
        from app.modules.core.retrieval.bm25_engine.index import BM25Index
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        index = BM25Index(tokenizer=tokenizer)
        index.build([])

        assert index.document_count == 0


class TestBM25IndexSearch:
    """BM25Index 검색 테스트"""

    @pytest.fixture
    def built_index(self):
        """인덱스가 구축된 BM25Index"""
        from app.modules.core.retrieval.bm25_engine.index import BM25Index
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        index = BM25Index(tokenizer=tokenizer)

        documents = [
            {"id": "doc-1", "content": "삼성전자 주가 분석 리포트", "metadata": {"source": "finance"}},
            {"id": "doc-2", "content": "애플 아이폰 신제품 출시 소식", "metadata": {"source": "tech"}},
            {"id": "doc-3", "content": "RAG 시스템 설치 가이드 문서", "metadata": {"source": "docs"}},
            {"id": "doc-4", "content": "삼성전자 반도체 사업 전망", "metadata": {"source": "finance"}},
        ]
        index.build(documents)
        return index

    def test_search_returns_ranked_results(self, built_index) -> None:
        """
        검색 결과가 BM25 점수순으로 정렬

        Given: 4개 문서가 인덱싱된 상태
        When: "삼성전자"로 검색
        Then: 삼성전자가 포함된 문서가 상위에 위치
        """
        results = built_index.search("삼성전자", top_k=4)

        # 검증: 결과가 있음
        assert len(results) > 0
        # 검증: 상위 결과에 삼성전자 관련 문서
        top_ids = [r["id"] for r in results[:2]]
        assert "doc-1" in top_ids or "doc-4" in top_ids

    def test_search_score_normalized(self, built_index) -> None:
        """
        검색 점수가 0~1 범위로 정규화

        Given: 인덱싱된 문서
        When: 검색 수행
        Then: 모든 결과의 score가 0.0 ~ 1.0 범위
        """
        results = built_index.search("삼성전자 주가", top_k=4)

        for result in results:
            assert 0.0 <= result["score"] <= 1.0, (
                f"점수가 범위를 벗어남: {result['score']}"
            )

    def test_search_respects_top_k(self, built_index) -> None:
        """
        top_k 파라미터 존중

        Given: 4개 문서
        When: top_k=2로 검색
        Then: 최대 2개 결과 반환
        """
        results = built_index.search("삼성전자", top_k=2)

        assert len(results) <= 2

    def test_search_returns_metadata(self, built_index) -> None:
        """
        검색 결과에 메타데이터 포함

        Given: 메타데이터가 있는 문서
        When: 검색 수행
        Then: 결과에 metadata 딕셔너리 포함
        """
        results = built_index.search("삼성전자", top_k=1)

        assert len(results) > 0
        assert "metadata" in results[0]
        assert "source" in results[0]["metadata"]

    def test_search_empty_index(self) -> None:
        """
        빈 인덱스에서 검색

        Given: 빈 인덱스
        When: 검색 수행
        Then: 빈 리스트 반환, 에러 없음
        """
        from app.modules.core.retrieval.bm25_engine.index import BM25Index
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        index = BM25Index(tokenizer=tokenizer)
        index.build([])

        results = index.search("아무거나", top_k=10)

        assert results == []

    def test_search_no_match(self, built_index) -> None:
        """
        매칭되지 않는 쿼리

        Given: 인덱싱된 문서
        When: 매칭되지 않는 쿼리로 검색
        Then: 빈 리스트 또는 매우 낮은 점수의 결과
        """
        results = built_index.search("zyxwvuts", top_k=4)

        # 결과가 없거나, 있더라도 점수가 매우 낮아야 함
        if results:
            assert all(r["score"] < 0.1 for r in results)


class TestBM25IndexResultFormat:
    """BM25Index 결과 형식 테스트"""

    def test_result_contains_required_fields(self) -> None:
        """
        결과 딕셔너리에 필수 필드 포함

        Given: 인덱싱된 문서
        When: 검색 수행
        Then: 각 결과에 id, content, score, metadata 포함
        """
        from app.modules.core.retrieval.bm25_engine.index import BM25Index
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        index = BM25Index(tokenizer=tokenizer)
        index.build([
            {"id": "doc-1", "content": "테스트 문서", "metadata": {"source": "test"}},
        ])

        results = index.search("테스트", top_k=1)

        assert len(results) == 1
        result = results[0]
        assert "id" in result
        assert "content" in result
        assert "score" in result
        assert "metadata" in result
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run pytest tests/unit/retrieval/bm25_engine/test_index.py -v --timeout=10`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.modules.core.retrieval.bm25_engine.index'`

**Step 3: 최소 구현 작성**

`app/modules/core/retrieval/bm25_engine/index.py`:
```python
"""
BM25 검색 인덱스

rank-bm25 라이브러리를 래핑하여 Python 기반 BM25 키워드 검색을 제공합니다.
Weaviate/Qdrant 등 DB 내장 BM25가 없는 환경에서 사용됩니다.

의존성:
- rank-bm25: pip install rank-bm25 (선택적)
- KoreanTokenizer: 한국어 형태소 분석 (Task 1에서 구현)
"""

from __future__ import annotations

import logging
import math
from typing import Any

from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

logger = logging.getLogger(__name__)


class BM25Index:
    """
    rank-bm25 기반 BM25 검색 인덱스

    문서를 토큰화하여 BM25 인덱스를 구축하고,
    쿼리에 대한 키워드 기반 점수를 계산합니다.

    Args:
        tokenizer: 한국어 토크나이저 (DI 주입)

    사용 예시:
        tokenizer = KoreanTokenizer()
        index = BM25Index(tokenizer=tokenizer)
        index.build([
            {"id": "1", "content": "문서 내용", "metadata": {}},
        ])
        results = index.search("검색어", top_k=5)
    """

    def __init__(self, tokenizer: KoreanTokenizer) -> None:
        self._tokenizer = tokenizer
        self._bm25 = None
        self._documents: list[dict[str, Any]] = []
        self._tokenized_corpus: list[list[str]] = []

        logger.info("BM25Index 초기화 완료")

    @property
    def document_count(self) -> int:
        """인덱싱된 문서 수"""
        return len(self._documents)

    def build(self, documents: list[dict[str, Any]]) -> None:
        """
        문서 리스트로 BM25 인덱스 구축

        각 문서는 다음 필드를 포함해야 합니다:
        - id: 문서 ID (str)
        - content: 문서 내용 (str)
        - metadata: 메타데이터 딕셔너리 (dict)

        Args:
            documents: 인덱싱할 문서 리스트
        """
        if not documents:
            self._documents = []
            self._tokenized_corpus = []
            self._bm25 = None
            logger.info("BM25Index: 빈 인덱스 구축")
            return

        try:
            from rank_bm25 import BM25Okapi
        except ImportError as e:
            raise ImportError(
                "BM25Index를 사용하려면 rank-bm25가 필요합니다. "
                "설치: uv add rank-bm25 또는 pip install rank-bm25"
            ) from e

        self._documents = documents

        # 문서 내용을 토큰화
        contents = [doc["content"] for doc in documents]
        self._tokenized_corpus = self._tokenizer.tokenize_batch(contents)

        # BM25 인덱스 구축
        self._bm25 = BM25Okapi(self._tokenized_corpus)

        logger.info(f"BM25Index: {len(documents)}개 문서 인덱싱 완료")

    def search(self, query: str, top_k: int = 10) -> list[dict[str, Any]]:
        """
        BM25 키워드 검색 수행

        Args:
            query: 검색 쿼리
            top_k: 반환할 최대 결과 수

        Returns:
            검색 결과 리스트 (id, content, score, metadata 포함)
            score는 0.0~1.0으로 정규화됨
        """
        if self._bm25 is None or not self._documents:
            return []

        # 쿼리 토큰화
        query_tokens = self._tokenizer.tokenize(query)
        if not query_tokens:
            return []

        # BM25 점수 계산
        raw_scores = self._bm25.get_scores(query_tokens)

        # 점수 정규화 (sigmoid) 및 결과 구성
        results: list[dict[str, Any]] = []
        for idx, raw_score in enumerate(raw_scores):
            if raw_score > 0:
                normalized_score = self._normalize_score(raw_score)
                doc = self._documents[idx]
                results.append({
                    "id": doc["id"],
                    "content": doc["content"],
                    "score": normalized_score,
                    "metadata": doc.get("metadata", {}),
                })

        # 점수 기준 내림차순 정렬 + top_k 제한
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    @staticmethod
    def _normalize_score(raw_score: float) -> float:
        """
        BM25 원시 점수를 0~1 범위로 정규화 (sigmoid 함수)

        BM25 원시 점수 범위: [0, ∞)
        정규화 범위: [0.0, 1.0)
        """
        return 1.0 / (1.0 + math.exp(-raw_score))
```

**Step 4: 테스트 실행하여 통과 확인**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run pytest tests/unit/retrieval/bm25_engine/test_index.py -v --timeout=10`
Expected: PASS

**Step 5: 커밋**

```bash
git add app/modules/core/retrieval/bm25_engine/index.py tests/unit/retrieval/bm25_engine/test_index.py
git commit -m "기능: BM25 검색 인덱스 (BM25 엔진 Phase 1-2)"
```

---

## Task 3: HybridMerger — RRF 기반 결과 병합

**Files:**
- Create: `app/modules/core/retrieval/bm25_engine/hybrid_merger.py`
- Test: `tests/unit/retrieval/bm25_engine/test_hybrid_merger.py`

**Step 1: 실패하는 테스트 작성**

`tests/unit/retrieval/bm25_engine/test_hybrid_merger.py`:
```python
"""
HybridMerger 단위 테스트

Dense 벡터 검색 결과와 BM25 키워드 검색 결과를
RRF(Reciprocal Rank Fusion)로 병합하는 모듈.

테스트 범위:
1. RRF 병합 기본 동작
2. alpha 가중치 조절
3. 중복 문서 처리
4. 한쪽만 결과가 있는 경우
5. 빈 결과 처리
"""

import pytest

from app.modules.core.retrieval.interfaces import SearchResult


class TestHybridMergerBasic:
    """HybridMerger 기본 병합 테스트"""

    def test_merge_both_sources(self) -> None:
        """
        Dense + BM25 결과 병합

        Given: Dense 결과 3개, BM25 결과 3개 (일부 중복)
        When: merge() 호출
        Then: RRF 점수로 정렬된 통합 결과 반환
        """
        from app.modules.core.retrieval.bm25_engine.hybrid_merger import HybridMerger

        merger = HybridMerger(alpha=0.6)

        dense_results = [
            SearchResult(id="doc-1", content="문서1", score=0.95, metadata={}),
            SearchResult(id="doc-2", content="문서2", score=0.85, metadata={}),
            SearchResult(id="doc-3", content="문서3", score=0.75, metadata={}),
        ]

        bm25_results = [
            {"id": "doc-2", "content": "문서2", "score": 0.90, "metadata": {}},
            {"id": "doc-4", "content": "문서4", "score": 0.80, "metadata": {}},
            {"id": "doc-1", "content": "문서1", "score": 0.70, "metadata": {}},
        ]

        merged = merger.merge(
            dense_results=dense_results,
            bm25_results=bm25_results,
            top_k=5,
        )

        # 검증: 중복 제거 후 결과 반환
        result_ids = [r.id for r in merged]
        assert len(merged) <= 5
        # 중복 문서(doc-1, doc-2)는 한 번만 등장
        assert len(result_ids) == len(set(result_ids))
        # 두 소스 모두에 있는 doc-2가 높은 순위
        assert "doc-2" in result_ids[:2]

    def test_merge_returns_search_result_type(self) -> None:
        """
        병합 결과가 SearchResult 타입

        Given: Dense + BM25 결과
        When: merge() 호출
        Then: list[SearchResult] 반환
        """
        from app.modules.core.retrieval.bm25_engine.hybrid_merger import HybridMerger

        merger = HybridMerger()

        dense_results = [
            SearchResult(id="doc-1", content="문서1", score=0.9, metadata={"src": "dense"}),
        ]
        bm25_results = [
            {"id": "doc-2", "content": "문서2", "score": 0.8, "metadata": {"src": "bm25"}},
        ]

        merged = merger.merge(dense_results=dense_results, bm25_results=bm25_results, top_k=5)

        assert all(isinstance(r, SearchResult) for r in merged)


class TestHybridMergerAlpha:
    """HybridMerger alpha 가중치 테스트"""

    def test_alpha_1_favors_dense(self) -> None:
        """
        alpha=1.0이면 Dense 결과만 반영

        Given: alpha=1.0 (100% Dense)
        When: merge() 호출
        Then: Dense 최상위 문서가 1위
        """
        from app.modules.core.retrieval.bm25_engine.hybrid_merger import HybridMerger

        merger = HybridMerger(alpha=1.0)

        dense_results = [
            SearchResult(id="dense-top", content="Dense 최상위", score=0.99, metadata={}),
        ]
        bm25_results = [
            {"id": "bm25-top", "content": "BM25 최상위", "score": 0.99, "metadata": {}},
        ]

        merged = merger.merge(dense_results=dense_results, bm25_results=bm25_results, top_k=2)

        assert merged[0].id == "dense-top"

    def test_alpha_0_favors_bm25(self) -> None:
        """
        alpha=0.0이면 BM25 결과만 반영

        Given: alpha=0.0 (100% BM25)
        When: merge() 호출
        Then: BM25 최상위 문서가 1위
        """
        from app.modules.core.retrieval.bm25_engine.hybrid_merger import HybridMerger

        merger = HybridMerger(alpha=0.0)

        dense_results = [
            SearchResult(id="dense-top", content="Dense 최상위", score=0.99, metadata={}),
        ]
        bm25_results = [
            {"id": "bm25-top", "content": "BM25 최상위", "score": 0.99, "metadata": {}},
        ]

        merged = merger.merge(dense_results=dense_results, bm25_results=bm25_results, top_k=2)

        assert merged[0].id == "bm25-top"


class TestHybridMergerEdgeCases:
    """HybridMerger 엣지 케이스 테스트"""

    def test_merge_only_dense(self) -> None:
        """
        BM25 결과 없이 Dense 결과만 있는 경우

        Given: Dense 결과만 존재
        When: merge() 호출
        Then: Dense 결과만 반환
        """
        from app.modules.core.retrieval.bm25_engine.hybrid_merger import HybridMerger

        merger = HybridMerger()

        dense_results = [
            SearchResult(id="doc-1", content="문서1", score=0.9, metadata={}),
        ]

        merged = merger.merge(dense_results=dense_results, bm25_results=[], top_k=5)

        assert len(merged) == 1
        assert merged[0].id == "doc-1"

    def test_merge_only_bm25(self) -> None:
        """
        Dense 결과 없이 BM25 결과만 있는 경우

        Given: BM25 결과만 존재
        When: merge() 호출
        Then: BM25 결과만 반환
        """
        from app.modules.core.retrieval.bm25_engine.hybrid_merger import HybridMerger

        merger = HybridMerger()

        bm25_results = [
            {"id": "doc-1", "content": "문서1", "score": 0.8, "metadata": {}},
        ]

        merged = merger.merge(dense_results=[], bm25_results=bm25_results, top_k=5)

        assert len(merged) == 1
        assert merged[0].id == "doc-1"

    def test_merge_both_empty(self) -> None:
        """
        양쪽 모두 빈 결과

        Given: Dense, BM25 모두 빈 리스트
        When: merge() 호출
        Then: 빈 리스트 반환
        """
        from app.modules.core.retrieval.bm25_engine.hybrid_merger import HybridMerger

        merger = HybridMerger()
        merged = merger.merge(dense_results=[], bm25_results=[], top_k=5)

        assert merged == []

    def test_merge_respects_top_k(self) -> None:
        """
        top_k 파라미터 존중

        Given: 6개 문서 (Dense 3 + BM25 3, 중복 없음)
        When: top_k=3으로 merge() 호출
        Then: 최대 3개 결과 반환
        """
        from app.modules.core.retrieval.bm25_engine.hybrid_merger import HybridMerger

        merger = HybridMerger()

        dense_results = [
            SearchResult(id=f"dense-{i}", content=f"D{i}", score=0.9 - i * 0.1, metadata={})
            for i in range(3)
        ]
        bm25_results = [
            {"id": f"bm25-{i}", "content": f"B{i}", "score": 0.9 - i * 0.1, "metadata": {}}
            for i in range(3)
        ]

        merged = merger.merge(dense_results=dense_results, bm25_results=bm25_results, top_k=3)

        assert len(merged) <= 3
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run pytest tests/unit/retrieval/bm25_engine/test_hybrid_merger.py -v --timeout=10`
Expected: FAIL — `ModuleNotFoundError`

**Step 3: 최소 구현 작성**

`app/modules/core/retrieval/bm25_engine/hybrid_merger.py`:
```python
"""
하이브리드 검색 결과 병합기

Dense 벡터 검색 결과와 BM25 키워드 검색 결과를
RRF(Reciprocal Rank Fusion) 알고리즘으로 병합합니다.

alpha 파라미터로 두 소스 간 가중치를 조절합니다:
- alpha=1.0: Dense 100%
- alpha=0.0: BM25 100%
- alpha=0.6: Dense 60% + BM25 40% (기본값, Weaviate와 동일)
"""

from __future__ import annotations

import logging
from typing import Any

from app.modules.core.retrieval.interfaces import SearchResult

logger = logging.getLogger(__name__)

# RRF 상수 (일반적으로 60 사용)
_RRF_K = 60


class HybridMerger:
    """
    RRF 기반 하이브리드 검색 결과 병합기

    Dense 벡터 검색과 BM25 키워드 검색의 결과를
    Reciprocal Rank Fusion으로 결합합니다.

    Args:
        alpha: Dense 가중치 (0.0 ~ 1.0, 기본값: 0.6)
            - 1.0: Dense 100%, BM25 0%
            - 0.0: Dense 0%, BM25 100%

    사용 예시:
        merger = HybridMerger(alpha=0.6)
        merged = merger.merge(
            dense_results=dense_results,
            bm25_results=bm25_results,
            top_k=10,
        )
    """

    def __init__(self, alpha: float = 0.6) -> None:
        if not 0.0 <= alpha <= 1.0:
            raise ValueError(f"alpha는 0.0~1.0 범위여야 합니다: {alpha}")

        self._alpha = alpha
        logger.info(f"HybridMerger 초기화 (alpha={alpha})")

    def merge(
        self,
        dense_results: list[SearchResult],
        bm25_results: list[dict[str, Any]],
        top_k: int = 10,
    ) -> list[SearchResult]:
        """
        Dense + BM25 결과를 RRF로 병합

        Args:
            dense_results: Dense 벡터 검색 결과 (SearchResult 리스트)
            bm25_results: BM25 키워드 검색 결과 (dict 리스트: id, content, score, metadata)
            top_k: 반환할 최대 결과 수

        Returns:
            RRF 점수로 정렬된 SearchResult 리스트
        """
        if not dense_results and not bm25_results:
            return []

        # 문서별 RRF 점수 누적
        rrf_scores: dict[str, float] = {}
        # 문서 정보 저장 (content, metadata)
        doc_info: dict[str, dict[str, Any]] = {}

        # Dense 결과 RRF 점수 (alpha 가중치 적용)
        for rank, result in enumerate(dense_results):
            rrf_score = self._alpha * (1.0 / (_RRF_K + rank + 1))
            rrf_scores[result.id] = rrf_scores.get(result.id, 0.0) + rrf_score
            if result.id not in doc_info:
                doc_info[result.id] = {
                    "content": result.content,
                    "metadata": result.metadata,
                }

        # BM25 결과 RRF 점수 ((1 - alpha) 가중치 적용)
        bm25_weight = 1.0 - self._alpha
        for rank, result in enumerate(bm25_results):
            doc_id = result["id"]
            rrf_score = bm25_weight * (1.0 / (_RRF_K + rank + 1))
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + rrf_score
            if doc_id not in doc_info:
                doc_info[doc_id] = {
                    "content": result["content"],
                    "metadata": result.get("metadata", {}),
                }

        # RRF 점수 기준 정렬
        sorted_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)

        # SearchResult로 변환
        merged: list[SearchResult] = []
        for doc_id in sorted_ids[:top_k]:
            info = doc_info[doc_id]
            merged.append(
                SearchResult(
                    id=doc_id,
                    content=info["content"],
                    score=rrf_scores[doc_id],
                    metadata=info["metadata"],
                )
            )

        logger.debug(
            f"HybridMerger: Dense {len(dense_results)}개 + BM25 {len(bm25_results)}개 "
            f"→ 병합 {len(merged)}개 (alpha={self._alpha})"
        )

        return merged
```

**Step 4: 테스트 실행하여 통과 확인**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run pytest tests/unit/retrieval/bm25_engine/test_hybrid_merger.py -v --timeout=10`
Expected: PASS

**Step 5: 커밋**

```bash
git add app/modules/core/retrieval/bm25_engine/hybrid_merger.py tests/unit/retrieval/bm25_engine/test_hybrid_merger.py
git commit -m "기능: RRF 기반 하이브리드 병합기 (BM25 엔진 Phase 1-3)"
```

---

## Task 4: bm25_engine 모듈 exports 및 통합 테스트

**Files:**
- Modify: `app/modules/core/retrieval/bm25_engine/__init__.py`
- Test: `tests/unit/retrieval/bm25_engine/test_integration.py`

**Step 1: 실패하는 테스트 작성**

`tests/unit/retrieval/bm25_engine/test_integration.py`:
```python
"""
BM25 엔진 통합 테스트

KoreanTokenizer + BM25Index + HybridMerger를 연동한 E2E 테스트.
실제 한국어 문서로 하이브리드 검색이 올바르게 동작하는지 검증합니다.
"""

import pytest

# 선택적 의존성 확인
pytest.importorskip("kiwipiepy")
pytest.importorskip("rank_bm25")

from app.modules.core.retrieval.interfaces import SearchResult


class TestBM25EngineIntegration:
    """BM25 엔진 전체 파이프라인 통합 테스트"""

    def test_module_exports(self) -> None:
        """
        bm25_engine 모듈에서 핵심 클래스를 import 가능

        Given: bm25_engine 모듈
        When: import 수행
        Then: KoreanTokenizer, BM25Index, HybridMerger 사용 가능
        """
        from app.modules.core.retrieval.bm25_engine import (
            BM25Index,
            HybridMerger,
            KoreanTokenizer,
        )

        assert KoreanTokenizer is not None
        assert BM25Index is not None
        assert HybridMerger is not None

    def test_full_bm25_search_pipeline(self) -> None:
        """
        전체 BM25 검색 파이프라인

        Given: 한국어 FAQ 문서 5개
        When: "설치 방법"으로 검색
        Then: 설치 관련 문서가 상위에 위치
        """
        from app.modules.core.retrieval.bm25_engine import BM25Index, KoreanTokenizer

        tokenizer = KoreanTokenizer()
        index = BM25Index(tokenizer=tokenizer)

        documents = [
            {"id": "1", "content": "RAG 시스템 설치 방법을 안내합니다. uv sync 명령어로 의존성을 설치하세요.", "metadata": {"category": "설치"}},
            {"id": "2", "content": "채팅 API 사용법입니다. POST /chat/query 엔드포인트를 사용하세요.", "metadata": {"category": "API"}},
            {"id": "3", "content": "환경 변수 설정 가이드입니다. GOOGLE_API_KEY를 설정해야 합니다.", "metadata": {"category": "설정"}},
            {"id": "4", "content": "DI 컨테이너는 의존성 주입 패턴으로 구현되어 있습니다.", "metadata": {"category": "아키텍처"}},
            {"id": "5", "content": "테스트 실행은 make test 명령어를 사용합니다. pytest 기반입니다.", "metadata": {"category": "개발"}},
        ]
        index.build(documents)

        results = index.search("설치 방법", top_k=3)

        # 검증: 설치 관련 문서가 1위
        assert len(results) > 0
        assert results[0]["id"] == "1"

    def test_hybrid_merge_with_real_bm25(self) -> None:
        """
        실제 BM25 결과 + 모의 Dense 결과 병합

        Given: BM25 실제 검색 결과 + Mock Dense 결과
        When: HybridMerger로 병합
        Then: 양쪽에 있는 문서가 높은 RRF 점수
        """
        from app.modules.core.retrieval.bm25_engine import (
            BM25Index,
            HybridMerger,
            KoreanTokenizer,
        )

        # BM25 인덱스 구축
        tokenizer = KoreanTokenizer()
        index = BM25Index(tokenizer=tokenizer)
        index.build([
            {"id": "doc-1", "content": "RAG 시스템 설치 가이드", "metadata": {}},
            {"id": "doc-2", "content": "채팅 API 사용 방법", "metadata": {}},
            {"id": "doc-3", "content": "설치 환경 설정 안내", "metadata": {}},
        ])

        bm25_results = index.search("설치", top_k=3)

        # Dense 결과 (Mock)
        dense_results = [
            SearchResult(id="doc-3", content="설치 환경 설정 안내", score=0.92, metadata={}),
            SearchResult(id="doc-1", content="RAG 시스템 설치 가이드", score=0.88, metadata={}),
            SearchResult(id="doc-2", content="채팅 API 사용 방법", score=0.75, metadata={}),
        ]

        # 하이브리드 병합
        merger = HybridMerger(alpha=0.6)
        merged = merger.merge(
            dense_results=dense_results,
            bm25_results=bm25_results,
            top_k=3,
        )

        # 검증: 병합된 결과가 SearchResult 타입
        assert len(merged) > 0
        assert all(isinstance(r, SearchResult) for r in merged)
        # 검증: 양쪽에 모두 있는 문서가 상위에 위치
        top_ids = {r.id for r in merged[:2]}
        assert "doc-1" in top_ids or "doc-3" in top_ids

    def test_bm25_with_stopword_filter(self) -> None:
        """
        기존 StopwordFilter와 연동한 검색 품질 검증

        Given: StopwordFilter가 주입된 토크나이저
        When: 불용어가 포함된 쿼리로 검색
        Then: 불용어 제거 후 핵심 키워드로 검색
        """
        from app.modules.core.retrieval.bm25.stopwords import StopwordFilter
        from app.modules.core.retrieval.bm25_engine import BM25Index, KoreanTokenizer

        stopword_filter = StopwordFilter(use_defaults=True, enabled=True)
        tokenizer = KoreanTokenizer(stopword_filter=stopword_filter)
        index = BM25Index(tokenizer=tokenizer)

        index.build([
            {"id": "1", "content": "맛집 추천 리스트", "metadata": {}},
            {"id": "2", "content": "관광지 정보 안내", "metadata": {}},
        ])

        # "있는 맛집 같은" → 불용어 "있는", "같은" 제거 → "맛집"으로 검색
        results = index.search("있는 맛집 같은", top_k=2)

        assert len(results) > 0
        assert results[0]["id"] == "1"
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run pytest tests/unit/retrieval/bm25_engine/test_integration.py -v --timeout=10`
Expected: FAIL — `ImportError: cannot import name 'KoreanTokenizer' from 'app.modules.core.retrieval.bm25_engine'`

**Step 3: __init__.py 수정하여 exports 추가**

`app/modules/core/retrieval/bm25_engine/__init__.py`:
```python
"""
BM25 실행 엔진 모듈

벡터 DB가 BM25를 내장하지 않는 경우(ChromaDB, pgvector, MongoDB)에
Python 기반 독립 BM25 검색을 제공합니다.

구성요소:
- KoreanTokenizer: Kiwi 기반 한국어 형태소 토크나이저
- BM25Index: rank-bm25 래핑 인덱스
- HybridMerger: Dense + BM25 결과 RRF 병합

의존성 (선택적):
- kiwipiepy: pip install kiwipiepy
- rank-bm25: pip install rank-bm25
"""

from app.modules.core.retrieval.bm25_engine.hybrid_merger import HybridMerger
from app.modules.core.retrieval.bm25_engine.index import BM25Index
from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

__all__ = [
    "KoreanTokenizer",
    "BM25Index",
    "HybridMerger",
]
```

**Step 4: 테스트 실행하여 통과 확인**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run pytest tests/unit/retrieval/bm25_engine/ -v --timeout=10`
Expected: PASS (전체 bm25_engine 테스트)

**Step 5: 커밋**

```bash
git add app/modules/core/retrieval/bm25_engine/__init__.py tests/unit/retrieval/bm25_engine/test_integration.py
git commit -m "기능: BM25 엔진 통합 및 exports (BM25 엔진 Phase 1-4)"
```

---

## Task 5: ChromaRetriever 하이브리드 검색 확장

**Files:**
- Modify: `app/modules/core/retrieval/retrievers/chroma_retriever.py`
- Modify: `tests/unit/retrieval/retrievers/test_chroma_retriever.py`

**Step 1: 실패하는 테스트 작성 (기존 테스트 파일에 추가)**

`tests/unit/retrieval/retrievers/test_chroma_retriever.py`에 다음 클래스를 **파일 끝에 추가**:

```python
class TestChromaRetrieverHybridSearch:
    """ChromaRetriever 하이브리드 검색 테스트 (BM25Engine DI 주입)"""

    @pytest.fixture
    def mock_embedder(self) -> MagicMock:
        """Mock Embedder"""
        embedder = MagicMock()
        embedder.embed_query = MagicMock(return_value=[0.1] * 3072)
        return embedder

    @pytest.fixture
    def mock_chroma_store_with_results(self) -> MagicMock:
        """검색 결과를 반환하는 Mock ChromaVectorStore"""
        store = MagicMock()

        async def mock_search(
            collection: str,
            query_vector: list[float],
            top_k: int,
            filters: dict[str, Any] | None = None,
        ) -> list[dict[str, Any]]:
            return [
                {
                    "_id": "doc-1",
                    "_distance": 0.15,
                    "content": "테스트 문서 1",
                    "source": "test1.md",
                    "file_type": "MARKDOWN",
                },
                {
                    "_id": "doc-2",
                    "_distance": 0.25,
                    "content": "테스트 문서 2",
                    "source": "test2.md",
                    "file_type": "MARKDOWN",
                },
            ]

        store.search = mock_search
        return store

    @pytest.fixture
    def mock_bm25_index(self) -> MagicMock:
        """Mock BM25Index"""
        bm25_index = MagicMock()
        bm25_index.search = MagicMock(return_value=[
            {"id": "doc-2", "content": "테스트 문서 2", "score": 0.9, "metadata": {}},
            {"id": "doc-3", "content": "테스트 문서 3", "score": 0.7, "metadata": {}},
        ])
        return bm25_index

    @pytest.fixture
    def mock_hybrid_merger(self) -> MagicMock:
        """Mock HybridMerger"""
        from app.modules.core.retrieval.interfaces import SearchResult

        merger = MagicMock()
        merger.merge = MagicMock(return_value=[
            SearchResult(id="doc-2", content="테스트 문서 2", score=0.95, metadata={}),
            SearchResult(id="doc-1", content="테스트 문서 1", score=0.85, metadata={}),
            SearchResult(id="doc-3", content="테스트 문서 3", score=0.70, metadata={}),
        ])
        return merger

    def test_init_with_bm25_engine(
        self,
        mock_embedder: MagicMock,
        mock_chroma_store_with_results: MagicMock,
        mock_bm25_index: MagicMock,
        mock_hybrid_merger: MagicMock,
    ) -> None:
        """
        BM25 엔진과 함께 초기화

        Given: bm25_index와 hybrid_merger가 주입됨
        When: ChromaRetriever 생성
        Then: 하이브리드 검색 모드로 초기화
        """
        from app.modules.core.retrieval.retrievers.chroma_retriever import ChromaRetriever

        retriever = ChromaRetriever(
            embedder=mock_embedder,
            store=mock_chroma_store_with_results,
            bm25_index=mock_bm25_index,
            hybrid_merger=mock_hybrid_merger,
        )

        assert retriever.embedder == mock_embedder
        assert retriever.store == mock_chroma_store_with_results

    @pytest.mark.asyncio
    async def test_hybrid_search_calls_both_sources(
        self,
        mock_embedder: MagicMock,
        mock_chroma_store_with_results: MagicMock,
        mock_bm25_index: MagicMock,
        mock_hybrid_merger: MagicMock,
    ) -> None:
        """
        하이브리드 검색 시 Dense + BM25 양쪽 호출

        Given: bm25_index와 hybrid_merger가 주입된 retriever
        When: search() 호출
        Then: Dense 검색 + BM25 검색 + Merger 병합 모두 수행
        """
        from app.modules.core.retrieval.retrievers.chroma_retriever import ChromaRetriever

        retriever = ChromaRetriever(
            embedder=mock_embedder,
            store=mock_chroma_store_with_results,
            bm25_index=mock_bm25_index,
            hybrid_merger=mock_hybrid_merger,
        )

        results = await retriever.search(query="테스트 쿼리", top_k=5)

        # 검증: BM25 검색이 호출됨
        mock_bm25_index.search.assert_called_once()
        # 검증: HybridMerger가 호출됨
        mock_hybrid_merger.merge.assert_called_once()
        # 검증: 병합된 결과 반환
        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_without_bm25_falls_back_to_dense(
        self,
        mock_embedder: MagicMock,
        mock_chroma_store_with_results: MagicMock,
    ) -> None:
        """
        BM25 엔진 없이 기존 Dense 전용 동작

        Given: bm25_index가 None인 retriever
        When: search() 호출
        Then: 기존 Dense 전용 검색 수행 (하위 호환성)
        """
        from app.modules.core.retrieval.retrievers.chroma_retriever import ChromaRetriever

        retriever = ChromaRetriever(
            embedder=mock_embedder,
            store=mock_chroma_store_with_results,
        )

        results = await retriever.search(query="테스트 쿼리", top_k=5)

        # 검증: Dense 결과만 반환 (기존 동작 유지)
        assert len(results) == 2
        assert results[0].id == "doc-1"
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run pytest tests/unit/retrieval/retrievers/test_chroma_retriever.py::TestChromaRetrieverHybridSearch -v --timeout=10`
Expected: FAIL — `TypeError: ChromaRetriever.__init__() got an unexpected keyword argument 'bm25_index'`

**Step 3: ChromaRetriever 수정**

`app/modules/core/retrieval/retrievers/chroma_retriever.py`의 `__init__` 메서드에 선택적 BM25 파라미터를 추가합니다.

수정 사항 (기존 코드에 추가):

1. `__init__` 시그니처에 `bm25_index`와 `hybrid_merger` 파라미터 추가 (기본값 None)
2. `search` 메서드에서 `bm25_index`가 있으면 하이브리드, 없으면 기존 Dense 전용 로직

구체적 수정:

`__init__` 메서드의 파라미터에 추가:
```python
    def __init__(
        self,
        embedder: IEmbedder,
        store: IVectorStore,
        collection_name: str = "documents",
        top_k: int = 10,
        # Phase 1: BM25 엔진 DI 주입 (선택적)
        bm25_index: Any | None = None,
        hybrid_merger: Any | None = None,
    ) -> None:
```

`__init__` 본문에 추가:
```python
        # Phase 1: BM25 엔진 (선택적 DI)
        self._bm25_index = bm25_index
        self._hybrid_merger = hybrid_merger
        self._hybrid_enabled = bm25_index is not None and hybrid_merger is not None
```

로그 메시지 수정:
```python
        logger.info(
            f"ChromaRetriever 초기화: collection={collection_name}, "
            f"top_k={top_k}, hybrid={'활성' if self._hybrid_enabled else '비활성'}"
        )
```

`search` 메서드 수정 — Dense 검색 수행 후 분기:
```python
        # 기존 Dense 검색 코드 그대로 유지 (1. 쿼리 벡터화, 2. store.search, 3. 변환)
        # ... 기존 코드 ...

        # 3. SearchResult로 변환 (기존 코드)
        dense_results = self._convert_to_search_results(raw_results)

        # Phase 1: 하이브리드 검색 (BM25 엔진이 주입된 경우)
        if self._hybrid_enabled:
            bm25_results = self._bm25_index.search(query, top_k=top_k)
            results = self._hybrid_merger.merge(
                dense_results=dense_results,
                bm25_results=bm25_results,
                top_k=top_k,
            )
        else:
            results = dense_results

        # 4. 통계 업데이트
        self._stats["total_searches"] += 1
```

**Step 4: 테스트 실행하여 통과 확인**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run pytest tests/unit/retrieval/retrievers/test_chroma_retriever.py -v --timeout=10`
Expected: PASS (기존 테스트 + 새 하이브리드 테스트 모두 통과)

**Step 5: 커밋**

```bash
git add app/modules/core/retrieval/retrievers/chroma_retriever.py tests/unit/retrieval/retrievers/test_chroma_retriever.py
git commit -m "기능: ChromaRetriever 하이브리드 검색 확장 (BM25 엔진 Phase 1-5)"
```

---

## Task 6: RetrieverFactory 및 DI 컨테이너 업데이트

**Files:**
- Modify: `app/modules/core/retrieval/retrievers/factory.py`
- Modify: `app/core/di_container.py`
- Test: `tests/unit/retrieval/retrievers/test_retriever_factory.py` (기존 테스트에 케이스 추가)

**Step 1: 실패하는 테스트 작성**

`tests/unit/retrieval/retrievers/test_retriever_factory.py`에 다음 테스트를 **파일 끝에 추가**:

```python
class TestRetrieverFactoryBM25EngineIntegration:
    """RetrieverFactory BM25 엔진 통합 테스트"""

    def test_chroma_hybrid_support_flag(self) -> None:
        """
        ChromaDB의 hybrid_support 플래그가 True인지 확인

        Given: RetrieverFactory
        When: supports_hybrid("chroma") 확인
        Then: True 반환 (BM25 엔진을 통한 하이브리드 지원)
        """
        from app.modules.core.retrieval.retrievers.factory import RetrieverFactory

        assert RetrieverFactory.supports_hybrid("chroma") is True

    def test_chroma_create_with_bm25_preprocessors(self) -> None:
        """
        ChromaDB Retriever 생성 시 BM25 전처리 모듈 주입

        Given: bm25_preprocessors가 포함된 설정
        When: RetrieverFactory.create("chroma", ...) 호출
        Then: BM25 전처리 모듈이 주입됨 (에러 없음)
        """
        from unittest.mock import MagicMock

        from app.modules.core.retrieval.retrievers.factory import RetrieverFactory

        mock_embedder = MagicMock()
        mock_store = MagicMock()

        # bm25_preprocessors에 bm25_index와 hybrid_merger 포함
        bm25_preprocessors = {
            "bm25_index": MagicMock(),
            "hybrid_merger": MagicMock(),
        }

        retriever = RetrieverFactory.create(
            provider="chroma",
            embedder=mock_embedder,
            config={
                "store": mock_store,
                "collection_name": "documents",
                "top_k": 10,
            },
            bm25_preprocessors=bm25_preprocessors,
        )

        assert retriever is not None
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run pytest tests/unit/retrieval/retrievers/test_retriever_factory.py::TestRetrieverFactoryBM25EngineIntegration -v --timeout=10`
Expected: FAIL — `AssertionError: assert False is True` (ChromaDB hybrid_support가 아직 False)

**Step 3: factory.py 수정**

`app/modules/core/retrieval/retrievers/factory.py`에서 ChromaDB의 `hybrid_support`를 `True`로 변경:

```python
    "chroma": {
        "class_path": "app.modules.core.retrieval.retrievers.chroma_retriever.ChromaRetriever",
        "hybrid_support": True,  # Phase 1: BM25 엔진을 통한 하이브리드 지원
        "description": "Chroma 하이브리드 Retriever - Dense + BM25 검색 지원 (BM25 엔진 필요)",
    },
```

**Step 4: di_container.py 수정**

`app/core/di_container.py`의 `create_retriever_via_factory` 함수에서 ChromaDB provider 설정에 BM25 엔진 관련 설정을 추가합니다.

chroma 분기의 bm25_preprocessors 구성에 bm25_index와 hybrid_merger를 포함:

```python
    # BM25 엔진 (Phase 1: Dense 전용 DB의 하이브리드 지원)
    bm25_preprocessors: dict[str, Any] | None = None
    if RetrieverFactory.supports_hybrid(provider):
        if provider == "weaviate":
            # Weaviate는 기존 전처리 모듈만 주입 (BM25 실행은 Weaviate 내장)
            bm25_preprocessors = {
                "synonym_manager": synonym_manager,
                "stopword_filter": stopword_filter,
                "user_dictionary": user_dictionary,
            }
        elif provider in ("chroma", "pgvector", "mongodb"):
            # Dense 전용 DB는 BM25 엔진 주입 (선택적)
            try:
                from app.modules.core.retrieval.bm25_engine import (
                    BM25Index,
                    HybridMerger,
                    KoreanTokenizer,
                )

                tokenizer = KoreanTokenizer(
                    stopword_filter=stopword_filter,
                    synonym_manager=synonym_manager,
                    user_dictionary=user_dictionary,
                )
                bm25_index = BM25Index(tokenizer=tokenizer)
                hybrid_merger = HybridMerger(
                    alpha=config.get("hybrid_search", {}).get("default_alpha", 0.6)
                )

                bm25_preprocessors = {
                    "bm25_index": bm25_index,
                    "hybrid_merger": hybrid_merger,
                }
                logger.info(f"BM25 엔진 주입 완료 (provider={provider})")

            except ImportError:
                logger.warning(
                    f"BM25 엔진 의존성 미설치 - {provider}는 Dense 전용으로 동작합니다. "
                    "하이브리드 검색을 사용하려면: uv add kiwipiepy rank-bm25"
                )
                bm25_preprocessors = None
        else:
            # Pinecone, Qdrant 등은 기존 전처리 모듈 주입
            bm25_preprocessors = {
                "synonym_manager": synonym_manager,
                "stopword_filter": stopword_filter,
                "user_dictionary": user_dictionary,
            }
```

**Step 5: 테스트 실행하여 통과 확인**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run pytest tests/unit/retrieval/retrievers/test_retriever_factory.py -v --timeout=10`
Expected: PASS (기존 테스트 + 새 테스트 모두 통과)

**Step 6: 전체 테스트 스위트 실행**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && ENVIRONMENT=test uv run pytest tests/unit/ --timeout=5 -x -q`
Expected: 기존 1,707개 테스트 + 새 테스트 모두 PASS

**Step 7: 커밋**

```bash
git add app/modules/core/retrieval/retrievers/factory.py app/core/di_container.py tests/unit/retrieval/retrievers/test_retriever_factory.py
git commit -m "기능: RetrieverFactory/DI 하이브리드 확장 (BM25 엔진 Phase 1-6)"
```

---

## Task 7: 선택적 의존성 등록 및 린트/타입 검사

**Files:**
- Modify: `pyproject.toml` (선택적 의존성 추가)
- 린트, 타입체크 통과 확인

**Step 1: pyproject.toml에 선택적 의존성 추가**

`pyproject.toml`의 `[project.optional-dependencies]` 섹션에 추가:
```toml
[project.optional-dependencies]
# ... 기존 항목들 ...
bm25 = ["kiwipiepy>=0.18.0", "rank-bm25>=0.2.2"]
```

**Step 2: 의존성 설치**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv sync --extra bm25`
Expected: kiwipiepy, rank-bm25 설치 완료

**Step 3: 린트 검사**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run ruff check app/modules/core/retrieval/bm25_engine/`
Expected: 에러 없음

**Step 4: 타입 검사**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run mypy app/modules/core/retrieval/bm25_engine/`
Expected: 에러 없음 (또는 선택적 의존성 관련 경고만)

**Step 5: Import Linter 검사**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && uv run lint-imports`
Expected: 아키텍처 계층 위반 없음

**Step 6: 전체 테스트 스위트 최종 확인**

Run: `cd /Users/youngouksong/Desktop/youngouk/RAG_Standard && ENVIRONMENT=test uv run pytest tests/unit/ --timeout=5 -q`
Expected: 모든 테스트 PASS

**Step 7: 커밋**

```bash
git add pyproject.toml uv.lock
git commit -m "설정: BM25 엔진 선택적 의존성 추가 (kiwipiepy, rank-bm25)"
```

---

## 최종 검증 체크리스트

- [ ] `tests/unit/retrieval/bm25_engine/test_tokenizer.py` — KoreanTokenizer 테스트 통과
- [ ] `tests/unit/retrieval/bm25_engine/test_index.py` — BM25Index 테스트 통과
- [ ] `tests/unit/retrieval/bm25_engine/test_hybrid_merger.py` — HybridMerger 테스트 통과
- [ ] `tests/unit/retrieval/bm25_engine/test_integration.py` — 통합 테스트 통과
- [ ] `tests/unit/retrieval/retrievers/test_chroma_retriever.py` — 기존 + 하이브리드 테스트 통과
- [ ] `tests/unit/retrieval/retrievers/test_retriever_factory.py` — 팩토리 테스트 통과
- [ ] `ruff check` — 린트 통과
- [ ] `mypy` — 타입 검사 통과
- [ ] `lint-imports` — 아키텍처 계층 검증 통과
- [ ] 기존 테스트 1,707개 모두 PASS (회귀 없음)
