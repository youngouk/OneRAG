"""
Self-Reflection E2E 통합 테스트

전체 Reflection 흐름을 검증:
- Factory를 통한 Orchestrator 생성
- Reflection 활성화 시 품질 평가 및 개선 흐름
- Reflection 비활성화 시 건너뜀
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.core.agent.factory import AgentFactory


class TestSelfReflectionE2E:
    """Self-Reflection 전체 흐름 E2E 테스트"""

    @pytest.fixture
    def mock_llm_client(self):
        """실제 LLM을 모방하는 Mock"""
        client = AsyncMock()
        return client

    @pytest.fixture
    def mock_mcp_server(self):
        """Mock MCP 서버"""
        server = MagicMock()
        server.is_enabled = True
        server.get_tool_schemas.return_value = []
        return server

    @pytest.fixture
    def config_with_reflection(self):
        """Reflection 활성화 설정"""
        return {
            "mcp": {
                "enabled": True,
                "agent": {
                    "enable_reflection": True,
                    "reflection_threshold": 7.0,
                    "max_reflection_iterations": 2,
                },
            },
        }

    @pytest.fixture
    def config_without_reflection(self):
        """Reflection 비활성화 설정"""
        return {
            "mcp": {
                "enabled": True,
                "agent": {
                    "enable_reflection": False,
                },
            },
        }

    @pytest.mark.asyncio
    async def test_e2e_reflection_flow_with_improvement(
        self, mock_llm_client, mock_mcp_server, config_with_reflection
    ):
        """E2E: Reflection으로 답변 품질 개선 흐름"""
        # Given: LLM 응답 시퀀스 설정
        mock_llm_client.generate_text.side_effect = [
            # 1. Planner 응답 (검색 완료)
            '{"reasoning": "검색 완료", "tool_calls": [], "should_continue": false}',
            # 2. Synthesizer 첫 번째 응답
            "첫 번째 답변입니다.",
            # 3. Reflector 첫 번째 평가 (낮은 점수)
            '{"score": 5.0, "issues": ["정보 부족"], "suggestions": ["상세 검색"], "reasoning": "부족"}',
            # 4. Synthesizer 재생성 응답 (개선됨)
            "개선된 상세 답변입니다.",
            # 5. Reflector 두 번째 평가 (높은 점수)
            '{"score": 9.0, "issues": [], "suggestions": [], "reasoning": "충분함"}',
        ]

        # Orchestrator 생성
        orchestrator = AgentFactory.create(
            config=config_with_reflection,
            llm_client=mock_llm_client,
            mcp_server=mock_mcp_server,
        )

        assert orchestrator is not None

        # When: 실행
        result = await orchestrator.run("테스트 질문")

        # Then: 개선된 답변 반환
        assert result.success is True
        assert "개선된 상세 답변" in result.answer

        # LLM 호출 횟수 확인 (Planner + Synthesizer*2 + Reflector*2 = 5)
        assert mock_llm_client.generate_text.call_count == 5

    @pytest.mark.asyncio
    async def test_e2e_reflection_flow_high_quality_first(
        self, mock_llm_client, mock_mcp_server, config_with_reflection
    ):
        """E2E: 첫 번째 답변이 고품질이면 재시도 없음"""
        # Given: LLM 응답 시퀀스 설정
        mock_llm_client.generate_text.side_effect = [
            # 1. Planner 응답 (검색 완료)
            '{"reasoning": "검색 완료", "tool_calls": [], "should_continue": false}',
            # 2. Synthesizer 응답
            "고품질 답변입니다.",
            # 3. Reflector 평가 (높은 점수)
            '{"score": 9.5, "issues": [], "suggestions": [], "reasoning": "훌륭함"}',
        ]

        # Orchestrator 생성
        orchestrator = AgentFactory.create(
            config=config_with_reflection,
            llm_client=mock_llm_client,
            mcp_server=mock_mcp_server,
        )

        # When: 실행
        result = await orchestrator.run("테스트 질문")

        # Then: 첫 번째 답변 그대로 반환
        assert result.success is True
        assert "고품질 답변" in result.answer

        # LLM 호출 횟수 확인 (Planner + Synthesizer + Reflector = 3)
        assert mock_llm_client.generate_text.call_count == 3

    @pytest.mark.asyncio
    async def test_e2e_reflection_disabled(
        self, mock_llm_client, mock_mcp_server, config_without_reflection
    ):
        """E2E: Reflection 비활성화 시 건너뜀"""
        # Given: LLM 응답 시퀀스 설정
        mock_llm_client.generate_text.side_effect = [
            # 1. Planner 응답
            '{"reasoning": "검색 완료", "tool_calls": [], "should_continue": false}',
            # 2. Synthesizer 응답
            "일반 답변입니다.",
        ]

        # Orchestrator 생성
        orchestrator = AgentFactory.create(
            config=config_without_reflection,
            llm_client=mock_llm_client,
            mcp_server=mock_mcp_server,
        )

        assert orchestrator is not None
        # Reflector가 생성되지 않음
        assert orchestrator._reflector is None

        # When: 실행
        result = await orchestrator.run("테스트 질문")

        # Then: 답변 반환 (Reflection 없이)
        assert result.success is True
        assert "일반 답변" in result.answer

        # LLM 호출 횟수 확인 (Planner + Synthesizer = 2, Reflector 없음)
        assert mock_llm_client.generate_text.call_count == 2

    @pytest.mark.asyncio
    async def test_e2e_factory_creates_complete_orchestrator(
        self, mock_llm_client, mock_mcp_server, config_with_reflection
    ):
        """E2E: Factory가 모든 컴포넌트를 올바르게 조립"""
        # When: Orchestrator 생성
        orchestrator = AgentFactory.create(
            config=config_with_reflection,
            llm_client=mock_llm_client,
            mcp_server=mock_mcp_server,
        )

        # Then: 모든 컴포넌트 존재
        assert orchestrator is not None
        assert orchestrator._planner is not None
        assert orchestrator._executor is not None
        assert orchestrator._synthesizer is not None
        assert orchestrator._config is not None
        assert orchestrator._reflector is not None

        # Config 값 확인
        assert orchestrator._config.enable_reflection is True
        assert orchestrator._config.reflection_threshold == 7.0
        assert orchestrator._config.max_reflection_iterations == 2

