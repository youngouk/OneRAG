"""
AgentReflector 테스트

Self-Reflection 기능의 핵심 로직 검증:
- 초기화 및 의존성 검증
- reflect() 메서드 동작 검증
"""
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.modules.core.agent.reflector import AgentReflector
from app.modules.core.agent.interfaces import AgentConfig, ReflectionResult


class TestAgentReflectorInit:
    """AgentReflector 초기화 테스트"""

    def test_reflector_init_success(self):
        """정상 초기화 테스트"""
        # Given: Mock LLM 클라이언트와 설정
        llm_client = MagicMock()
        config = AgentConfig()

        # When: AgentReflector 초기화
        reflector = AgentReflector(llm_client=llm_client, config=config)

        # Then: 의존성이 올바르게 저장됨
        assert reflector._llm_client is llm_client
        assert reflector._config is config

    def test_reflector_init_without_llm_raises(self):
        """llm_client 없이 초기화 시 ValueError 발생"""
        # Given: config만 있고 llm_client가 None
        config = AgentConfig()

        # When/Then: ValueError 발생
        with pytest.raises(ValueError, match="llm_client는 필수"):
            AgentReflector(llm_client=None, config=config)

    def test_reflector_init_without_config_raises(self):
        """config 없이 초기화 시 ValueError 발생"""
        # Given: llm_client만 있고 config가 None
        llm_client = MagicMock()

        # When/Then: ValueError 발생
        with pytest.raises(ValueError, match="config는 필수"):
            AgentReflector(llm_client=llm_client, config=None)


class TestAgentReflectorReflect:
    """AgentReflector.reflect() 메서드 테스트"""

    @pytest.fixture
    def mock_llm_client(self):
        """Mock LLM 클라이언트"""
        client = AsyncMock()
        return client

    @pytest.fixture
    def reflector(self, mock_llm_client):
        """테스트용 Reflector"""
        config = AgentConfig(reflection_threshold=7.0)
        return AgentReflector(llm_client=mock_llm_client, config=config)

    @pytest.mark.asyncio
    async def test_reflect_high_quality_answer(self, reflector, mock_llm_client):
        """고품질 답변 평가 테스트"""
        # Given: LLM이 높은 점수 반환
        mock_llm_client.generate_text.return_value = '''
        {
            "score": 9.0,
            "issues": [],
            "suggestions": [],
            "reasoning": "질문에 정확하게 답변하고 있으며 컨텍스트에 충실함"
        }
        '''

        # When: reflect() 호출
        result = await reflector.reflect(
            query="서울 날씨 알려줘",
            answer="서울의 현재 날씨는 맑음이며 기온은 15도입니다.",
            context="서울 날씨: 맑음, 15도"
        )

        # Then: 높은 점수와 개선 불필요
        assert isinstance(result, ReflectionResult)
        assert result.score == 9.0
        assert result.needs_improvement is False
        assert result.issues == []

    @pytest.mark.asyncio
    async def test_reflect_low_quality_answer(self, reflector, mock_llm_client):
        """저품질 답변 평가 테스트"""
        # Given: LLM이 낮은 점수 반환
        mock_llm_client.generate_text.return_value = '''
        {
            "score": 4.0,
            "issues": ["정보 누락", "불확실한 내용"],
            "suggestions": ["날씨 정보 추가 검색", "기온 확인 필요"],
            "reasoning": "답변에 구체적인 정보가 부족함"
        }
        '''

        # When: reflect() 호출
        result = await reflector.reflect(
            query="서울 날씨 알려줘",
            answer="날씨가 좋은 것 같습니다.",
            context=""
        )

        # Then: 낮은 점수와 개선 필요
        assert result.score == 4.0
        assert result.needs_improvement is True
        assert "정보 누락" in result.issues
        assert len(result.suggestions) == 2

    @pytest.mark.asyncio
    async def test_reflect_threshold_boundary(self, reflector, mock_llm_client):
        """threshold 경계값 테스트"""
        # Given: 정확히 threshold 점수
        mock_llm_client.generate_text.return_value = (
            '{"score": 7.0, "issues": [], "suggestions": [], "reasoning": "적절함"}'
        )

        # When: reflect() 호출
        result = await reflector.reflect(
            query="테스트",
            answer="테스트 답변",
            context=""
        )

        # Then: 7.0 == threshold이면 needs_improvement=False
        assert result.score == 7.0
        assert result.needs_improvement is False

    @pytest.mark.asyncio
    async def test_reflect_llm_error_fallback(self, reflector, mock_llm_client):
        """LLM 에러 시 폴백 테스트"""
        # Given: LLM 에러 발생
        mock_llm_client.generate_text.side_effect = Exception("LLM 에러")

        # When: reflect() 호출
        result = await reflector.reflect(
            query="테스트",
            answer="테스트 답변",
            context=""
        )

        # Then: 에러 시 보수적으로 개선 불필요 처리
        assert result.score == 7.0  # 기본값
        assert result.needs_improvement is False
        assert "평가 실패" in result.reasoning
