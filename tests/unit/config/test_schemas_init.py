"""
app/config/schemas/__init__.py 모듈 테스트

Phase 2 R2.1: 레거시 동적 import 제거, 직접 함수 정의로 전환
TDD RED 단계 - 테스트 먼저 작성
"""

from pathlib import Path


class TestDetectDuplicateKeysInYaml:
    """detect_duplicate_keys_in_yaml 함수 테스트"""

    def test_import_from_schemas_package(self) -> None:
        """schemas 패키지에서 함수 import 가능 확인"""
        from app.config.schemas import detect_duplicate_keys_in_yaml

        assert callable(detect_duplicate_keys_in_yaml)

    def test_no_duplicates(self, tmp_path: Path) -> None:
        """중복 키가 없는 YAML 파일"""
        from app.config.schemas import detect_duplicate_keys_in_yaml

        yaml_content = """
app:
  name: test
server:
  port: 8000
database:
  host: localhost
"""
        yaml_file = tmp_path / "test.yaml"
        yaml_file.write_text(yaml_content)

        result = detect_duplicate_keys_in_yaml(str(yaml_file))
        assert result == []

    def test_with_duplicates(self, tmp_path: Path) -> None:
        """중복 키가 있는 YAML 파일"""
        from app.config.schemas import detect_duplicate_keys_in_yaml

        yaml_content = """app:
  name: first
server:
  port: 8000
app:
  name: second
"""
        yaml_file = tmp_path / "test.yaml"
        yaml_file.write_text(yaml_content)

        result = detect_duplicate_keys_in_yaml(str(yaml_file))
        assert len(result) == 1
        assert "app" in result[0]


class TestValidateConfigDict:
    """validate_config_dict 함수 테스트"""

    def test_import_from_schemas_package(self) -> None:
        """schemas 패키지에서 함수 import 가능 확인"""
        from app.config.schemas import validate_config_dict

        assert callable(validate_config_dict)


class TestBM25ConfigAndPrivacyConfig:
    """BM25Config, PrivacyConfig 클래스 테스트"""

    def test_import_bm25_config(self) -> None:
        """BM25Config import 가능 확인"""
        from app.config.schemas import BM25Config

        assert BM25Config is not None

    def test_import_privacy_config(self) -> None:
        """PrivacyConfig import 가능 확인"""
        from app.config.schemas import PrivacyConfig

        assert PrivacyConfig is not None


class TestGenerationConfigMaxTokens:
    """GenerationConfig max_tokens 범위 통일 테스트 (3-4)"""

    def test_max_tokens_minimum_is_1(self) -> None:
        """max_tokens 최소값이 1이어야 함 (기존 100에서 변경)"""
        from app.config.schemas.generation import GenerationConfig

        config = GenerationConfig(max_tokens=1)
        assert config.max_tokens == 1

    def test_max_tokens_maximum_is_128000(self) -> None:
        """max_tokens 최대값이 128000이어야 함 (기존 32000에서 변경)"""
        from app.config.schemas.generation import GenerationConfig

        config = GenerationConfig(max_tokens=128000)
        assert config.max_tokens == 128000

    def test_max_tokens_rejects_zero(self) -> None:
        """max_tokens=0 거부"""
        import pytest
        from pydantic import ValidationError

        from app.config.schemas.generation import GenerationConfig

        with pytest.raises(ValidationError):
            GenerationConfig(max_tokens=0)

    def test_max_tokens_rejects_negative(self) -> None:
        """max_tokens 음수 거부"""
        import pytest
        from pydantic import ValidationError

        from app.config.schemas.generation import GenerationConfig

        with pytest.raises(ValidationError):
            GenerationConfig(max_tokens=-1)

    def test_max_tokens_rejects_over_128000(self) -> None:
        """max_tokens 128001 이상 거부"""
        import pytest
        from pydantic import ValidationError

        from app.config.schemas.generation import GenerationConfig

        with pytest.raises(ValidationError):
            GenerationConfig(max_tokens=128001)

    def test_max_tokens_default_unchanged(self) -> None:
        """기본값 2048 유지 확인"""
        from app.config.schemas.generation import GenerationConfig

        config = GenerationConfig()
        assert config.max_tokens == 2048

    def test_max_tokens_matches_llm_provider_settings(self) -> None:
        """GenerationConfig와 LLMProviderSettings의 max_tokens 범위 일치 확인"""
        from app.config.schemas.generation import GenerationConfig
        from app.lib.config_validator import LLMProviderSettings

        gen_field = GenerationConfig.model_fields["max_tokens"]
        llm_field = LLMProviderSettings.model_fields["max_tokens"]

        # metadata에서 ge/le 값 추출 (별도 객체로 저장됨)
        def extract_constraint(field_info, attr: str) -> int | None:  # type: ignore[no-untyped-def]
            """Pydantic FieldInfo metadata에서 ge/le 제약조건 추출"""
            for m in field_info.metadata:
                if hasattr(m, attr):
                    return getattr(m, attr)  # type: ignore[no-any-return]
            return None

        # ge (최소값) 일치
        gen_ge = extract_constraint(gen_field, "ge")
        llm_ge = extract_constraint(llm_field, "ge")
        assert gen_ge == llm_ge, f"최소값 불일치: GenerationConfig={gen_ge}, LLMProviderSettings={llm_ge}"

        # le (최대값) 일치
        gen_le = extract_constraint(gen_field, "le")
        llm_le = extract_constraint(llm_field, "le")
        assert gen_le == llm_le, f"최대값 불일치: GenerationConfig={gen_le}, LLMProviderSettings={llm_le}"


class TestSchemasPackageExports:
    """schemas 패키지 __all__ export 테스트"""

    def test_all_exports_available(self) -> None:
        """모든 __all__ 항목이 import 가능"""
        from app.config import schemas

        expected_exports = [
            "BaseConfig",
            "RetrievalConfig",
            "GenerationConfig",
            "RerankingConfig",
            "RootConfig",
            "validate_config",
            "detect_duplicate_keys_in_yaml",
            "validate_config_dict",
            "BM25Config",
            "PrivacyConfig",
        ]

        for export in expected_exports:
            assert hasattr(schemas, export), f"{export}가 schemas에서 export되지 않음"
