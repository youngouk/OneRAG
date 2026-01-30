"""
Rich CLI 챗봇 단위 테스트

CLI 챗봇의 핵심 함수를 테스트합니다.
"""

from unittest.mock import AsyncMock

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
