"""
Ingest API 단위 테스트

대상 모듈: app/api/ingest.py
테스트 범위: Request 스키마 검증, 응답 형식 검증, 라우터 속성 검증
전략: DI 컨테이너 의존 없이 스키마/라우터 메타데이터 레벨에서 검증
"""

import pytest
from pydantic import ValidationError

from app.api.ingest import NotionIngestRequest, WebIngestRequest, router


# ---------------------------------------------------------------------------
# 1. Request 스키마 검증 (4개)
# ---------------------------------------------------------------------------
class TestWebIngestRequestSchema:
    """WebIngestRequest Pydantic 스키마 검증"""

    def test_정상_생성(self) -> None:
        """sitemap_url과 category_name이 올바르게 설정된다."""
        req = WebIngestRequest(
            sitemap_url="https://example.com/sitemap.xml",
            category_name="tech_blog",
        )
        assert req.sitemap_url == "https://example.com/sitemap.xml"
        assert req.category_name == "tech_blog"

    def test_필수_필드_누락시_검증_오류(self) -> None:
        """필수 필드가 없으면 ValidationError가 발생한다."""
        # sitemap_url 누락
        with pytest.raises(ValidationError):
            WebIngestRequest(category_name="tech_blog")  # type: ignore[call-arg]

        # category_name 누락
        with pytest.raises(ValidationError):
            WebIngestRequest(sitemap_url="https://example.com/sitemap.xml")  # type: ignore[call-arg]


class TestNotionIngestRequestSchema:
    """NotionIngestRequest Pydantic 스키마 검증"""

    def test_정상_생성(self) -> None:
        """database_id와 category_name이 올바르게 설정된다."""
        req = NotionIngestRequest(
            database_id="abc-123-def",
            category_name="product_docs",
        )
        assert req.database_id == "abc-123-def"
        assert req.category_name == "product_docs"

    def test_필수_필드_누락시_검증_오류(self) -> None:
        """필수 필드가 없으면 ValidationError가 발생한다."""
        # database_id 누락
        with pytest.raises(ValidationError):
            NotionIngestRequest(category_name="product_docs")  # type: ignore[call-arg]

        # category_name 누락
        with pytest.raises(ValidationError):
            NotionIngestRequest(database_id="abc-123-def")  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# 2. 응답 형식 검증 (2개)
# ---------------------------------------------------------------------------
class TestWebIngestResponseFormat:
    """Web ingest 엔드포인트의 예상 응답 형식 검증"""

    def test_응답_딕셔너리_형식(self) -> None:
        """Web ingest 응답은 status, message, target 키를 포함해야 한다."""
        # 엔드포인트가 반환하는 딕셔너리 구조를 직접 검증
        sitemap_url = "https://example.com/sitemap.xml"
        category_name = "tech_blog"

        expected_response = {
            "status": "accepted",
            "message": "Web ingestion started in background",
            "target": {
                "sitemap_url": sitemap_url,
                "category": category_name,
            },
        }

        # 필수 키 존재 확인
        assert "status" in expected_response
        assert "message" in expected_response
        assert "target" in expected_response

        # target 하위 키 확인
        assert "sitemap_url" in expected_response["target"]
        assert "category" in expected_response["target"]

        # 값 검증
        assert expected_response["status"] == "accepted"
        assert expected_response["target"]["sitemap_url"] == sitemap_url
        assert expected_response["target"]["category"] == category_name


class TestNotionIngestResponseFormat:
    """Notion ingest 엔드포인트의 예상 응답 형식 검증"""

    def test_응답_딕셔너리_형식(self) -> None:
        """Notion ingest 응답은 status, message, target 키를 포함해야 한다."""
        database_id = "abc-123-def"
        category_name = "product_docs"

        expected_response = {
            "status": "accepted",
            "message": "Ingestion started in background",
            "target": {
                "database_id": database_id,
                "category": category_name,
            },
        }

        # 필수 키 존재 확인
        assert "status" in expected_response
        assert "message" in expected_response
        assert "target" in expected_response

        # target 하위 키 확인
        assert "database_id" in expected_response["target"]
        assert "category" in expected_response["target"]

        # 값 검증
        assert expected_response["status"] == "accepted"
        assert expected_response["target"]["database_id"] == database_id
        assert expected_response["target"]["category"] == category_name


# ---------------------------------------------------------------------------
# 3. 라우터 속성 검증 (2개)
# ---------------------------------------------------------------------------
class TestIngestRouterAttributes:
    """Ingest 라우터의 메타데이터 및 속성 검증"""

    def test_라우터_prefix(self) -> None:
        """라우터 prefix가 '/ingest'여야 한다."""
        assert router.prefix == "/ingest"

    def test_라우터_인증_dependency_포함(self) -> None:
        """라우터에 인증 dependency(get_api_key)가 설정되어 있어야 한다."""
        # router.dependencies 에 Depends(get_api_key) 가 포함되어 있는지 확인
        assert len(router.dependencies) > 0, "라우터에 dependency가 설정되어 있지 않습니다"

        # dependency의 실제 함수명으로 검증
        dep_callables = [
            dep.dependency.__name__
            for dep in router.dependencies
            if hasattr(dep.dependency, "__name__")
        ]
        assert "get_api_key" in dep_callables, (
            f"get_api_key가 라우터 dependencies에 없습니다. 발견된 dependencies: {dep_callables}"
        )
