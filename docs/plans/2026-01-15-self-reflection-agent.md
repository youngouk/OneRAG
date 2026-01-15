# Self-Reflection Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agent가 생성한 답변을 자체 평가하고, 품질이 부족하면 추가 검색/수정을 통해 개선하는 Self-Reflection 기능 추가

**Architecture:** 기존 AgentOrchestrator의 Synthesize 단계 후에 Reflect 단계 추가. AgentReflector가 LLM을 통해 답변 품질을 평가하고, 점수가 threshold 미만이면 개선이 필요한 부분을 식별하여 다시 Plan 단계로 돌아감.

**Tech Stack:** Python 3.11+, 기존 LLM 클라이언트 활용, 외부 라이브러리 의존성 없음

---

## Task 1: ReflectionResult 데이터 클래스 추가

**Files:**
- Modify: `app/modules/core/agent/interfaces.py:297` (파일 끝에 추가)
- Test: `tests/modules/core/agent/test_reflection_interfaces.py`

**Step 1: Write the failing test**

```python
# tests/modules/core/agent/test_reflection_interfaces.py
"""
ReflectionResult 데이터 클래스 테스트
"""
import pytest
from app.modules.core.agent.interfaces import ReflectionResult


class TestReflectionResult:
    """ReflectionResult 데이터 클래스 테스트"""

    def test_reflection_result_creation(self):
        """ReflectionResult 기본 생성 테스트"""
        result = ReflectionResult(
            score=8.5,
            issues=[],
            suggestions=[],
            needs_improvement=False,
            reasoning="답변이 질문에 정확히 답변함"
        )

        assert result.score == 8.5
        assert result.issues == []
        assert result.suggestions == []
        assert result.needs_improvement is False
        assert result.reasoning == "답변이 질문에 정확히 답변함"

    def test_reflection_result_with_issues(self):
        """이슈가 있는 ReflectionResult 테스트"""
        result = ReflectionResult(
            score=4.0,
            issues=["정보 누락", "불확실한 내용 포함"],
            suggestions=["추가 검색 필요", "출처 확인 필요"],
            needs_improvement=True,
            reasoning="답변에 누락된 정보가 있음"
        )

        assert result.score == 4.0
        assert len(result.issues) == 2
        assert "정보 누락" in result.issues
        assert result.needs_improvement is True

    def test_reflection_result_default_values(self):
        """ReflectionResult 기본값 테스트"""
        result = ReflectionResult(
            score=7.0,
            needs_improvement=False
        )

        assert result.issues == []
        assert result.suggestions == []
        assert result.reasoning == ""

    def test_reflection_result_score_boundary(self):
        """점수 경계값 테스트"""
        # 최저 점수
        low = ReflectionResult(score=0.0, needs_improvement=True)
        assert low.score == 0.0

        # 최고 점수
        high = ReflectionResult(score=10.0, needs_improvement=False)
        assert high.score == 10.0
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/modules/core/agent/test_reflection_interfaces.py -v`
Expected: FAIL with "ImportError: cannot import name 'ReflectionResult'"

**Step 3: Write minimal implementation**

```python
# app/modules/core/agent/interfaces.py 파일 끝에 추가 (line 297 이후)

@dataclass
class ReflectionResult:
    """
    Self-Reflection 결과

    AgentReflector가 답변 품질을 평가한 결과를 담는 데이터 클래스.
    점수가 threshold 미만이면 needs_improvement=True로 설정됩니다.

    Attributes:
        score: 품질 점수 (0-10, 높을수록 좋음)
        issues: 발견된 문제점 리스트
        suggestions: 개선 제안 리스트
        needs_improvement: 추가 개선 필요 여부
        reasoning: 평가 근거
    """

    # 품질 점수 (0-10)
    score: float

    # 추가 개선 필요 여부
    needs_improvement: bool

    # 발견된 문제점
    issues: list[str] = field(default_factory=list)

    # 개선 제안
    suggestions: list[str] = field(default_factory=list)

    # 평가 근거
    reasoning: str = ""
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/modules/core/agent/test_reflection_interfaces.py -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add tests/modules/core/agent/test_reflection_interfaces.py app/modules/core/agent/interfaces.py
git commit -m "feat: ReflectionResult 데이터 클래스 추가

- Self-Reflection 결과를 담는 데이터 클래스
- score, issues, suggestions, needs_improvement, reasoning 필드
- TDD 기반 구현"
```

---

## Task 2: AgentConfig에 Reflection 설정 추가

**Files:**
- Modify: `app/modules/core/agent/interfaces.py:21-64` (AgentConfig 클래스)
- Test: `tests/modules/core/agent/test_reflection_interfaces.py` (추가)

**Step 1: Write the failing test**

```python
# tests/modules/core/agent/test_reflection_interfaces.py에 추가

class TestAgentConfigReflection:
    """AgentConfig Reflection 설정 테스트"""

    def test_agent_config_reflection_defaults(self):
        """Reflection 기본 설정 테스트"""
        config = AgentConfig()

        assert config.enable_reflection is True
        assert config.reflection_threshold == 7.0
        assert config.max_reflection_iterations == 2

    def test_agent_config_reflection_custom(self):
        """Reflection 커스텀 설정 테스트"""
        config = AgentConfig(
            enable_reflection=False,
            reflection_threshold=8.0,
            max_reflection_iterations=3
        )

        assert config.enable_reflection is False
        assert config.reflection_threshold == 8.0
        assert config.max_reflection_iterations == 3

    def test_agent_config_reflection_disabled(self):
        """Reflection 비활성화 테스트"""
        config = AgentConfig(enable_reflection=False)

        assert config.enable_reflection is False
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/modules/core/agent/test_reflection_interfaces.py::TestAgentConfigReflection -v`
Expected: FAIL with "TypeError: __init__() got unexpected keyword argument 'enable_reflection'"

**Step 3: Write minimal implementation**

```python
# app/modules/core/agent/interfaces.py - AgentConfig 클래스에 추가 (line 60-64 사이)

    # === Self-Reflection 설정 ===

    # Reflection 활성화 여부
    enable_reflection: bool = True

    # Reflection 품질 threshold (이 점수 미만이면 개선 필요)
    reflection_threshold: float = 7.0

    # 최대 Reflection 반복 횟수
    max_reflection_iterations: int = 2
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/modules/core/agent/test_reflection_interfaces.py -v`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add app/modules/core/agent/interfaces.py tests/modules/core/agent/test_reflection_interfaces.py
git commit -m "feat: AgentConfig에 Reflection 설정 추가

- enable_reflection: 기능 활성화 여부 (기본: True)
- reflection_threshold: 품질 임계값 (기본: 7.0)
- max_reflection_iterations: 최대 반복 횟수 (기본: 2)"
```

---

## Task 3: AgentReflector 클래스 구현 - 기본 구조

**Files:**
- Create: `app/modules/core/agent/reflector.py`
- Test: `tests/modules/core/agent/test_reflector.py`

**Step 1: Write the failing test**

```python
# tests/modules/core/agent/test_reflector.py
"""
AgentReflector 테스트
Self-Reflection 기능의 핵심 로직 검증
"""
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.modules.core.agent.reflector import AgentReflector
from app.modules.core.agent.interfaces import AgentConfig, ReflectionResult


class TestAgentReflectorInit:
    """AgentReflector 초기화 테스트"""

    def test_reflector_init_success(self):
        """정상 초기화 테스트"""
        llm_client = MagicMock()
        config = AgentConfig()

        reflector = AgentReflector(llm_client=llm_client, config=config)

        assert reflector._llm_client is llm_client
        assert reflector._config is config

    def test_reflector_init_without_llm_raises(self):
        """llm_client 없이 초기화 시 에러"""
        config = AgentConfig()

        with pytest.raises(ValueError, match="llm_client는 필수"):
            AgentReflector(llm_client=None, config=config)

    def test_reflector_init_without_config_raises(self):
        """config 없이 초기화 시 에러"""
        llm_client = MagicMock()

        with pytest.raises(ValueError, match="config는 필수"):
            AgentReflector(llm_client=llm_client, config=None)
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/modules/core/agent/test_reflector.py::TestAgentReflectorInit -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'app.modules.core.agent.reflector'"

**Step 3: Write minimal implementation**

```python
# app/modules/core/agent/reflector.py
"""
AgentReflector - Self-Reflection 담당

ReAct 패턴에서 "Reflect" 담당 컴포넌트.
생성된 답변의 품질을 평가하고, 개선이 필요한 부분을 식별합니다.

주요 기능:
- LLM을 사용하여 답변 품질 평가 (0-10점)
- 답변의 문제점 식별 및 개선 제안
- threshold 기반 개선 필요 여부 판단
- 추가 검색이 필요한 키워드 추출

사용 예시:
    reflector = AgentReflector(llm_client, config)
    result = await reflector.reflect(query, answer, context)
    if result.needs_improvement:
        # 개선 로직 실행
"""

from typing import Any

from ....lib.logger import get_logger
from .interfaces import AgentConfig, ReflectionResult

logger = get_logger(__name__)


class AgentReflector:
    """
    Self-Reflection 담당

    생성된 답변의 품질을 LLM으로 평가하고,
    개선이 필요한 경우 문제점과 제안을 반환합니다.

    Attributes:
        _llm_client: LLM 클라이언트 (generate_text 메서드 필요)
        _config: 에이전트 설정 (reflection_threshold 등)
    """

    def __init__(
        self,
        llm_client: Any,
        config: AgentConfig,
    ):
        """
        AgentReflector 초기화

        Args:
            llm_client: LLM 클라이언트 (generate_text 메서드 필요)
            config: 에이전트 설정

        Raises:
            ValueError: 필수 의존성 누락 시
        """
        if llm_client is None:
            raise ValueError("llm_client는 필수입니다")
        if config is None:
            raise ValueError("config는 필수입니다")

        self._llm_client = llm_client
        self._config = config

        logger.info(
            f"AgentReflector 초기화: "
            f"threshold={config.reflection_threshold}, "
            f"max_iterations={config.max_reflection_iterations}"
        )
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/modules/core/agent/test_reflector.py::TestAgentReflectorInit -v`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add app/modules/core/agent/reflector.py tests/modules/core/agent/test_reflector.py
git commit -m "feat: AgentReflector 기본 구조 구현

- AgentReflector 클래스 생성
- 초기화 로직 및 의존성 검증
- TDD 기반 구현"
```

---

## Task 4: AgentReflector.reflect() 메서드 구현

**Files:**
- Modify: `app/modules/core/agent/reflector.py`
- Test: `tests/modules/core/agent/test_reflector.py` (추가)

**Step 1: Write the failing test**

```python
# tests/modules/core/agent/test_reflector.py에 추가

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
        # LLM이 높은 점수 반환
        mock_llm_client.generate_text.return_value = '''
        {
            "score": 9.0,
            "issues": [],
            "suggestions": [],
            "reasoning": "질문에 정확하게 답변하고 있으며 컨텍스트에 충실함"
        }
        '''

        result = await reflector.reflect(
            query="서울 날씨 알려줘",
            answer="서울의 현재 날씨는 맑음이며 기온은 15도입니다.",
            context="서울 날씨: 맑음, 15도"
        )

        assert isinstance(result, ReflectionResult)
        assert result.score == 9.0
        assert result.needs_improvement is False
        assert result.issues == []

    @pytest.mark.asyncio
    async def test_reflect_low_quality_answer(self, reflector, mock_llm_client):
        """저품질 답변 평가 테스트"""
        # LLM이 낮은 점수 반환
        mock_llm_client.generate_text.return_value = '''
        {
            "score": 4.0,
            "issues": ["정보 누락", "불확실한 내용"],
            "suggestions": ["날씨 정보 추가 검색", "기온 확인 필요"],
            "reasoning": "답변에 구체적인 정보가 부족함"
        }
        '''

        result = await reflector.reflect(
            query="서울 날씨 알려줘",
            answer="날씨가 좋은 것 같습니다.",
            context=""
        )

        assert result.score == 4.0
        assert result.needs_improvement is True
        assert "정보 누락" in result.issues
        assert len(result.suggestions) == 2

    @pytest.mark.asyncio
    async def test_reflect_threshold_boundary(self, reflector, mock_llm_client):
        """threshold 경계값 테스트"""
        # 정확히 threshold 점수
        mock_llm_client.generate_text.return_value = '{"score": 7.0, "issues": [], "suggestions": [], "reasoning": "적절함"}'

        result = await reflector.reflect(
            query="테스트",
            answer="테스트 답변",
            context=""
        )

        # 7.0 == threshold이면 needs_improvement=False
        assert result.score == 7.0
        assert result.needs_improvement is False

    @pytest.mark.asyncio
    async def test_reflect_llm_error_fallback(self, reflector, mock_llm_client):
        """LLM 에러 시 폴백 테스트"""
        mock_llm_client.generate_text.side_effect = Exception("LLM 에러")

        result = await reflector.reflect(
            query="테스트",
            answer="테스트 답변",
            context=""
        )

        # 에러 시 보수적으로 개선 불필요 처리
        assert result.score == 7.0  # 기본값
        assert result.needs_improvement is False
        assert "평가 실패" in result.reasoning
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/modules/core/agent/test_reflector.py::TestAgentReflectorReflect -v`
Expected: FAIL with "AttributeError: 'AgentReflector' object has no attribute 'reflect'"

**Step 3: Write minimal implementation**

```python
# app/modules/core/agent/reflector.py에 추가

import json
import re


# Reflection 프롬프트 템플릿
REFLECTOR_SYSTEM_PROMPT = """당신은 RAG 시스템의 답변 품질 평가 에이전트입니다.
생성된 답변의 품질을 객관적으로 평가하세요.

## 평가 기준 (각 항목 0-2점):
1. 정확성: 질문에 정확히 답변했는가?
2. 완전성: 필요한 정보가 모두 포함되었는가?
3. 충실성: 컨텍스트에 기반한 사실인가?
4. 명확성: 이해하기 쉽게 작성되었는가?
5. 관련성: 질문과 관련 있는 내용인가?

## 응답 형식 (JSON만 출력):
{
    "score": 0-10 (소수점 가능),
    "issues": ["발견된 문제점들"],
    "suggestions": ["개선을 위한 제안들"],
    "reasoning": "평가 근거 (1-2문장)"
}

## 중요:
- 객관적이고 공정하게 평가하세요
- 문제점이 없으면 빈 배열 []을 반환하세요
- 반드시 JSON 형식으로만 응답하세요
"""

REFLECTOR_USER_PROMPT = """## 원본 질문:
{query}

## 생성된 답변:
{answer}

## 검색 컨텍스트:
{context}

위 답변의 품질을 평가하세요. JSON 형식으로만 응답하세요."""


# AgentReflector 클래스에 메서드 추가
    async def reflect(
        self,
        query: str,
        answer: str,
        context: str,
    ) -> ReflectionResult:
        """
        답변 품질 평가 (Self-Reflection)

        LLM을 사용하여 생성된 답변의 품질을 평가하고,
        개선이 필요한지 판단합니다.

        Args:
            query: 원본 사용자 질문
            answer: 생성된 답변
            context: 검색된 컨텍스트 (검색 결과 요약)

        Returns:
            ReflectionResult: 평가 결과 (score, issues, suggestions 등)

        Note:
            LLM 호출 실패 시 보수적으로 needs_improvement=False 반환
        """
        try:
            # 1. 프롬프트 구성
            user_prompt = REFLECTOR_USER_PROMPT.format(
                query=query,
                answer=answer,
                context=context or "컨텍스트 없음",
            )

            # 2. LLM 호출
            response = await self._llm_client.generate_text(
                prompt=user_prompt,
                system_prompt=REFLECTOR_SYSTEM_PROMPT,
            )

            # 3. 응답 파싱
            return self._parse_reflection_response(response)

        except Exception as e:
            logger.error(f"AgentReflector 에러: {e}")
            return self._fallback_result()

    def _parse_reflection_response(self, response: str) -> ReflectionResult:
        """
        LLM 응답을 ReflectionResult로 파싱

        Args:
            response: LLM 응답 문자열 (JSON 형식)

        Returns:
            ReflectionResult: 파싱된 결과
        """
        try:
            # JSON 추출 (마크다운 코드 블록 처리)
            json_str = self._extract_json(response)
            data = json.loads(json_str)

            score = float(data.get("score", 7.0))
            issues = data.get("issues", [])
            suggestions = data.get("suggestions", [])
            reasoning = data.get("reasoning", "")

            # threshold 기반 개선 필요 여부 판단
            needs_improvement = score < self._config.reflection_threshold

            logger.info(
                f"AgentReflector: score={score}, "
                f"needs_improvement={needs_improvement}"
            )

            return ReflectionResult(
                score=score,
                issues=issues,
                suggestions=suggestions,
                needs_improvement=needs_improvement,
                reasoning=reasoning,
            )

        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            logger.warning(f"Reflection 응답 파싱 실패: {e}")
            return self._fallback_result()

    def _extract_json(self, response: str) -> str:
        """응답에서 JSON 문자열 추출"""
        response = response.strip()

        # 마크다운 코드 블록 처리
        json_match = re.search(r"```(?:json)?\s*(.*?)\s*```", response, re.DOTALL)
        if json_match:
            return json_match.group(1).strip()

        return response

    def _fallback_result(self) -> ReflectionResult:
        """폴백 결과 (에러 시 보수적 처리)"""
        return ReflectionResult(
            score=7.0,
            issues=[],
            suggestions=[],
            needs_improvement=False,
            reasoning="평가 실패 - 기본값 사용",
        )
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/modules/core/agent/test_reflector.py -v`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add app/modules/core/agent/reflector.py tests/modules/core/agent/test_reflector.py
git commit -m "feat: AgentReflector.reflect() 메서드 구현

- LLM 기반 답변 품질 평가
- 0-10점 스코어링 시스템
- threshold 기반 개선 필요 여부 판단
- 에러 시 보수적 폴백 처리"
```

---

## Task 5: AgentReflector를 __init__.py에 등록

**Files:**
- Modify: `app/modules/core/agent/__init__.py`
- Test: (import 테스트)

**Step 1: Write the failing test**

```python
# tests/modules/core/agent/test_reflector.py 상단에 import 테스트 추가

def test_reflector_import_from_init():
    """__init__.py에서 import 가능 여부 테스트"""
    from app.modules.core.agent import AgentReflector
    from app.modules.core.agent import ReflectionResult

    assert AgentReflector is not None
    assert ReflectionResult is not None
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/modules/core/agent/test_reflector.py::test_reflector_import_from_init -v`
Expected: FAIL with "ImportError: cannot import name 'AgentReflector'"

**Step 3: Write minimal implementation**

```python
# app/modules/core/agent/__init__.py 수정
# 기존 import에 추가

from .reflector import AgentReflector
from .interfaces import ReflectionResult

# __all__ 리스트에 추가
__all__ = [
    # ... 기존 항목들 ...
    "AgentReflector",
    "ReflectionResult",
]
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/modules/core/agent/test_reflector.py::test_reflector_import_from_init -v`
Expected: PASS

**Step 5: Commit**

```bash
git add app/modules/core/agent/__init__.py
git commit -m "feat: AgentReflector를 agent 모듈에 등록

- __init__.py에 AgentReflector, ReflectionResult export 추가"
```

---

## Task 6: AgentOrchestrator에 Reflection 루프 추가

**Files:**
- Modify: `app/modules/core/agent/orchestrator.py`
- Test: `tests/modules/core/agent/test_orchestrator_reflection.py`

**Step 1: Write the failing test**

```python
# tests/modules/core/agent/test_orchestrator_reflection.py
"""
AgentOrchestrator Self-Reflection 통합 테스트
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.modules.core.agent.orchestrator import AgentOrchestrator
from app.modules.core.agent.interfaces import (
    AgentConfig,
    AgentResult,
    ReflectionResult,
)


class TestOrchestratorReflection:
    """AgentOrchestrator Reflection 통합 테스트"""

    @pytest.fixture
    def mock_planner(self):
        planner = AsyncMock()
        planner.plan.return_value = ([], "검색 완료", False)
        return planner

    @pytest.fixture
    def mock_executor(self):
        executor = AsyncMock()
        executor.execute.return_value = []
        return executor

    @pytest.fixture
    def mock_synthesizer(self):
        synthesizer = AsyncMock()
        synthesizer.synthesize.return_value = ("테스트 답변", [])
        return synthesizer

    @pytest.fixture
    def mock_reflector(self):
        reflector = AsyncMock()
        reflector.reflect.return_value = ReflectionResult(
            score=9.0,
            needs_improvement=False,
            issues=[],
            suggestions=[],
            reasoning="좋은 답변"
        )
        return reflector

    @pytest.fixture
    def config_with_reflection(self):
        return AgentConfig(
            enable_reflection=True,
            reflection_threshold=7.0,
            max_reflection_iterations=2
        )

    @pytest.fixture
    def config_without_reflection(self):
        return AgentConfig(enable_reflection=False)

    @pytest.mark.asyncio
    async def test_orchestrator_with_reflection_high_score(
        self, mock_planner, mock_executor, mock_synthesizer,
        mock_reflector, config_with_reflection
    ):
        """높은 점수면 반복 없이 완료"""
        orchestrator = AgentOrchestrator(
            planner=mock_planner,
            executor=mock_executor,
            synthesizer=mock_synthesizer,
            config=config_with_reflection,
            reflector=mock_reflector,  # 신규 파라미터
        )

        result = await orchestrator.run("테스트 질문")

        assert result.success is True
        assert mock_reflector.reflect.call_count == 1
        # 높은 점수이므로 synthesizer는 1번만 호출
        assert mock_synthesizer.synthesize.call_count == 1

    @pytest.mark.asyncio
    async def test_orchestrator_with_reflection_low_score_retry(
        self, mock_planner, mock_executor, mock_synthesizer,
        config_with_reflection
    ):
        """낮은 점수면 재시도"""
        # 첫 번째: 낮은 점수, 두 번째: 높은 점수
        mock_reflector = AsyncMock()
        mock_reflector.reflect.side_effect = [
            ReflectionResult(score=4.0, needs_improvement=True, issues=["정보 부족"], suggestions=["추가 검색"], reasoning="부족"),
            ReflectionResult(score=9.0, needs_improvement=False, issues=[], suggestions=[], reasoning="개선됨"),
        ]

        # Synthesizer도 두 번 호출됨
        mock_synthesizer.synthesize.side_effect = [
            ("첫 번째 답변", []),
            ("개선된 답변", []),
        ]

        orchestrator = AgentOrchestrator(
            planner=mock_planner,
            executor=mock_executor,
            synthesizer=mock_synthesizer,
            config=config_with_reflection,
            reflector=mock_reflector,
        )

        result = await orchestrator.run("테스트 질문")

        assert result.success is True
        assert mock_reflector.reflect.call_count == 2
        assert "개선된 답변" in result.answer

    @pytest.mark.asyncio
    async def test_orchestrator_reflection_disabled(
        self, mock_planner, mock_executor, mock_synthesizer,
        mock_reflector, config_without_reflection
    ):
        """Reflection 비활성화 시 건너뜀"""
        orchestrator = AgentOrchestrator(
            planner=mock_planner,
            executor=mock_executor,
            synthesizer=mock_synthesizer,
            config=config_without_reflection,
            reflector=mock_reflector,
        )

        result = await orchestrator.run("테스트 질문")

        assert result.success is True
        # Reflection 비활성화이므로 호출 안됨
        assert mock_reflector.reflect.call_count == 0

    @pytest.mark.asyncio
    async def test_orchestrator_max_reflection_iterations(
        self, mock_planner, mock_executor, mock_synthesizer,
        config_with_reflection
    ):
        """최대 반복 횟수 초과 시 중단"""
        # 계속 낮은 점수 반환
        mock_reflector = AsyncMock()
        mock_reflector.reflect.return_value = ReflectionResult(
            score=3.0, needs_improvement=True,
            issues=["계속 부족"], suggestions=[], reasoning="부족"
        )

        config = AgentConfig(
            enable_reflection=True,
            reflection_threshold=7.0,
            max_reflection_iterations=2  # 최대 2회
        )

        orchestrator = AgentOrchestrator(
            planner=mock_planner,
            executor=mock_executor,
            synthesizer=mock_synthesizer,
            config=config,
            reflector=mock_reflector,
        )

        result = await orchestrator.run("테스트 질문")

        # 최대 2회까지만 반복
        assert mock_reflector.reflect.call_count == 2
        # 최대 반복에도 개선 안되면 마지막 답변 반환
        assert result.success is True
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/modules/core/agent/test_orchestrator_reflection.py -v`
Expected: FAIL with "TypeError: __init__() got unexpected keyword argument 'reflector'"

**Step 3: Write minimal implementation**

```python
# app/modules/core/agent/orchestrator.py 수정

# 1. import 추가
from app.modules.core.agent.reflector import AgentReflector

# 2. __init__ 시그니처 수정 (reflector 파라미터 추가)
def __init__(
    self,
    planner: AgentPlanner,
    executor: AgentExecutor,
    synthesizer: AgentSynthesizer,
    config: AgentConfig,
    reflector: AgentReflector | None = None,  # 신규 (선택적)
) -> None:
    # ... 기존 검증 ...

    self._reflector = reflector

    if reflector and config.enable_reflection:
        logger.info("Self-Reflection 활성화")

# 3. run() 메서드 수정 - Reflection 루프 추가
async def run(
    self,
    query: str,
    session_context: str = "",
) -> AgentResult:
    # ... 기존 코드 (메인 ReAct 루프) ...

    # 5. Synthesize: 최종 답변 생성
    answer, sources = await self._synthesizer.synthesize(state)

    # 🆕 6. Reflect: Self-Reflection 루프
    if self._reflector and self._config.enable_reflection:
        answer, sources = await self._reflection_loop(
            state=state,
            answer=answer,
            sources=sources,
        )

    # ... 나머지 기존 코드 ...

# 4. _reflection_loop() 메서드 추가
async def _reflection_loop(
    self,
    state: AgentState,
    answer: str,
    sources: list[dict[str, Any]],
) -> tuple[str, list[dict[str, Any]]]:
    """
    Self-Reflection 루프

    답변 품질이 threshold 미만이면 개선을 시도합니다.
    최대 max_reflection_iterations 횟수까지 반복합니다.

    Args:
        state: 에이전트 상태
        answer: 현재 답변
        sources: 현재 소스

    Returns:
        tuple[str, list[dict]]: 최종 답변과 소스
    """
    # 컨텍스트 추출 (검색 결과 요약)
    context = self._extract_context_for_reflection(state)

    for iteration in range(self._config.max_reflection_iterations):
        # 1. 답변 품질 평가
        reflection = await self._reflector.reflect(
            query=state.original_query,
            answer=answer,
            context=context,
        )

        logger.info(
            f"Reflection {iteration + 1}: "
            f"score={reflection.score}, "
            f"needs_improvement={reflection.needs_improvement}"
        )

        # 2. 품질이 충분하면 종료
        if not reflection.needs_improvement:
            logger.info("Reflection 완료: 품질 충족")
            break

        # 3. 개선 필요 시 추가 검색 및 재생성
        logger.info(f"Reflection: 개선 시도 (issues={reflection.issues})")

        # 추가 검색 (suggestions 기반)
        if reflection.suggestions:
            await self._additional_search(state, reflection.suggestions)

        # 답변 재생성
        answer, sources = await self._synthesizer.synthesize(state)
        context = self._extract_context_for_reflection(state)

    return answer, sources

def _extract_context_for_reflection(self, state: AgentState) -> str:
    """Reflection용 컨텍스트 추출"""
    parts = []
    for result in state.all_tool_results:
        if result.success and result.data:
            if "documents" in result.data:
                for doc in result.data["documents"][:3]:
                    content = doc.get("content", "")[:200]
                    parts.append(content)
    return "\n".join(parts) if parts else ""

async def _additional_search(
    self,
    state: AgentState,
    suggestions: list[str]
) -> None:
    """개선 제안 기반 추가 검색"""
    # suggestions를 기반으로 추가 검색어 생성
    additional_query = f"{state.original_query} {' '.join(suggestions[:2])}"

    # Planner를 통해 추가 검색 실행
    tool_calls, _, _ = await self._planner.plan(
        AgentState(original_query=additional_query)
    )

    if tool_calls:
        results = await self._executor.execute(tool_calls)
        # 결과를 state에 추가
        from .interfaces import AgentStep
        step = AgentStep(
            step_number=state.current_iteration + 1,
            reasoning="Self-Reflection 추가 검색",
            tool_calls=tool_calls,
            tool_results=results,
            should_continue=False,
        )
        state.steps.append(step)
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/modules/core/agent/test_orchestrator_reflection.py -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add app/modules/core/agent/orchestrator.py tests/modules/core/agent/test_orchestrator_reflection.py
git commit -m "feat: AgentOrchestrator에 Self-Reflection 루프 추가

- reflector 파라미터 추가 (선택적)
- _reflection_loop() 메서드로 품질 개선 루프 구현
- max_reflection_iterations 횟수만큼 반복
- 개선 필요 시 추가 검색 및 답변 재생성"
```

---

## Task 7: AgentFactory에 Reflector 생성 로직 추가

**Files:**
- Modify: `app/modules/core/agent/factory.py`
- Test: `tests/modules/core/agent/test_agent_factory_reflection.py`

**Step 1: Write the failing test**

```python
# tests/modules/core/agent/test_agent_factory_reflection.py
"""
AgentFactory Reflection 생성 테스트
"""
import pytest
from unittest.mock import MagicMock

from app.modules.core.agent.factory import AgentFactory
from app.modules.core.agent.interfaces import AgentConfig
from app.modules.core.agent.reflector import AgentReflector


class TestAgentFactoryReflection:
    """AgentFactory Reflection 생성 테스트"""

    @pytest.fixture
    def mock_llm_client(self):
        return MagicMock()

    @pytest.fixture
    def mock_mcp_server(self):
        server = MagicMock()
        server.get_tool_schemas.return_value = []
        return server

    def test_factory_creates_reflector_when_enabled(
        self, mock_llm_client, mock_mcp_server
    ):
        """enable_reflection=True이면 Reflector 생성"""
        config = AgentConfig(enable_reflection=True)

        factory = AgentFactory(
            llm_client=mock_llm_client,
            mcp_server=mock_mcp_server,
            config=config,
        )

        orchestrator = factory.create_orchestrator()

        assert orchestrator._reflector is not None
        assert isinstance(orchestrator._reflector, AgentReflector)

    def test_factory_no_reflector_when_disabled(
        self, mock_llm_client, mock_mcp_server
    ):
        """enable_reflection=False이면 Reflector 없음"""
        config = AgentConfig(enable_reflection=False)

        factory = AgentFactory(
            llm_client=mock_llm_client,
            mcp_server=mock_mcp_server,
            config=config,
        )

        orchestrator = factory.create_orchestrator()

        assert orchestrator._reflector is None
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/modules/core/agent/test_agent_factory_reflection.py -v`
Expected: FAIL

**Step 3: Write minimal implementation**

```python
# app/modules/core/agent/factory.py 수정

# 1. import 추가
from .reflector import AgentReflector

# 2. create_orchestrator() 메서드 수정
def create_orchestrator(self) -> AgentOrchestrator:
    """에이전트 오케스트레이터 생성"""
    planner = self.create_planner()
    executor = self.create_executor()
    synthesizer = self.create_synthesizer()

    # 🆕 Reflector 생성 (활성화된 경우에만)
    reflector = None
    if self._config.enable_reflection:
        reflector = AgentReflector(
            llm_client=self._llm_client,
            config=self._config,
        )
        logger.info("AgentReflector 생성됨")

    return AgentOrchestrator(
        planner=planner,
        executor=executor,
        synthesizer=synthesizer,
        config=self._config,
        reflector=reflector,  # 신규
    )
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/modules/core/agent/test_agent_factory_reflection.py -v`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add app/modules/core/agent/factory.py tests/modules/core/agent/test_agent_factory_reflection.py
git commit -m "feat: AgentFactory에 Reflector 생성 로직 추가

- enable_reflection=True일 때만 Reflector 생성
- create_orchestrator()에서 reflector 주입"
```

---

## Task 8: 통합 테스트 및 전체 검증

**Files:**
- Create: `tests/integration/test_self_reflection_e2e.py`

**Step 1: Write the integration test**

```python
# tests/integration/test_self_reflection_e2e.py
"""
Self-Reflection E2E 통합 테스트
"""
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.modules.core.agent.factory import AgentFactory
from app.modules.core.agent.interfaces import AgentConfig


class TestSelfReflectionE2E:
    """Self-Reflection 전체 흐름 E2E 테스트"""

    @pytest.fixture
    def mock_llm_client(self):
        """실제 LLM을 모방하는 Mock"""
        client = AsyncMock()

        # 순차적 응답 시뮬레이션
        client.generate_text.side_effect = [
            # 1. Planner 응답
            '{"reasoning": "검색 필요", "tool_calls": [], "should_continue": false}',
            # 2. Synthesizer 첫 번째 응답
            "첫 번째 답변입니다.",
            # 3. Reflector 첫 번째 평가 (낮은 점수)
            '{"score": 5.0, "issues": ["정보 부족"], "suggestions": ["상세 검색"], "reasoning": "부족"}',
            # 4. Planner 추가 검색
            '{"reasoning": "추가 검색", "tool_calls": [], "should_continue": false}',
            # 5. Synthesizer 두 번째 응답 (개선됨)
            "개선된 상세 답변입니다.",
            # 6. Reflector 두 번째 평가 (높은 점수)
            '{"score": 9.0, "issues": [], "suggestions": [], "reasoning": "충분함"}',
        ]

        return client

    @pytest.fixture
    def mock_mcp_server(self):
        server = MagicMock()
        server.get_tool_schemas.return_value = [
            {"name": "search_weaviate", "description": "검색"}
        ]
        return server

    @pytest.mark.asyncio
    async def test_full_reflection_flow(self, mock_llm_client, mock_mcp_server):
        """전체 Self-Reflection 흐름 테스트"""
        config = AgentConfig(
            enable_reflection=True,
            reflection_threshold=7.0,
            max_reflection_iterations=3,
        )

        factory = AgentFactory(
            llm_client=mock_llm_client,
            mcp_server=mock_mcp_server,
            config=config,
        )

        orchestrator = factory.create_orchestrator()
        result = await orchestrator.run("테스트 질문")

        # 검증
        assert result.success is True
        assert "개선된" in result.answer  # 개선된 답변이 반환됨

    @pytest.mark.asyncio
    async def test_reflection_disabled_flow(self, mock_llm_client, mock_mcp_server):
        """Reflection 비활성화 흐름 테스트"""
        # Reflection 없을 때 응답
        mock_llm_client.generate_text.side_effect = [
            '{"reasoning": "검색", "tool_calls": [], "should_continue": false}',
            "단순 답변입니다.",
        ]

        config = AgentConfig(enable_reflection=False)

        factory = AgentFactory(
            llm_client=mock_llm_client,
            mcp_server=mock_mcp_server,
            config=config,
        )

        orchestrator = factory.create_orchestrator()
        result = await orchestrator.run("테스트 질문")

        assert result.success is True
        assert result.answer == "단순 답변입니다."
```

**Step 2: Run test**

Run: `pytest tests/integration/test_self_reflection_e2e.py -v`
Expected: PASS (2 tests)

**Step 3: Run full test suite**

Run: `make test`
Expected: All 1364+ tests pass

**Step 4: Commit**

```bash
git add tests/integration/test_self_reflection_e2e.py
git commit -m "test: Self-Reflection E2E 통합 테스트 추가

- 전체 Reflection 흐름 검증
- 비활성화 시 흐름 검증"
```

---

## Task 9: 최종 검증 및 문서화

**Step 1: 전체 테스트 실행**

```bash
make test
```

Expected: 1370+ tests pass (기존 1364 + 신규 6+)

**Step 2: 린트 검사**

```bash
make lint
```

**Step 3: 타입 검사**

```bash
make type-check
```

**Step 4: CLAUDE.md 업데이트** (선택적)

```markdown
### 9. Self-Reflection Agent (v1.0.8)
- **기능**: 생성된 답변 품질 자체 평가
- **평가 기준**: 정확성, 완전성, 충실성, 명확성, 관련성 (0-10점)
- **개선 루프**: threshold 미만 시 추가 검색 및 답변 재생성
- **설정**: `enable_reflection`, `reflection_threshold`, `max_reflection_iterations`
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "docs: Self-Reflection Agent 구현 완료

- AgentReflector 클래스 추가
- ReflectionResult 데이터 클래스 추가
- AgentOrchestrator Reflection 루프 통합
- AgentFactory Reflector 생성 로직 추가
- 전체 테스트 통과 확인"
```

---

## Summary

| Task | 파일 | 테스트 수 |
|------|------|----------|
| 1 | interfaces.py (ReflectionResult) | 4 |
| 2 | interfaces.py (AgentConfig) | 3 |
| 3 | reflector.py (기본 구조) | 3 |
| 4 | reflector.py (reflect 메서드) | 4 |
| 5 | __init__.py | 1 |
| 6 | orchestrator.py | 4 |
| 7 | factory.py | 2 |
| 8 | E2E 통합 테스트 | 2 |
| **Total** | | **23+** |

**예상 소요 시간**: 약 4-6시간 (TDD 사이클 포함)
