"""
설정 로더(ConfigLoader) 단위 테스트

대상 모듈: app/lib/config_loader.py
테스트 범위: _merge_configs, _convert_value, _substitute_env_vars,
            _set_nested_value, _apply_env_overrides, _load_yaml_file
"""

from pathlib import Path
from typing import Any

import pytest
import yaml

from app.lib.config_loader import ConfigLoader

# ---------------------------------------------------------------------------
# 헬퍼: __init__ 우회하여 ConfigLoader 인스턴스 생성
# ---------------------------------------------------------------------------


def _create_loader(base_path: Path | None = None, environment: str = "test") -> ConfigLoader:
    """__init__을 우회하여 ConfigLoader 인스턴스를 생성한다.

    실제 .env 로드나 환경 감지를 건너뛰고
    private 메서드만 독립적으로 테스트할 수 있다.
    """
    loader = ConfigLoader.__new__(ConfigLoader)
    loader.base_path = base_path or Path("/tmp/test_config")
    loader.environment = environment
    return loader


# ---------------------------------------------------------------------------
# 1. _merge_configs() — 깊은 병합 (4개)
# ---------------------------------------------------------------------------


class TestMergeConfigs:
    """깊은 병합 로직 테스트

    얕은 병합(dict.update)이면 환경별 설정이
    base 설정의 하위 키를 통째로 덮어쓰는 문제가 발생한다.
    깊은 병합이 올바르게 동작하는지 검증한다.
    """

    def setup_method(self) -> None:
        self.loader = _create_loader()

    def test_같은_키의_dict끼리_재귀_병합(self) -> None:
        """base와 override 모두 같은 키에 dict를 가지면
        내부 키가 재귀적으로 병합되어야 한다."""
        base: dict[str, Any] = {"server": {"host": "0.0.0.0", "port": 8000}}
        override: dict[str, Any] = {"server": {"port": 9000}}

        result = self.loader._merge_configs(base, override)

        # port는 덮어쓰이고, host는 유지되어야 한다
        assert result["server"]["port"] == 9000
        assert result["server"]["host"] == "0.0.0.0"

    def test_한쪽에만_있는_키는_추가(self) -> None:
        """base에 없는 키가 override에 있으면 추가되어야 한다."""
        base: dict[str, Any] = {"a": 1}
        override: dict[str, Any] = {"b": 2}

        result = self.loader._merge_configs(base, override)

        assert result == {"a": 1, "b": 2}

    def test_dict가_아닌_값은_override_우선(self) -> None:
        """같은 키에 비-dict 값이 있으면 override가 우선한다."""
        base: dict[str, Any] = {"level": "debug", "items": [1, 2]}
        override: dict[str, Any] = {"level": "info", "items": [3]}

        result = self.loader._merge_configs(base, override)

        assert result["level"] == "info"
        assert result["items"] == [3]

    def test_3단계_이상_중첩_재귀_병합(self) -> None:
        """3단계 이상 중첩된 dict도 재귀적으로 병합되어야 한다."""
        base: dict[str, Any] = {
            "llm": {
                "google": {"api_key": "base-key", "model": "gemini"},
                "timeout": 30,
            }
        }
        override: dict[str, Any] = {
            "llm": {
                "google": {"api_key": "override-key"},
            }
        }

        result = self.loader._merge_configs(base, override)

        # api_key만 덮어쓰이고, model과 timeout은 유지
        assert result["llm"]["google"]["api_key"] == "override-key"
        assert result["llm"]["google"]["model"] == "gemini"
        assert result["llm"]["timeout"] == 30


# ---------------------------------------------------------------------------
# 2. _convert_value() — 타입 변환 (6개)
# ---------------------------------------------------------------------------


class TestConvertValue:
    """환경 변수 문자열을 적절한 Python 타입으로 변환하는 로직 테스트.

    잘못된 변환은 설정 전체가 깨질 수 있어 유의미하다.
    특히 IP 주소가 float로 변환되는 잠재적 버그를 검증한다.
    """

    def setup_method(self) -> None:
        self.loader = _create_loader()

    @pytest.mark.parametrize(
        "input_val,expected",
        [
            ("true", True),
            ("false", False),
            ("True", True),
            ("FALSE", False),
        ],
    )
    def test_불리언_변환_대소문자_무관(self, input_val: str, expected: bool) -> None:
        """'true'/'false' 문자열은 대소문자 무관하게 bool로 변환되어야 한다."""
        assert self.loader._convert_value(input_val) is expected

    def test_정수_변환(self) -> None:
        """순수 정수 문자열은 int로 변환되어야 한다."""
        assert self.loader._convert_value("8000") == 8000
        assert isinstance(self.loader._convert_value("8000"), int)

    def test_소수점_포함_문자열은_float(self) -> None:
        """소수점이 포함된 문자열은 float로 변환되어야 한다."""
        result = self.loader._convert_value("0.3")
        assert result == 0.3
        assert isinstance(result, float)

    def test_API_키_형태는_문자열_유지(self) -> None:
        """API 키처럼 정수/실수로 변환 불가능한 값은 문자열 그대로 유지."""
        api_key = "sk-abc123xyz"
        assert self.loader._convert_value(api_key) == api_key
        assert isinstance(self.loader._convert_value(api_key), str)

    def test_IP_주소_형태가_float로_변환되는_잠재적_버그(self) -> None:
        """IP 주소(예: '100.64.1.1')는 소수점 포함 → float 변환 시도.
        첫 번째 소수점까지만 파싱하거나 에러가 발생할 수 있다.

        현재 구현: '.' 포함이면 float() 시도 → ValueError 발생 시 문자열 유지.
        '100.64.1.1'은 float() 변환 실패 → 문자열 유지된다.
        """
        result = self.loader._convert_value("100.64.1.1")
        # float("100.64.1.1")은 ValueError → 문자열 유지
        assert result == "100.64.1.1"
        assert isinstance(result, str)

    def test_빈_문자열은_그대로_유지(self) -> None:
        """빈 문자열은 변환 없이 빈 문자열로 유지되어야 한다."""
        result = self.loader._convert_value("")
        assert result == ""
        assert isinstance(result, str)


# ---------------------------------------------------------------------------
# 3. _substitute_env_vars() — 환경 변수 치환 (5개)
# ---------------------------------------------------------------------------


class TestSubstituteEnvVars:
    """${VAR_NAME} 패턴의 환경 변수 치환 테스트.

    치환이 실패하면 API 키 등이 리터럴 문자열 그대로 전달된다.
    """

    def setup_method(self) -> None:
        self.loader = _create_loader()

    def test_존재하는_환경_변수_치환(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """설정된 환경 변수는 실제 값으로 치환되어야 한다."""
        monkeypatch.setenv("MY_API_KEY", "real-secret-key")

        config: dict[str, Any] = {"api_key": "${MY_API_KEY}"}
        result = self.loader._substitute_env_vars(config)

        assert result["api_key"] == "real-secret-key"

    def test_존재하지_않는_환경_변수는_원본_유지(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """설정되지 않은 환경 변수는 ${VAR_NAME} 원본 문자열 그대로 유지."""
        monkeypatch.delenv("NON_EXISTING_VAR_XYZ", raising=False)

        config: dict[str, Any] = {"key": "${NON_EXISTING_VAR_XYZ}"}
        result = self.loader._substitute_env_vars(config)

        assert result["key"] == "${NON_EXISTING_VAR_XYZ}"

    def test_기본값_구문_환경_변수_없으면_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """${VAR:-default} 구문에서 환경 변수가 없으면 default 값 반환."""
        monkeypatch.delenv("OPTIONAL_VAR", raising=False)

        config: dict[str, Any] = {"host": "${OPTIONAL_VAR:-localhost}"}
        result = self.loader._substitute_env_vars(config)

        assert result["host"] == "localhost"

    def test_중첩_dict_안의_값도_치환(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """중첩된 dict 내부의 환경 변수도 재귀적으로 치환되어야 한다."""
        monkeypatch.setenv("NESTED_VAL", "deep-value")

        config: dict[str, Any] = {
            "level1": {
                "level2": {
                    "key": "${NESTED_VAL}",
                }
            }
        }
        result = self.loader._substitute_env_vars(config)

        assert result["level1"]["level2"]["key"] == "deep-value"

    def test_list_안의_값도_치환(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """리스트 내부의 환경 변수도 치환되어야 한다."""
        monkeypatch.setenv("LIST_ITEM", "replaced")

        config: dict[str, Any] = {"items": ["static", "${LIST_ITEM}", "other"]}
        result = self.loader._substitute_env_vars(config)

        assert result["items"] == ["static", "replaced", "other"]


# ---------------------------------------------------------------------------
# 4. _set_nested_value() — 중첩 경로 설정 (3개)
# ---------------------------------------------------------------------------


class TestSetNestedValue:
    """중첩된 dict 경로에 값을 설정하는 로직 테스트.

    경로 생성이 실패하면 환경 변수 오버라이드가 무시된다.
    """

    def setup_method(self) -> None:
        self.loader = _create_loader()

    def test_존재하지_않는_중간_키_자동_생성(self) -> None:
        """중간 키가 없으면 빈 dict를 자동으로 생성해야 한다."""
        config: dict[str, Any] = {}

        self.loader._set_nested_value(config, ("llm", "google", "api_key"), "my-key")

        assert config == {"llm": {"google": {"api_key": "my-key"}}}

    def test_기존_값이_dict가_아니면_교체(self) -> None:
        """중간 경로의 기존 값이 dict가 아니면 빈 dict로 교체 후 설정."""
        config: dict[str, Any] = {"server": "string_value"}

        self.loader._set_nested_value(config, ("server", "port"), "8000")

        # "string_value"가 dict로 교체되고 port가 설정되어야 한다
        assert config["server"] == {"port": 8000}

    def test_3단계_중첩_경로_정확한_위치에_값_설정(self) -> None:
        """3단계 중첩 경로에 정확하게 값이 설정되어야 한다."""
        config: dict[str, Any] = {"a": {"b": {"existing": "keep"}}}

        self.loader._set_nested_value(config, ("a", "b", "new_key"), "new_val")

        # 기존 키는 유지되고 새 키가 추가
        assert config["a"]["b"]["existing"] == "keep"
        assert config["a"]["b"]["new_key"] == "new_val"


# ---------------------------------------------------------------------------
# 5. _apply_env_overrides() — 환경 변수 매핑 (3개)
# ---------------------------------------------------------------------------


class TestApplyEnvOverrides:
    """환경 변수 → 설정 dict 경로 매핑 테스트.

    매핑 경로가 잘못되면 환경 변수로 설정한 값이 무시된다.
    실제로 COHERE_API_KEY 매핑에서 이런 버그가 있었다.
    """

    def setup_method(self) -> None:
        self.loader = _create_loader()

    def test_PORT_환경_변수가_server_port로_매핑(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """PORT 환경 변수가 config['server']['port']에 int로 설정되어야 한다."""
        monkeypatch.setenv("PORT", "9090")

        config: dict[str, Any] = {"server": {"host": "0.0.0.0"}}
        result = self.loader._apply_env_overrides(config)

        assert result["server"]["port"] == 9090
        assert isinstance(result["server"]["port"], int)
        # 기존 키는 유지
        assert result["server"]["host"] == "0.0.0.0"

    def test_GOOGLE_API_KEY가_3단계_경로로_매핑(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """GOOGLE_API_KEY가 config['llm']['google']['api_key']에 설정되어야 한다."""
        monkeypatch.setenv("GOOGLE_API_KEY", "AIza-test-key")

        config: dict[str, Any] = {}
        result = self.loader._apply_env_overrides(config)

        assert result["llm"]["google"]["api_key"] == "AIza-test-key"

    def test_미설정_환경_변수는_config_변경_없음(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """매핑에 있는 환경 변수가 설정되지 않았으면 config를 변경하지 않아야 한다."""
        # PORT가 설정되지 않은 상태를 보장
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("HOST", raising=False)
        monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        monkeypatch.delenv("COHERE_API_KEY", raising=False)
        monkeypatch.delenv("REDIS_URL", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)
        monkeypatch.delenv("MONGODB_URI", raising=False)
        monkeypatch.delenv("MONGODB_DATABASE", raising=False)
        monkeypatch.delenv("MONGODB_DB_NAME", raising=False)
        monkeypatch.delenv("MONGODB_TIMEOUT_MS", raising=False)
        monkeypatch.delenv("EMBEDDINGS_PROVIDER", raising=False)
        monkeypatch.delenv("LLM_PROVIDER", raising=False)
        monkeypatch.delenv("LLM_MODEL", raising=False)
        monkeypatch.delenv("GENERATION_PROVIDER", raising=False)

        original: dict[str, Any] = {"server": {"port": 8000}}
        result = self.loader._apply_env_overrides(original)

        assert result == {"server": {"port": 8000}}


# ---------------------------------------------------------------------------
# 6. _load_yaml_file() — YAML 파일 로드 + imports (3개)
# ---------------------------------------------------------------------------


class TestLoadYamlFile:
    """YAML 파일 로드와 imports 재귀 병합 테스트.

    import 파일이 누락되면 설정이 불완전해진다.
    tmp_path를 사용하여 실제 파일 I/O를 검증한다.
    """

    def test_존재하지_않는_파일은_빈_dict(self, tmp_path: Path) -> None:
        """파일이 존재하지 않으면 빈 dict를 반환해야 한다."""
        loader = _create_loader(base_path=tmp_path)
        non_existent = tmp_path / "no_such_file.yaml"

        result = loader._load_yaml_file(non_existent)

        assert result == {}

    def test_imports가_있는_YAML_재귀_병합(self, tmp_path: Path) -> None:
        """imports 키가 있으면 해당 파일들을 재귀적으로 로드하여 병합해야 한다."""
        loader = _create_loader(base_path=tmp_path)

        # import할 하위 파일 생성
        features_dir = tmp_path / "features"
        features_dir.mkdir()

        embeddings_yaml = features_dir / "embeddings.yaml"
        embeddings_yaml.write_text(
            yaml.dump({"embeddings": {"provider": "local", "dim": 384}}),
            encoding="utf-8",
        )

        generation_yaml = features_dir / "generation.yaml"
        generation_yaml.write_text(
            yaml.dump({"generation": {"model": "gemini"}}),
            encoding="utf-8",
        )

        # imports를 포함한 base 파일 생성
        base_yaml = tmp_path / "base.yaml"
        base_content = {
            "imports": [
                "features/embeddings.yaml",
                "features/generation.yaml",
            ],
            "server": {"port": 8000},
        }
        base_yaml.write_text(yaml.dump(base_content), encoding="utf-8")

        result = loader._load_yaml_file(base_yaml)

        # base의 server + import된 embeddings, generation 모두 존재
        assert result["server"]["port"] == 8000
        assert result["embeddings"]["provider"] == "local"
        assert result["embeddings"]["dim"] == 384
        assert result["generation"]["model"] == "gemini"
        # imports 키는 제거되어야 한다
        assert "imports" not in result

    def test_imports가_없는_일반_YAML_정상_로드(self, tmp_path: Path) -> None:
        """imports 키가 없는 일반 YAML 파일은 그대로 로드되어야 한다."""
        loader = _create_loader(base_path=tmp_path)

        simple_yaml = tmp_path / "simple.yaml"
        simple_yaml.write_text(
            yaml.dump({"logging": {"level": "DEBUG"}}),
            encoding="utf-8",
        )

        result = loader._load_yaml_file(simple_yaml)

        assert result == {"logging": {"level": "DEBUG"}}
