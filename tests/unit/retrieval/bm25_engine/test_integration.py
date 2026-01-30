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
