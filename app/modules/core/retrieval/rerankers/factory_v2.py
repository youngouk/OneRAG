"""
RerankerFactory v2 - 3단계 계층 구조 기반 리랭커 팩토리

approach/provider/model 구조로 리랭커를 생성합니다.

approach별 설명:
- llm: 범용 LLM을 사용한 리랭킹 (Gemini, GPT 등)
- cross-encoder: 쿼리+문서를 함께 인코딩하는 전용 리랭커 (Jina Reranker, Cohere)
- late-interaction: 토큰 레벨 상호작용 (ColBERT)

사용 예시:
    from app.modules.core.retrieval.rerankers.factory_v2 import RerankerFactoryV2

    config = {
        "reranking": {
            "approach": "cross-encoder",
            "provider": "jina",
            "jina": {"model": "jina-reranker-v2-base-multilingual"}
        }
    }
    reranker = RerankerFactoryV2.create(config)
"""

import os
from typing import Any

from .....lib.logger import get_logger
from ..interfaces import IReranker
from .colbert_reranker import ColBERTRerankerConfig, JinaColBERTReranker
from .gemini_reranker import GeminiFlashReranker
from .jina_reranker import JinaReranker
from .openai_llm_reranker import OpenAILLMReranker

logger = get_logger(__name__)


# ========================================
# 레지스트리 정의
# ========================================

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
}

PROVIDER_REGISTRY: dict[str, dict[str, Any]] = {
    "google": {
        "class": GeminiFlashReranker,
        "api_key_env": "GOOGLE_API_KEY",
        "default_config": {
            "model": "gemini-flash-lite-latest",
            "max_documents": 20,
            "timeout": 15,
        },
    },
    "openai": {
        "class": OpenAILLMReranker,
        "api_key_env": "OPENAI_API_KEY",
        "default_config": {
            "model": "gpt-5-nano",
            "max_documents": 20,
            "timeout": 15,
            "verbosity": "low",
            "reasoning_effort": "minimal",
        },
    },
    "jina": {
        "class_cross_encoder": JinaReranker,
        "class_late_interaction": JinaColBERTReranker,
        "api_key_env": "JINA_API_KEY",
        "default_config": {
            "model": "jina-reranker-v2-base-multilingual",
            "top_n": 10,
            "timeout": 30,
            "max_documents": 20,
        },
        "default_config_colbert": {
            "model": "jina-colbert-v2",
            "top_n": 10,
            "timeout": 10,
            "max_documents": 20,
        },
    },
    "cohere": {
        "class": None,  # CohereReranker 구현 시 추가
        "api_key_env": "COHERE_API_KEY",
        "default_config": {
            "model": "rerank-multilingual-v3.0",
            "top_n": 10,
        },
    },
    "openrouter": {
        "class": None,  # OpenRouterReranker 구현 시 추가
        "api_key_env": "OPENROUTER_API_KEY",
        "default_config": {
            "model": "google/gemini-2.5-flash-lite",
            "max_documents": 20,
            "timeout": 15,
        },
    },
}


# ========================================
# Factory 클래스
# ========================================


class RerankerFactoryV2:
    """
    3단계 계층 구조 기반 리랭커 팩토리

    approach → provider → model 순으로 설정을 해석하여
    적절한 리랭커 인스턴스를 생성합니다.
    """

    @staticmethod
    def create(config: dict[str, Any]) -> IReranker:
        """
        설정 기반 리랭커 인스턴스 생성

        Args:
            config: 전체 설정 딕셔너리 (reranking 섹션 포함)

        Returns:
            IReranker 인터페이스를 구현한 리랭커 인스턴스

        Raises:
            ValueError: 유효하지 않은 approach-provider 조합 또는 API 키 누락
        """
        reranking_config = config.get("reranking", {})
        approach = reranking_config.get("approach", "cross-encoder")
        provider = reranking_config.get("provider", "jina")

        logger.info(f"🔄 RerankerFactoryV2: approach={approach}, provider={provider}")

        # approach 검증
        if approach not in APPROACH_REGISTRY:
            raise ValueError(
                f"지원하지 않는 approach: {approach}. "
                f"지원 목록: {list(APPROACH_REGISTRY.keys())}"
            )

        # approach-provider 조합 검증
        valid_providers = APPROACH_REGISTRY[approach]["providers"]
        if provider not in valid_providers:
            raise ValueError(
                f"approach '{approach}'에서 provider '{provider}'는 사용할 수 없습니다. "
                f"유효한 provider: {valid_providers}"
            )

        # provider 검증
        if provider not in PROVIDER_REGISTRY:
            raise ValueError(
                f"지원하지 않는 provider: {provider}. "
                f"지원 목록: {list(PROVIDER_REGISTRY.keys())}"
            )

        # 리랭커 생성
        if approach == "llm":
            return RerankerFactoryV2._create_llm_reranker(provider, reranking_config)
        elif approach == "cross-encoder":
            return RerankerFactoryV2._create_cross_encoder_reranker(
                provider, reranking_config
            )
        elif approach == "late-interaction":
            return RerankerFactoryV2._create_late_interaction_reranker(
                provider, reranking_config
            )
        else:
            raise ValueError(f"알 수 없는 approach: {approach}")

    @staticmethod
    def _create_llm_reranker(provider: str, config: dict[str, Any]) -> IReranker:
        """LLM approach 리랭커 생성"""
        provider_info = PROVIDER_REGISTRY[provider]
        api_key = os.getenv(provider_info["api_key_env"])

        if not api_key:
            raise ValueError(
                f"{provider_info['api_key_env']} 환경변수가 설정되지 않았습니다. "
                f"API key가 필요합니다."
            )

        provider_config = config.get(provider, {})
        defaults = provider_info["default_config"]

        if provider == "google":
            reranker = GeminiFlashReranker(
                api_key=api_key,
                model=provider_config.get("model", defaults["model"]),
                max_documents=provider_config.get(
                    "max_documents", defaults["max_documents"]
                ),
                timeout=provider_config.get("timeout", defaults["timeout"]),
            )
        elif provider == "openai":
            reranker = OpenAILLMReranker(
                api_key=api_key,
                model=provider_config.get("model", defaults["model"]),
                max_documents=provider_config.get(
                    "max_documents", defaults["max_documents"]
                ),
                timeout=provider_config.get("timeout", defaults["timeout"]),
                verbosity=provider_config.get("verbosity", defaults["verbosity"]),
                reasoning_effort=provider_config.get(
                    "reasoning_effort", defaults["reasoning_effort"]
                ),
            )
        else:
            raise ValueError(
                f"LLM approach에서 {provider}는 아직 지원되지 않습니다."
            )

        logger.info(f"✅ {reranker.__class__.__name__} 생성 완료")
        return reranker

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
        else:
            raise ValueError(
                f"Cross-encoder approach에서 {provider}는 아직 지원되지 않습니다."
            )

        logger.info(f"✅ {reranker.__class__.__name__} 생성 완료")
        return reranker

    @staticmethod
    def _create_late_interaction_reranker(
        provider: str, config: dict[str, Any]
    ) -> IReranker:
        """Late-interaction approach 리랭커 생성"""
        provider_info = PROVIDER_REGISTRY[provider]
        api_key = os.getenv(provider_info["api_key_env"])

        if not api_key:
            raise ValueError(
                f"{provider_info['api_key_env']} 환경변수가 설정되지 않았습니다. "
                f"API key가 필요합니다."
            )

        provider_config = config.get(provider, {})
        defaults = provider_info.get(
            "default_config_colbert", provider_info["default_config"]
        )

        if provider == "jina":
            colbert_config = ColBERTRerankerConfig(
                enabled=True,
                api_key=api_key,
                model=provider_config.get("model", defaults["model"]),
                timeout=provider_config.get("timeout", defaults.get("timeout", 10)),
                max_documents=provider_config.get(
                    "max_documents", defaults.get("max_documents", 20)
                ),
            )
            reranker = JinaColBERTReranker(config=colbert_config)
        else:
            raise ValueError(
                f"Late-interaction approach에서 {provider}는 아직 지원되지 않습니다."
            )

        logger.info(f"✅ {reranker.__class__.__name__} 생성 완료")
        return reranker

    # ========================================
    # 헬퍼 메서드
    # ========================================

    @staticmethod
    def get_approaches() -> list[str]:
        """지원하는 approach 목록 반환"""
        return list(APPROACH_REGISTRY.keys())

    @staticmethod
    def get_providers_for_approach(approach: str) -> list[str]:
        """특정 approach에서 사용 가능한 provider 목록 반환"""
        if approach not in APPROACH_REGISTRY:
            return []
        return APPROACH_REGISTRY[approach]["providers"]

    @staticmethod
    def get_approach_description(approach: str) -> str:
        """approach 설명 반환"""
        if approach not in APPROACH_REGISTRY:
            return "알 수 없는 approach"
        return APPROACH_REGISTRY[approach]["description"]

    @staticmethod
    def get_all_providers() -> list[str]:
        """모든 provider 목록 반환"""
        return list(PROVIDER_REGISTRY.keys())
