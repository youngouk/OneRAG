"""
Weaviate 스키마 초기화 모듈 단위 테스트

주요 기능:
- create_schema(): 비동기 스키마 생성 로직 검증
- get_schema_info(): 동기 스키마 정보 조회 검증

Mock 구조:
- get_weaviate_client() → 래퍼 객체 (.client 속성 보유)
- 래퍼.client → 실제 Weaviate client (.collections 하위 메서드)

의존성:
- app.lib.weaviate_setup
"""

from unittest.mock import MagicMock, patch

import pytest

from app.lib.weaviate_setup import create_schema, get_schema_info

# --- Mock 헬퍼 ---

PATCH_TARGET = "app.lib.weaviate_setup.get_weaviate_client"


def _make_wrapper(client_value: MagicMock | None = None) -> MagicMock:
    """래퍼 객체를 생성한다. client_value=None 이면 연결 실패 시나리오."""
    wrapper = MagicMock()
    wrapper.client = client_value
    return wrapper


# ========================================================
# create_schema() 테스트 (비동기, 4개)
# ========================================================


class TestCreateSchema:
    """create_schema() 비동기 함수 테스트 모음."""

    @pytest.mark.asyncio
    @patch(PATCH_TARGET)
    async def test_클라이언트_없으면_false_반환(self, mock_get: MagicMock) -> None:
        """weaviate_client.client가 None이면 False를 반환해야 한다."""
        mock_get.return_value = _make_wrapper(client_value=None)

        result = await create_schema()

        assert result is False

    @pytest.mark.asyncio
    @patch(PATCH_TARGET)
    async def test_컬렉션_이미_존재하면_true_반환_create_미호출(
        self, mock_get: MagicMock
    ) -> None:
        """Documents 컬렉션이 이미 존재하면 True를 반환하고, create()는 호출하지 않는다."""
        mock_inner = MagicMock()
        mock_inner.collections.exists.return_value = True
        mock_get.return_value = _make_wrapper(client_value=mock_inner)

        result = await create_schema()

        assert result is True
        mock_inner.collections.exists.assert_called_once_with("Documents")
        mock_inner.collections.create.assert_not_called()

    @pytest.mark.asyncio
    @patch(PATCH_TARGET)
    async def test_컬렉션_없으면_생성_후_true_반환(self, mock_get: MagicMock) -> None:
        """Documents 컬렉션이 없으면 create()를 호출하고 True를 반환한다."""
        mock_inner = MagicMock()
        mock_inner.collections.exists.return_value = False
        mock_get.return_value = _make_wrapper(client_value=mock_inner)

        result = await create_schema()

        assert result is True
        mock_inner.collections.exists.assert_called_once_with("Documents")
        mock_inner.collections.create.assert_called_once()

    @pytest.mark.asyncio
    @patch(PATCH_TARGET)
    async def test_예외_발생_시_false_반환(self, mock_get: MagicMock) -> None:
        """내부에서 예외가 발생하면 False를 반환한다."""
        mock_get.side_effect = RuntimeError("연결 오류")

        result = await create_schema()

        assert result is False


# ========================================================
# get_schema_info() 테스트 (동기, 4개)
# ========================================================


class TestGetSchemaInfo:
    """get_schema_info() 동기 함수 테스트 모음."""

    @patch(PATCH_TARGET)
    def test_클라이언트_없으면_none_반환(self, mock_get: MagicMock) -> None:
        """weaviate_client.client가 None이면 None을 반환해야 한다."""
        mock_get.return_value = _make_wrapper(client_value=None)

        result = get_schema_info()

        assert result is None

    @patch(PATCH_TARGET)
    def test_정상_호출_시_dict_반환(self, mock_get: MagicMock) -> None:
        """정상 동작 시 collections 목록과 total_count를 포함하는 dict를 반환한다."""
        # list_all()은 dict-like 객체를 반환 → .values()로 순회
        mock_col = MagicMock()
        mock_col.name = "Documents"

        mock_inner = MagicMock()
        mock_inner.collections.list_all.return_value = {"Documents": mock_col}
        mock_get.return_value = _make_wrapper(client_value=mock_inner)

        result = get_schema_info()

        assert result is not None
        assert result["collections"] == ["Documents"]
        assert result["total_count"] == 1

    @patch(PATCH_TARGET)
    def test_예외_발생_시_none_반환(self, mock_get: MagicMock) -> None:
        """내부에서 예외가 발생하면 None을 반환한다."""
        mock_get.side_effect = RuntimeError("조회 오류")

        result = get_schema_info()

        assert result is None

    @patch(PATCH_TARGET)
    def test_빈_컬렉션이면_total_count_0(self, mock_get: MagicMock) -> None:
        """컬렉션이 하나도 없으면 total_count=0, collections=[] 이어야 한다."""
        mock_inner = MagicMock()
        mock_inner.collections.list_all.return_value = {}
        mock_get.return_value = _make_wrapper(client_value=mock_inner)

        result = get_schema_info()

        assert result is not None
        assert result["collections"] == []
        assert result["total_count"] == 0
