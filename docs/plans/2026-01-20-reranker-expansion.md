# Reranker 확장 구현 계획 (Cohere + 로컬 리랭커)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cohere Rerank API 리랭커 구현 및 경량 로컬 리랭커(MiniLM) 선택적 의존성 추가

**Architecture:**
- Cohere: 기존 JinaReranker와 동일한 HTTP API 패턴 사용
- 로컬 리랭커: sentence-transformers CrossEncoder 사용, `local-reranker` 선택적 의존성으로 분리
- 두 리랭커 모두 IReranker 프로토콜 준수

**Tech Stack:** httpx (Cohere API), sentence-transformers (로컬), CrossEncoder

---

## Task 1: Cohere Reranker 테스트 작성

**Files:**
- Create: `tests/unit/retrieval/rerankers/test_cohere_reranker.py`

**Step 1: 테스트 파일 작성**

```python
"""
Cohere Reranker 단위 테스트
"""

from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from app.modules.core.retrieval.interfaces import SearchResult


class TestCohereRerankerInit:
    """CohereReranker 초기화 테스트"""

    def test_init_with_valid_api_key(self):
        """유효한 API 키로 초기화"""
        from app.modules.core.retrieval.rerankers.cohere_reranker import CohereReranker

        reranker = CohereReranker(
            api_key="test-key",
            model="rerank-v3.5",
        )
        assert reranker.api_key == "test-key"
        assert reranker.model == "rerank-v3.5"

    def test_init_with_default_model(self):
        """기본 모델로 초기화"""
        from app.modules.core.retrieval.rerankers.cohere_reranker import CohereReranker

        reranker = CohereReranker(api_key="test-key")
        assert reranker.model == "rerank-multilingual-v3.0"


class TestCohereRerankerRerank:
    """CohereReranker.rerank() 테스트"""

    @pytest.fixture
    def sample_results(self):
        """테스트용 검색 결과"""
        return [
            SearchResult(id="1", content="Python은 프로그래밍 언어입니다.", score=0.8, metadata={}),
            SearchResult(id="2", content="Java는 객체지향 언어입니다.", score=0.7, metadata={}),
            SearchResult(id="3", content="Python은 데이터 분석에 좋습니다.", score=0.6, metadata={}),
        ]

    @pytest.mark.asyncio
    async def test_rerank_success(self, sample_results):
        """리랭킹 성공"""
        from app.modules.core.retrieval.rerankers.cohere_reranker import CohereReranker

        reranker = CohereReranker(api_key="test-key")

        # Mock HTTP 응답
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [
                {"index": 2, "relevance_score": 0.95},
                {"index": 0, "relevance_score": 0.85},
                {"index": 1, "relevance_score": 0.60},
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            results = await reranker.rerank("Python이란?", sample_results)

            assert len(results) == 3
            assert results[0].id == "3"  # 가장 높은 점수
            assert results[0].score == 0.95

    @pytest.mark.asyncio
    async def test_rerank_empty_results(self):
        """빈 결과 리랭킹"""
        from app.modules.core.retrieval.rerankers.cohere_reranker import CohereReranker

        reranker = CohereReranker(api_key="test-key")
        results = await reranker.rerank("test query", [])

        assert results == []

    @pytest.mark.asyncio
    async def test_rerank_with_top_n(self, sample_results):
        """top_n 적용"""
        from app.modules.core.retrieval.rerankers.cohere_reranker import CohereReranker

        reranker = CohereReranker(api_key="test-key")

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [
                {"index": 0, "relevance_score": 0.95},
                {"index": 1, "relevance_score": 0.85},
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            results = await reranker.rerank("test", sample_results, top_n=2)

            assert len(results) == 2

    @pytest.mark.asyncio
    async def test_rerank_api_error_returns_original(self, sample_results):
        """API 오류 시 원본 반환"""
        from app.modules.core.retrieval.rerankers.cohere_reranker import CohereReranker

        reranker = CohereReranker(api_key="test-key")

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                side_effect=Exception("API Error")
            )

            results = await reranker.rerank("test", sample_results)

            # 실패 시 원본 반환
            assert len(results) == 3
            assert results[0].id == "1"


class TestCohereRerankerHelpers:
    """CohereReranker 헬퍼 메서드 테스트"""

    def test_supports_caching(self):
        """캐싱 지원 확인"""
        from app.modules.core.retrieval.rerankers.cohere_reranker import CohereReranker

        reranker = CohereReranker(api_key="test-key")
        assert reranker.supports_caching() is True

    def test_get_stats(self):
        """통계 반환"""
        from app.modules.core.retrieval.rerankers.cohere_reranker import CohereReranker

        reranker = CohereReranker(api_key="test-key")
        stats = reranker.get_stats()

        assert "total_requests" in stats
        assert "model" in stats
        assert stats["model"] == "rerank-multilingual-v3.0"
```

**Step 2: 테스트 실행 (실패 확인)**

```bash
ENVIRONMENT=test uv run pytest tests/unit/retrieval/rerankers/test_cohere_reranker.py -v
```

Expected: FAIL - `ModuleNotFoundError: No module named 'app.modules.core.retrieval.rerankers.cohere_reranker'`

---

## Task 2: Cohere Reranker 구현

**Files:**
- Create: `app/modules/core/retrieval/rerankers/cohere_reranker.py`
- Modify: `app/modules/core/retrieval/rerankers/__init__.py`

**Step 3: CohereReranker 클래스 구현**

```python
"""
Cohere Rerank API 기반 리랭커

Cohere의 Rerank API를 사용한 고품질 리랭킹.
100+ 언어 지원, 4096 토큰 컨텍스트.

지원 모델:
- rerank-v3.5 (최신, 권장)
- rerank-multilingual-v3.0 (기본값)
- rerank-english-v3.0 (영어 특화)

참고: https://docs.cohere.com/reference/rerank
"""

from typing import Any

import httpx

from .....lib.logger import get_logger
from ..interfaces import SearchResult

logger = get_logger(__name__)


class CohereReranker:
    """
    Cohere Rerank API 기반 리랭커

    특징:
    - HTTP API를 통한 리랭킹
    - 100+ 언어 지원 (multilingual 모델)
    - 4096 토큰 컨텍스트
    - Graceful Fallback (오류 시 원본 반환)
    """

    def __init__(
        self,
        api_key: str,
        model: str = "rerank-multilingual-v3.0",
        endpoint: str = "https://api.cohere.com/v2/rerank",
        timeout: float = 30.0,
        max_tokens_per_doc: int = 4096,
    ):
        """
        Args:
            api_key: Cohere API 키
            model: 사용할 Cohere Rerank 모델
            endpoint: Cohere API 엔드포인트 URL
            timeout: HTTP 요청 타임아웃 (초)
            max_tokens_per_doc: 문서당 최대 토큰 수
        """
        self.api_key = api_key
        self.model = model
        self.endpoint = endpoint
        self.timeout = timeout
        self.max_tokens_per_doc = max_tokens_per_doc

        # 통계
        self.stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
        }

        logger.info(f"CohereReranker 초기화: model={model}, endpoint={endpoint}")

    async def rerank(
        self,
        query: str,
        results: list[SearchResult],
        top_n: int | None = None,
    ) -> list[SearchResult]:
        """
        검색 결과 리랭킹 (Cohere Rerank API 사용)

        Args:
            query: 사용자 쿼리
            results: 원본 검색 결과
            top_n: 리랭킹 후 반환할 최대 결과 수 (None이면 전체)

        Returns:
            리랭킹된 검색 결과 (스코어가 업데이트됨)
        """
        if not results:
            logger.warning("리랭킹할 결과가 없습니다")
            return []

        self.stats["total_requests"] += 1

        # top_n이 None이면 전체 결과 수 사용
        effective_top_n = top_n if top_n is not None else len(results)

        try:
            # 문서 리스트 생성
            documents = [result.content for result in results]

            # HTTP 요청 데이터 구성
            request_data = {
                "model": self.model,
                "query": query,
                "documents": documents,
                "top_n": min(effective_top_n, len(documents)),
                "max_tokens_per_doc": self.max_tokens_per_doc,
            }

            # HTTP 헤더 구성
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            }

            logger.debug(
                f"Cohere 리랭킹 요청: query='{query[:50]}...', "
                f"documents={len(documents)}, top_n={request_data['top_n']}"
            )

            # HTTP 요청 실행
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.endpoint,
                    json=request_data,
                    headers=headers,
                    timeout=self.timeout,
                )
                response.raise_for_status()

                rerank_response = response.json()

            # 결과 재구성
            reranked_results = []
            for rank_result in rerank_response["results"]:
                original_idx = rank_result["index"]
                original_result = results[original_idx]

                # Cohere relevance_score를 SearchResult.score에 업데이트
                reranked_results.append(
                    SearchResult(
                        id=original_result.id,
                        content=original_result.content,
                        score=rank_result["relevance_score"],
                        metadata=original_result.metadata,
                    )
                )

            self.stats["successful_requests"] += 1
            logger.info(
                f"Cohere 리랭킹 완료: {len(results)} -> {len(reranked_results)}개 결과 반환"
            )

            return reranked_results

        except httpx.HTTPStatusError as e:
            self.stats["failed_requests"] += 1
            logger.error(
                f"Cohere API HTTP 에러: {e.response.status_code} - {e.response.text}"
            )
            return results  # 실패 시 원본 결과 반환

        except httpx.TimeoutException:
            self.stats["failed_requests"] += 1
            logger.error(f"Cohere API 타임아웃 (timeout={self.timeout}s)")
            return results  # 실패 시 원본 결과 반환

        except Exception as e:
            self.stats["failed_requests"] += 1
            logger.error(f"Cohere 리랭킹 실패: {e}")
            return results  # 실패 시 원본 결과 반환

    def supports_caching(self) -> bool:
        """
        캐싱 지원 여부 반환

        Cohere API는 결정론적(deterministic)이므로 캐싱 가능

        Returns:
            True (캐싱 지원)
        """
        return True

    def get_stats(self) -> dict[str, Any]:
        """리랭커 통계 반환"""
        total = self.stats["total_requests"]
        success_rate = (
            self.stats["successful_requests"] / total * 100 if total > 0 else 0.0
        )

        return {
            "total_requests": self.stats["total_requests"],
            "successful_requests": self.stats["successful_requests"],
            "failed_requests": self.stats["failed_requests"],
            "success_rate": round(success_rate, 2),
            "model": self.model,
            "endpoint": self.endpoint,
        }
```

**Step 4: `__init__.py`에 export 추가**

`app/modules/core/retrieval/rerankers/__init__.py` 수정:

```python
# 기존 import 아래에 추가
from .cohere_reranker import CohereReranker

# __all__에 추가
__all__ = [
    # ... 기존 항목들 ...
    "CohereReranker",
]
```

**Step 5: 테스트 실행 (통과 확인)**

```bash
ENVIRONMENT=test uv run pytest tests/unit/retrieval/rerankers/test_cohere_reranker.py -v
```

Expected: PASS

**Step 6: 커밋**

```bash
git add app/modules/core/retrieval/rerankers/cohere_reranker.py \
        app/modules/core/retrieval/rerankers/__init__.py \
        tests/unit/retrieval/rerankers/test_cohere_reranker.py
git commit -m "기능: Cohere Reranker 구현 (cross-encoder approach)

- CohereReranker 클래스 추가
- rerank-multilingual-v3.0 기본 모델
- 100+ 언어 지원, 4096 토큰 컨텍스트
- IReranker 프로토콜 준수

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Factory에 Cohere 등록

**Files:**
- Modify: `app/modules/core/retrieval/rerankers/factory.py`

**Step 7: PROVIDER_REGISTRY에 Cohere 클래스 등록**

`factory.py`의 import 섹션에 추가:

```python
from .cohere_reranker import CohereReranker
```

`PROVIDER_REGISTRY`의 cohere 항목 수정:

```python
"cohere": {
    "class": CohereReranker,  # None에서 변경
    "api_key_env": "COHERE_API_KEY",
    "default_config": {
        "model": "rerank-multilingual-v3.0",
        "top_n": 10,
        "timeout": 30,
    },
},
```

**Step 8: `_create_cross_encoder_reranker` 메서드에 Cohere 분기 추가**

```python
@staticmethod
def _create_cross_encoder_reranker(
    provider: str, config: dict[str, Any]
) -> IReranker:
    """Cross-encoder approach 리랭커 생성"""
    provider_info = PROVIDER_REGISTRY[provider]
    api_key = os.getenv(provider_info["api_key_env"])

    if not api_key:
        raise ValueError(
            f"{provider_info['api_key_env']} 환경변수가 설정되지 않았습니다. "
            f"API key가 필요합니다."
        )

    provider_config = config.get(provider, {})
    defaults = provider_info["default_config"]

    if provider == "jina":
        reranker = JinaReranker(
            api_key=api_key,
            model=provider_config.get("model", defaults["model"]),
            timeout=provider_config.get("timeout", defaults.get("timeout", 30)),
        )
    elif provider == "cohere":
        reranker = CohereReranker(
            api_key=api_key,
            model=provider_config.get("model", defaults["model"]),
            timeout=provider_config.get("timeout", defaults.get("timeout", 30)),
        )
    else:
        raise ValueError(
            f"Cross-encoder approach에서 {provider}는 아직 지원되지 않습니다."
        )

    logger.info(f"✅ {reranker.__class__.__name__} 생성 완료")
    return reranker
```

**Step 9: 레거시 SUPPORTED_RERANKERS에 cohere 추가**

```python
"cohere": {
    "type": "api",
    "class": "CohereReranker",
    "description": "Cohere Rerank API (100+ 언어 지원)",
    "requires_api_key": "COHERE_API_KEY",
    "approach": "cross-encoder",
    "provider": "cohere",
    "default_config": {
        "model": "rerank-multilingual-v3.0",
        "top_n": 10,
        "timeout": 30,
    },
},
```

**Step 10: Factory 테스트 작성 및 실행**

`tests/unit/retrieval/rerankers/test_reranker_factory_v2.py`에 추가:

```python
@patch.dict("os.environ", {"COHERE_API_KEY": "test-key"})
def test_create_cross_encoder_cohere(self):
    """Cross-encoder approach + Cohere provider 리랭커 생성"""
    from app.modules.core.retrieval.rerankers.factory import RerankerFactoryV2

    config = {
        "reranking": {
            "approach": "cross-encoder",
            "provider": "cohere",
            "cohere": {
                "model": "rerank-multilingual-v3.0",
            },
        }
    }
    reranker = RerankerFactoryV2.create(config)
    assert reranker.__class__.__name__ == "CohereReranker"
```

```bash
ENVIRONMENT=test uv run pytest tests/unit/retrieval/rerankers/test_reranker_factory_v2.py -v
```

**Step 11: 커밋**

```bash
git add app/modules/core/retrieval/rerankers/factory.py \
        tests/unit/retrieval/rerankers/test_reranker_factory_v2.py
git commit -m "기능: Factory에 Cohere 리랭커 등록

- PROVIDER_REGISTRY에 CohereReranker 등록
- _create_cross_encoder_reranker에 cohere 분기 추가
- 레거시 SUPPORTED_RERANKERS에 cohere 추가
- Factory 테스트 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: 로컬 리랭커 테스트 작성

**Files:**
- Create: `tests/unit/retrieval/rerankers/test_local_reranker.py`

**Step 12: 로컬 리랭커 테스트 작성**

```python
"""
로컬 CrossEncoder 리랭커 단위 테스트

선택적 의존성: uv sync --extra local-reranker
"""

import pytest

from app.modules.core.retrieval.interfaces import SearchResult


# 선택적 의존성 체크
try:
    from sentence_transformers import CrossEncoder
    HAS_LOCAL_RERANKER = True
except ImportError:
    HAS_LOCAL_RERANKER = False


@pytest.mark.skipif(not HAS_LOCAL_RERANKER, reason="local-reranker 의존성 미설치")
class TestLocalRerankerInit:
    """LocalReranker 초기화 테스트"""

    def test_init_with_default_model(self):
        """기본 모델로 초기화"""
        from app.modules.core.retrieval.rerankers.local_reranker import LocalReranker

        reranker = LocalReranker()
        assert reranker.model_name == "cross-encoder/ms-marco-MiniLM-L-6-v2"

    def test_init_with_custom_model(self):
        """커스텀 모델로 초기화"""
        from app.modules.core.retrieval.rerankers.local_reranker import LocalReranker

        reranker = LocalReranker(model_name="cross-encoder/ms-marco-MiniLM-L-12-v2")
        assert reranker.model_name == "cross-encoder/ms-marco-MiniLM-L-12-v2"


@pytest.mark.skipif(not HAS_LOCAL_RERANKER, reason="local-reranker 의존성 미설치")
class TestLocalRerankerRerank:
    """LocalReranker.rerank() 테스트"""

    @pytest.fixture
    def sample_results(self):
        """테스트용 검색 결과"""
        return [
            SearchResult(id="1", content="Python is a programming language.", score=0.8, metadata={}),
            SearchResult(id="2", content="Java is an object-oriented language.", score=0.7, metadata={}),
            SearchResult(id="3", content="Python is great for data analysis.", score=0.6, metadata={}),
        ]

    @pytest.mark.asyncio
    async def test_rerank_success(self, sample_results):
        """리랭킹 성공"""
        from app.modules.core.retrieval.rerankers.local_reranker import LocalReranker

        reranker = LocalReranker()
        results = await reranker.rerank("What is Python?", sample_results)

        assert len(results) == 3
        # 점수가 재계산되었는지 확인
        assert all(0 <= r.score <= 1 for r in results)

    @pytest.mark.asyncio
    async def test_rerank_empty_results(self):
        """빈 결과 리랭킹"""
        from app.modules.core.retrieval.rerankers.local_reranker import LocalReranker

        reranker = LocalReranker()
        results = await reranker.rerank("test query", [])

        assert results == []

    @pytest.mark.asyncio
    async def test_rerank_with_top_n(self, sample_results):
        """top_n 적용"""
        from app.modules.core.retrieval.rerankers.local_reranker import LocalReranker

        reranker = LocalReranker()
        results = await reranker.rerank("Python", sample_results, top_n=2)

        assert len(results) == 2


@pytest.mark.skipif(not HAS_LOCAL_RERANKER, reason="local-reranker 의존성 미설치")
class TestLocalRerankerHelpers:
    """LocalReranker 헬퍼 메서드 테스트"""

    def test_supports_caching(self):
        """캐싱 지원 확인"""
        from app.modules.core.retrieval.rerankers.local_reranker import LocalReranker

        reranker = LocalReranker()
        assert reranker.supports_caching() is True

    def test_get_stats(self):
        """통계 반환"""
        from app.modules.core.retrieval.rerankers.local_reranker import LocalReranker

        reranker = LocalReranker()
        stats = reranker.get_stats()

        assert "total_requests" in stats
        assert "model_name" in stats
```

**Step 13: 테스트 실행 (실패 확인)**

```bash
ENVIRONMENT=test uv run pytest tests/unit/retrieval/rerankers/test_local_reranker.py -v
```

Expected: FAIL 또는 SKIP (의존성 없으면 SKIP, 있으면 ModuleNotFoundError)

---

## Task 5: 로컬 리랭커 구현

**Files:**
- Create: `app/modules/core/retrieval/rerankers/local_reranker.py`
- Modify: `app/modules/core/retrieval/rerankers/__init__.py`

**Step 14: LocalReranker 클래스 구현**

```python
"""
로컬 CrossEncoder 기반 리랭커

sentence-transformers의 CrossEncoder를 사용한 로컬 리랭킹.
API 키 불필요, 오프라인 사용 가능.

선택적 의존성: uv sync --extra local-reranker

지원 모델:
- cross-encoder/ms-marco-MiniLM-L-6-v2 (기본값, 90MB, 빠름)
- cross-encoder/ms-marco-MiniLM-L-12-v2 (130MB, 더 정확)

참고: https://www.sbert.net/docs/pretrained-models/ce-msmarco.html
"""

from typing import Any

import torch

from .....lib.logger import get_logger
from ..interfaces import SearchResult

logger = get_logger(__name__)


# 선택적 의존성 체크
try:
    from sentence_transformers import CrossEncoder
    HAS_CROSS_ENCODER = True
except ImportError:
    HAS_CROSS_ENCODER = False
    CrossEncoder = None  # type: ignore


class LocalReranker:
    """
    로컬 CrossEncoder 기반 리랭커

    특징:
    - API 키 불필요 (로컬 실행)
    - 오프라인 사용 가능
    - 빠른 추론 속도 (MiniLM 모델)
    - Graceful Fallback (오류 시 원본 반환)

    주의:
    - 선택적 의존성: uv sync --extra local-reranker 필요
    - 첫 실행 시 모델 다운로드 (~90MB)
    """

    def __init__(
        self,
        model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
        device: str | None = None,
        batch_size: int = 32,
    ):
        """
        Args:
            model_name: 사용할 CrossEncoder 모델명
            device: 실행 디바이스 (None이면 자동 감지)
            batch_size: 배치 처리 크기

        Raises:
            ImportError: sentence-transformers가 설치되지 않은 경우
        """
        if not HAS_CROSS_ENCODER:
            raise ImportError(
                "LocalReranker를 사용하려면 sentence-transformers가 필요합니다. "
                "설치: uv sync --extra local-reranker"
            )

        self.model_name = model_name
        self.batch_size = batch_size

        # 디바이스 설정
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = device

        # 모델 로드 (Sigmoid로 0-1 점수 반환)
        logger.info(f"LocalReranker 모델 로드 중: {model_name} (device={device})")
        self.model = CrossEncoder(
            model_name,
            max_length=512,
            device=device,
        )

        # 통계
        self.stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
        }

        logger.info(f"LocalReranker 초기화 완료: model={model_name}")

    async def rerank(
        self,
        query: str,
        results: list[SearchResult],
        top_n: int | None = None,
    ) -> list[SearchResult]:
        """
        검색 결과 리랭킹 (로컬 CrossEncoder 사용)

        Args:
            query: 사용자 쿼리
            results: 원본 검색 결과
            top_n: 리랭킹 후 반환할 최대 결과 수 (None이면 전체)

        Returns:
            리랭킹된 검색 결과 (스코어가 업데이트됨)
        """
        if not results:
            logger.warning("리랭킹할 결과가 없습니다")
            return []

        self.stats["total_requests"] += 1

        try:
            # 쿼리-문서 쌍 생성
            pairs = [(query, result.content) for result in results]

            # CrossEncoder 추론 (동기 함수이므로 직접 호출)
            # MS-MARCO 모델은 logit을 반환하므로 Sigmoid 적용
            scores = self.model.predict(
                pairs,
                batch_size=self.batch_size,
                activation_fct=torch.nn.Sigmoid(),
            )

            # 결과 재구성 (점수 업데이트)
            reranked = []
            for idx, (result, score) in enumerate(zip(results, scores)):
                reranked.append(
                    SearchResult(
                        id=result.id,
                        content=result.content,
                        score=float(score),
                        metadata=result.metadata,
                    )
                )

            # 점수 내림차순 정렬
            reranked.sort(key=lambda x: x.score, reverse=True)

            # top_n 적용
            if top_n is not None:
                reranked = reranked[:top_n]

            self.stats["successful_requests"] += 1
            logger.info(
                f"Local 리랭킹 완료: {len(results)} -> {len(reranked)}개 결과 반환"
            )

            return reranked

        except Exception as e:
            self.stats["failed_requests"] += 1
            logger.error(f"Local 리랭킹 실패: {e}")
            return results  # 실패 시 원본 결과 반환

    def supports_caching(self) -> bool:
        """
        캐싱 지원 여부 반환

        CrossEncoder는 결정론적(deterministic)이므로 캐싱 가능

        Returns:
            True (캐싱 지원)
        """
        return True

    def get_stats(self) -> dict[str, Any]:
        """리랭커 통계 반환"""
        total = self.stats["total_requests"]
        success_rate = (
            self.stats["successful_requests"] / total * 100 if total > 0 else 0.0
        )

        return {
            "total_requests": self.stats["total_requests"],
            "successful_requests": self.stats["successful_requests"],
            "failed_requests": self.stats["failed_requests"],
            "success_rate": round(success_rate, 2),
            "model_name": self.model_name,
            "device": self.device,
        }
```

**Step 15: `__init__.py`에 조건부 export 추가**

```python
# 조건부 import (선택적 의존성)
try:
    from .local_reranker import LocalReranker
    __all__.append("LocalReranker")
except ImportError:
    pass  # local-reranker 의존성 미설치
```

**Step 16: 테스트 실행**

```bash
ENVIRONMENT=test uv run pytest tests/unit/retrieval/rerankers/test_local_reranker.py -v
```

Expected: PASS (sentence-transformers 이미 설치됨) 또는 SKIP

**Step 17: 커밋**

```bash
git add app/modules/core/retrieval/rerankers/local_reranker.py \
        app/modules/core/retrieval/rerankers/__init__.py \
        tests/unit/retrieval/rerankers/test_local_reranker.py
git commit -m "기능: 로컬 CrossEncoder 리랭커 구현

- LocalReranker 클래스 추가
- ms-marco-MiniLM-L-6-v2 기본 모델 (90MB)
- API 키 불필요, 오프라인 사용 가능
- 조건부 import로 선택적 의존성 처리

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Factory에 Local 리랭커 등록 및 선택적 의존성 설정

**Files:**
- Modify: `app/modules/core/retrieval/rerankers/factory.py`
- Modify: `app/config/schemas/reranking.py`
- Modify: `pyproject.toml`

**Step 18: APPROACH_REGISTRY에 local approach 추가**

```python
APPROACH_REGISTRY: dict[str, dict[str, Any]] = {
    "llm": {
        "description": "범용 LLM을 사용한 리랭킹 (언어 이해력 기반)",
        "providers": ["google", "openai", "openrouter"],
    },
    "cross-encoder": {
        "description": "Cross-Encoder 전용 리랭커 (쿼리+문서 쌍 인코딩)",
        "providers": ["jina", "cohere"],
    },
    "late-interaction": {
        "description": "Late-Interaction 리랭커 (토큰 레벨 상호작용, ColBERT)",
        "providers": ["jina"],
    },
    "local": {
        "description": "로컬 CrossEncoder 리랭커 (API 키 불필요)",
        "providers": ["sentence-transformers"],
    },
}
```

**Step 19: PROVIDER_REGISTRY에 sentence-transformers 추가**

```python
"sentence-transformers": {
    "class": None,  # 조건부 로드
    "api_key_env": None,  # API 키 불필요
    "default_config": {
        "model": "cross-encoder/ms-marco-MiniLM-L-6-v2",
        "batch_size": 32,
    },
},
```

**Step 20: `_create_local_reranker` 메서드 추가**

```python
@staticmethod
def _create_local_reranker(
    provider: str, config: dict[str, Any]
) -> IReranker:
    """Local approach 리랭커 생성"""
    try:
        from .local_reranker import LocalReranker
    except ImportError:
        raise ImportError(
            "LocalReranker를 사용하려면 sentence-transformers가 필요합니다. "
            "설치: uv sync --extra local-reranker"
        )

    provider_config = config.get("sentence-transformers", config.get("local", {}))
    defaults = PROVIDER_REGISTRY["sentence-transformers"]["default_config"]

    reranker = LocalReranker(
        model_name=provider_config.get("model", defaults["model"]),
        batch_size=provider_config.get("batch_size", defaults["batch_size"]),
    )

    logger.info(f"✅ {reranker.__class__.__name__} 생성 완료")
    return reranker
```

**Step 21: create() 메서드에 local 분기 추가**

```python
# create() 메서드의 분기문에 추가
elif approach == "local":
    return RerankerFactoryV2._create_local_reranker(provider, reranking_config)
```

**Step 22: reranking.py 스키마에 local approach 추가**

```python
# VALID_APPROACH_PROVIDERS 수정
VALID_APPROACH_PROVIDERS: dict[str, list[str]] = {
    "llm": ["google", "openai", "openrouter"],
    "cross-encoder": ["jina", "cohere"],
    "late-interaction": ["jina"],
    "local": ["sentence-transformers"],
}

# RerankingConfigV2의 approach 필드 수정
approach: Literal["llm", "cross-encoder", "late-interaction", "local"] = Field(
    default="cross-encoder",
    description="리랭킹 기술 방식",
)

# provider 필드 수정
provider: Literal["google", "openai", "jina", "cohere", "openrouter", "sentence-transformers"] = Field(
    default="jina",
    description="서비스 제공자",
)

# LocalProviderConfig 클래스 추가
class LocalProviderConfig(BaseConfig):
    """로컬 CrossEncoder provider 설정"""

    model: str = Field(
        default="cross-encoder/ms-marco-MiniLM-L-6-v2",
        description="CrossEncoder 모델명",
    )
    batch_size: int = Field(
        default=32,
        ge=1,
        le=256,
        description="배치 처리 크기",
    )

# RerankingConfigV2에 local 필드 추가
local: LocalProviderConfig | None = Field(
    default=None,
    alias="sentence-transformers",
    description="로컬 CrossEncoder 설정",
)
```

**Step 23: pyproject.toml에 선택적 의존성 추가**

```toml
# [project.optional-dependencies] 섹션에 추가
local-reranker = [
    # sentence-transformers는 이미 기본 의존성에 포함
    # 여기서는 명시적으로 로컬 리랭커 사용 의도 표시
]
```

참고: sentence-transformers는 이미 기본 의존성에 포함되어 있으므로 추가 패키지 불필요.
`local-reranker` extra는 의도 표시 및 향후 확장용.

**Step 24: 전체 테스트 실행**

```bash
ENVIRONMENT=test uv run pytest tests/unit/retrieval/rerankers/ -v
```

**Step 25: 커밋**

```bash
git add app/modules/core/retrieval/rerankers/factory.py \
        app/config/schemas/reranking.py \
        pyproject.toml
git commit -m "기능: Factory에 Local 리랭커 등록

- APPROACH_REGISTRY에 local approach 추가
- PROVIDER_REGISTRY에 sentence-transformers 추가
- _create_local_reranker 메서드 구현
- RerankingConfigV2에 local approach/provider 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: YAML 설정 및 문서 업데이트

**Files:**
- Modify: `app/config/features/reranking.yaml`
- Modify: `docs/TECHNICAL_DEBT_ANALYSIS.md`
- Modify: `CLAUDE.md`

**Step 26: reranking.yaml에 새 provider 추가**

```yaml
# Cohere - cross-encoder용
cohere:
  model: "rerank-multilingual-v3.0"
  top_n: 10
  timeout: 30

# Local - API 키 불필요
local:
  model: "cross-encoder/ms-marco-MiniLM-L-6-v2"
  batch_size: 32
```

**Step 27: 문서 업데이트**

CLAUDE.md:
- Reranker 설정 v2 섹션에 Cohere, Local 추가
- approach 목록에 `local` 추가

TECHNICAL_DEBT_ANALYSIS.md:
- Reranker provider 목록에 cohere, sentence-transformers 추가

**Step 28: 전체 테스트 실행**

```bash
ENVIRONMENT=test uv run pytest --tb=short -q
```

**Step 29: 커밋**

```bash
git add app/config/features/reranking.yaml \
        docs/TECHNICAL_DEBT_ANALYSIS.md \
        CLAUDE.md
git commit -m "문서: Reranker 확장 문서화

- reranking.yaml에 cohere, local 설정 추가
- CLAUDE.md에 새 리랭커 문서화
- approach 목록에 local 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: 최종 검증 및 태그

**Step 30: 전체 테스트 실행**

```bash
ENVIRONMENT=test uv run pytest --tb=short -q
```

**Step 31: 린트 및 타입 체크**

```bash
make lint
make type-check
```

**Step 32: 버전 태그 생성**

```bash
git tag -a v1.2.1 -m "v1.2.1 - Reranker 확장 (Cohere + Local)

## 신규 리랭커
- CohereReranker: Cohere Rerank API (100+ 언어)
- LocalReranker: 로컬 CrossEncoder (API 키 불필요)

## approach 확장
- local: 로컬 리랭커용 새 approach
- sentence-transformers: 로컬 provider

## 지원 현황
| approach | provider |
|----------|----------|
| llm | google, openai, openrouter |
| cross-encoder | jina, cohere |
| late-interaction | jina |
| local | sentence-transformers |
"

git push origin main --tags
```

---

## 요약

| Task | 내용 | 예상 시간 |
|------|------|----------|
| 1 | Cohere Reranker 테스트 작성 | 5분 |
| 2 | Cohere Reranker 구현 | 10분 |
| 3 | Factory에 Cohere 등록 | 5분 |
| 4 | 로컬 리랭커 테스트 작성 | 5분 |
| 5 | 로컬 리랭커 구현 | 10분 |
| 6 | Factory에 Local 등록 + 스키마 | 10분 |
| 7 | YAML 및 문서 업데이트 | 5분 |
| 8 | 최종 검증 및 태그 | 5분 |

**총 예상: 8 Tasks, ~55분**
