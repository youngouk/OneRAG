"""
quickstart_local 데이터 로드 스크립트 단위 테스트

ChromaDB에 샘플 데이터를 올바르게 적재하는지 검증합니다.
"""


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
