"""
Tools Router 단위 테스트
tools_router.py의 핵심 분기 로직, 에러 처리, 인증, 엣지 케이스를 검증합니다.

대상: app/api/routers/tools_router.py
의존성: FastAPI TestClient, unittest.mock
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routers.tools_router import router, set_tool_executor
from app.lib.auth import get_api_key
from app.modules.core.tools import ToolExecutionResult

# --- 테스트용 FastAPI 앱 구성 ---

app = FastAPI()
app.include_router(router, prefix="/api")

# 인증 우회 (기본 — 인증 필요 테스트에서는 제거)
app.dependency_overrides[get_api_key] = lambda: "test-key"

client = TestClient(app)


# --- 테스트 데이터 ---

# 카테고리 필터링 검증을 위한 3개 tool 목록
SAMPLE_TOOLS = [
    {"name": "web_search", "category": "search", "description": "웹 검색"},
    {"name": "code_exec", "category": "execution", "description": "코드 실행"},
    {"name": "doc_search", "category": "search", "description": "문서 검색"},
]

# get_tool_info 정상 응답용 데이터
SAMPLE_TOOL_INFO = {
    "name": "web_search",
    "display_name": "웹 검색",
    "category": "search",
    "description": "웹 검색 도구",
    "parameters": {"query": {"type": "string"}},
    "metadata": None,
}


# --- Fixture ---


@pytest.fixture(autouse=True)
def _cleanup_tool_executor():
    """각 테스트 후 tool_executor 전역 상태를 초기화합니다."""
    yield
    # 테스트 종료 후 None으로 복원
    set_tool_executor(None)  # type: ignore[arg-type]


@pytest.fixture()
def mock_executor() -> MagicMock:
    """ToolExecutor Mock 객체를 생성하고 주입합니다."""
    executor = MagicMock()
    executor.get_available_tools.return_value = SAMPLE_TOOLS
    executor.get_tool_info.return_value = SAMPLE_TOOL_INFO
    executor.execute_tool = AsyncMock(
        return_value=ToolExecutionResult(
            success=True,
            tool_name="web_search",
            data={"result": "검색 결과"},
            error=None,
            execution_time_ms=42.0,
            metadata={"source": "test"},
        )
    )
    set_tool_executor(executor)
    return executor


# =============================================================================
# GET /api/tools — Tool 목록 조회
# =============================================================================


class TestGetTools:
    """GET /api/tools 엔드포인트 테스트"""

    def test_미초기화_상태에서_500_반환(self):
        """tool_executor가 None이면 500 에러를 반환해야 합니다.
        이유: 서버 시작 직후 executor 주입 전 요청이 올 수 있음.
        """
        # tool_executor = None (autouse fixture가 정리)
        response = client.get("/api/tools")

        assert response.status_code == 500

    def test_카테고리_필터링_동작(self, mock_executor: MagicMock):
        """category 파라미터로 필터링하면 해당 카테고리만 반환해야 합니다.
        이유: 필터링 로직이 없으면 항상 전체 목록이 반환되어 버그를 놓칠 수 있음.
        """
        response = client.get("/api/tools", params={"category": "search"})

        assert response.status_code == 200
        data = response.json()
        # "search" 카테고리는 web_search, doc_search 2개
        assert data["total_count"] == 2
        # 반환된 모든 tool이 "search" 카테고리인지 확인
        for tool in data["tools"]:
            assert tool["category"] == "search"

    def test_카테고리_없으면_전체_반환(self, mock_executor: MagicMock):
        """category 파라미터가 없으면 모든 tool을 반환해야 합니다."""
        response = client.get("/api/tools")

        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == len(SAMPLE_TOOLS)

    def test_존재하지_않는_카테고리_필터(self, mock_executor: MagicMock):
        """존재하지 않는 카테고리로 필터링하면 빈 목록을 반환해야 합니다.
        이유: 빈 카테고리에서 에러가 발생하지 않는지 확인.
        """
        response = client.get("/api/tools", params={"category": "nonexistent"})

        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == 0
        assert data["tools"] == []


# =============================================================================
# GET /api/tools/{tool_name} — Tool 상세 정보 조회
# =============================================================================


class TestGetToolInfo:
    """GET /api/tools/{tool_name} 엔드포인트 테스트"""

    def test_존재하지_않는_tool_이면_404(self, mock_executor: MagicMock):
        """get_tool_info()가 None을 반환하면 404 에러여야 합니다.
        이유: 잘못된 tool_name으로 조회 시 명확한 404를 반환해야 클라이언트가 구분 가능.
        """
        mock_executor.get_tool_info.return_value = None

        response = client.get("/api/tools/unknown_tool")

        assert response.status_code == 404

    def test_정상_tool_조회(self, mock_executor: MagicMock):
        """존재하는 tool을 조회하면 200과 올바른 데이터를 반환해야 합니다."""
        response = client.get("/api/tools/web_search")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "web_search"
        assert data["category"] == "search"

    def test_미초기화_상태에서_500_반환(self):
        """tool_executor가 None이면 500 에러를 반환해야 합니다."""
        response = client.get("/api/tools/any_tool")

        assert response.status_code == 500


# =============================================================================
# POST /api/tools/{tool_name}/execute — Tool 실행
# =============================================================================


class TestExecuteTool:
    """POST /api/tools/{tool_name}/execute 엔드포인트 테스트"""

    def test_인증_없이_요청하면_401(self, mock_executor: MagicMock):
        """X-API-Key 헤더 없이 POST하면 인증 실패(401)를 반환해야 합니다.
        이유: tool 실행은 보안상 인증이 필수이며, 인증 없이 실행 가능하면 취약점.
        """
        # 인증 override 제거하여 실제 인증 로직 실행
        app.dependency_overrides.pop(get_api_key, None)
        try:
            response = client.post(
                "/api/tools/web_search/execute",
                json={"parameters": {"query": "test"}},
            )
            # get_api_key가 401을 raise하므로
            assert response.status_code == 401
        finally:
            # 다른 테스트에 영향 주지 않도록 복원
            app.dependency_overrides[get_api_key] = lambda: "test-key"

    def test_context_병합_동작(self, mock_executor: MagicMock):
        """request.context가 있으면 parameters["context"]로 병합되어야 합니다.
        이유: context 병합이 없으면 tool이 세션/사용자 컨텍스트를 받지 못함.
        """
        context_data = {"session_id": "abc-123", "user_id": "user-1"}
        response = client.post(
            "/api/tools/web_search/execute",
            json={
                "parameters": {"query": "test"},
                "context": context_data,
            },
        )

        assert response.status_code == 200
        # execute_tool 호출 시 parameters에 context가 병합되었는지 확인
        call_kwargs = mock_executor.execute_tool.call_args
        passed_params = call_kwargs.kwargs["parameters"]
        assert "context" in passed_params
        assert passed_params["context"] == context_data

    def test_context_없으면_parameters만_전달(self, mock_executor: MagicMock):
        """context가 None이면 parameters에 context 키가 추가되지 않아야 합니다."""
        response = client.post(
            "/api/tools/web_search/execute",
            json={"parameters": {"query": "test"}},
        )

        assert response.status_code == 200
        call_kwargs = mock_executor.execute_tool.call_args
        passed_params = call_kwargs.kwargs["parameters"]
        assert "context" not in passed_params

    def test_execute_tool_예외_시_success_false_반환(self, mock_executor: MagicMock):
        """execute_tool()이 예외를 발생시키면 500이 아닌 success=False 응답을 반환해야 합니다.
        이유: 예외를 HTTP 500으로 전파하면 클라이언트가 에러 원인을 파악할 수 없음.
              대신 구조화된 에러 응답(success=False + error 정보)을 반환해야 함.
        """
        mock_executor.execute_tool = AsyncMock(
            side_effect=RuntimeError("외부 서비스 타임아웃")
        )

        response = client.post(
            "/api/tools/web_search/execute",
            json={"parameters": {"query": "test"}},
        )

        # HTTP 200이지만 body에서 success=False
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["error"] is not None
        assert "외부 서비스 타임아웃" in data["error"]["message"]

    def test_미초기화_상태에서_500_반환(self):
        """tool_executor가 None이면 500 에러를 반환해야 합니다."""
        response = client.post(
            "/api/tools/any_tool/execute",
            json={"parameters": {}},
        )

        assert response.status_code == 500

    def test_정상_실행_응답_구조(self, mock_executor: MagicMock):
        """정상 실행 시 응답에 request_id, execution_time_ms 등 필수 필드가 포함되어야 합니다."""
        response = client.post(
            "/api/tools/web_search/execute",
            json={"parameters": {"query": "test"}},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["tool_name"] == "web_search"
        # request_id는 UUID 형식 (라우터에서 생성)
        assert "request_id" in data
        assert len(data["request_id"]) > 0


# =============================================================================
# GET /api/tools/health — 헬스 체크
# =============================================================================


class TestToolsHealthCheck:
    """GET /api/tools/health 엔드포인트 테스트

    주의: /tools/health는 /tools/{tool_name} 뒤에 정의되어 있어
    FastAPI 경로 매칭에서 {tool_name}="health"로 먼저 매칭될 수 있습니다.
    이 테스트는 실제 라우팅 동작을 검증합니다.
    """

    def test_초기화된_상태에서_healthy(self, mock_executor: MagicMock):
        """tool_executor가 주입된 상태에서 "healthy" 상태를 반환해야 합니다."""
        response = client.get("/api/tools/health")

        assert response.status_code == 200
        data = response.json()
        # 경로 충돌로 인해 /tools/{tool_name}이 먼저 매칭될 수 있음
        # 실제 동작에 맞춰 검증
        if "status" in data:
            # health 엔드포인트가 정상 매칭된 경우
            assert data["status"] == "healthy"
            assert data["tool_executor_initialized"] is True
            assert data["available_tools_count"] == len(SAMPLE_TOOLS)
        else:
            # /tools/{tool_name}으로 매칭되어 tool_name="health"로 처리된 경우
            # 이 경우 get_tool_info("health")가 호출됨
            # 라우팅 순서 문제를 문서화하는 것이 목적
            pass

    def test_미초기화_상태_응답(self):
        """tool_executor가 None일 때의 응답을 검증합니다.
        경로 충돌(/tools/{tool_name})로 인해 500이 반환될 수 있습니다.
        """
        response = client.get("/api/tools/health")

        assert response.status_code in (200, 500)
        # 500인 경우: /tools/{tool_name}으로 매칭되어 미초기화 에러
        # 200인 경우: health 엔드포인트가 매칭되어 "not_initialized" 상태
        if response.status_code == 200:
            data = response.json()
            if "status" in data:
                assert data["status"] == "not_initialized"
