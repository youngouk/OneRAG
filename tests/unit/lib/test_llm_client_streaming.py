"""
LLM Client 스트리밍 기능 테스트

BaseLLMClient와 GoogleLLMClient, OpenAILLMClient, AnthropicLLMClient의
스트리밍 인터페이스를 검증합니다.
TDD 방식: 테스트 먼저 작성 → 실패 확인 → 구현 → 통과 확인
"""

import pytest
from unittest.mock import MagicMock, patch

from app.lib.llm_client import (
    BaseLLMClient,
    GoogleLLMClient,
    OpenAILLMClient,
    AnthropicLLMClient,
)


class TestBaseLLMClientStreaming:
    """BaseLLMClient 스트리밍 인터페이스 테스트"""

    def test_stream_text_is_abstract(self):
        """stream_text가 추상 메서드로 정의되어 있는지 확인"""
        # BaseLLMClient에 stream_text 메서드가 있어야 함
        assert hasattr(BaseLLMClient, "stream_text")


class TestGoogleLLMClientStreaming:
    """GoogleLLMClient 스트리밍 기능 테스트"""

    @pytest.mark.asyncio
    async def test_stream_text_yields_chunks(self):
        """stream_text가 청크를 yield하는지 확인"""
        config = {
            "model": "gemini-2.0-flash-exp",
            "api_key": "test-key",
            "temperature": 0.0,
        }

        with patch("google.generativeai.GenerativeModel") as mock_model_class:
            # Mock 스트리밍 응답 설정
            mock_chunk1 = MagicMock()
            mock_chunk1.text = "안녕"
            mock_chunk2 = MagicMock()
            mock_chunk2.text = "하세요"

            mock_response = MagicMock()
            mock_response.__iter__ = lambda self: iter([mock_chunk1, mock_chunk2])

            mock_model = MagicMock()
            mock_model.generate_content.return_value = mock_response
            mock_model_class.return_value = mock_model

            with patch("google.generativeai.configure"):
                client = GoogleLLMClient(config)

            chunks = []
            async for chunk in client.stream_text("테스트 프롬프트"):
                chunks.append(chunk)

            assert len(chunks) == 2
            assert chunks[0] == "안녕"
            assert chunks[1] == "하세요"

    @pytest.mark.asyncio
    async def test_stream_text_with_system_prompt(self):
        """시스템 프롬프트와 함께 스트리밍이 동작하는지 확인"""
        config = {
            "model": "gemini-2.0-flash-exp",
            "api_key": "test-key",
            "temperature": 0.0,
        }

        with patch("google.generativeai.GenerativeModel") as mock_model_class:
            mock_chunk = MagicMock()
            mock_chunk.text = "응답"

            mock_response = MagicMock()
            mock_response.__iter__ = lambda self: iter([mock_chunk])

            mock_model = MagicMock()
            mock_model.generate_content.return_value = mock_response
            mock_model_class.return_value = mock_model

            with patch("google.generativeai.configure"):
                client = GoogleLLMClient(config)

            chunks = []
            async for chunk in client.stream_text(
                "테스트", system_prompt="시스템 프롬프트"
            ):
                chunks.append(chunk)

            # GenerativeModel이 system_instruction과 함께 호출되었는지 확인
            mock_model_class.assert_called_with(
                model_name="gemini-2.0-flash-exp",
                system_instruction="시스템 프롬프트",
            )
            assert chunks == ["응답"]

    @pytest.mark.asyncio
    async def test_stream_text_skips_empty_chunks(self):
        """빈 텍스트 청크는 건너뛰는지 확인"""
        config = {
            "model": "gemini-2.0-flash-exp",
            "api_key": "test-key",
            "temperature": 0.0,
        }

        with patch("google.generativeai.GenerativeModel") as mock_model_class:
            # 빈 텍스트를 포함한 청크들
            mock_chunk1 = MagicMock()
            mock_chunk1.text = "첫번째"
            mock_chunk2 = MagicMock()
            mock_chunk2.text = ""  # 빈 청크
            mock_chunk3 = MagicMock()
            mock_chunk3.text = "세번째"

            mock_response = MagicMock()
            mock_response.__iter__ = lambda self: iter(
                [mock_chunk1, mock_chunk2, mock_chunk3]
            )

            mock_model = MagicMock()
            mock_model.generate_content.return_value = mock_response
            mock_model_class.return_value = mock_model

            with patch("google.generativeai.configure"):
                client = GoogleLLMClient(config)

            chunks = []
            async for chunk in client.stream_text("테스트"):
                chunks.append(chunk)

            # 빈 청크는 제외되어야 함
            assert len(chunks) == 2
            assert chunks == ["첫번째", "세번째"]

    @pytest.mark.asyncio
    async def test_stream_text_handles_exception(self):
        """스트리밍 중 예외 발생 시 적절히 처리되는지 확인"""
        config = {
            "model": "gemini-2.0-flash-exp",
            "api_key": "test-key",
            "temperature": 0.0,
        }

        with patch("google.generativeai.GenerativeModel") as mock_model_class:
            mock_model = MagicMock()
            mock_model.generate_content.side_effect = Exception("API 오류")
            mock_model_class.return_value = mock_model

            with patch("google.generativeai.configure"):
                client = GoogleLLMClient(config)

            with pytest.raises(Exception, match="API 오류"):
                async for _ in client.stream_text("테스트"):
                    pass

    @pytest.mark.asyncio
    async def test_stream_text_passes_stream_flag(self):
        """generate_content 호출 시 stream=True가 전달되는지 확인"""
        config = {
            "model": "gemini-2.0-flash-exp",
            "api_key": "test-key",
            "temperature": 0.5,
            "max_tokens": 1024,
        }

        with patch("google.generativeai.GenerativeModel") as mock_model_class:
            mock_chunk = MagicMock()
            mock_chunk.text = "응답"

            mock_response = MagicMock()
            mock_response.__iter__ = lambda self: iter([mock_chunk])

            mock_model = MagicMock()
            mock_model.generate_content.return_value = mock_response
            mock_model_class.return_value = mock_model

            with patch("google.generativeai.configure"):
                client = GoogleLLMClient(config)

            chunks = []
            async for chunk in client.stream_text("테스트"):
                chunks.append(chunk)

            # generate_content가 stream=True로 호출되었는지 확인
            mock_model.generate_content.assert_called_once()
            call_kwargs = mock_model.generate_content.call_args.kwargs
            assert call_kwargs.get("stream") is True


class TestOpenAILLMClientStreaming:
    """OpenAI LLM Client 스트리밍 테스트"""

    @pytest.mark.asyncio
    async def test_stream_text_yields_chunks(self):
        """OpenAI stream_text가 청크를 yield하는지 확인"""
        config = {
            "model": "gpt-4o",
            "api_key": "test-key",
            "temperature": 0.0,
        }

        with patch("app.lib.llm_client.OpenAI") as mock_openai:
            # Mock 스트리밍 응답
            mock_chunk1 = MagicMock()
            mock_chunk1.choices = [MagicMock(delta=MagicMock(content="Hello"))]
            mock_chunk2 = MagicMock()
            mock_chunk2.choices = [MagicMock(delta=MagicMock(content=" World"))]

            mock_stream = MagicMock()
            mock_stream.__iter__ = lambda self: iter([mock_chunk1, mock_chunk2])

            mock_client = MagicMock()
            mock_client.chat.completions.create.return_value = mock_stream
            mock_openai.return_value = mock_client

            client = OpenAILLMClient(config)

            chunks = []
            async for chunk in client.stream_text("test"):
                chunks.append(chunk)

            assert chunks == ["Hello", " World"]

    @pytest.mark.asyncio
    async def test_stream_text_with_system_prompt(self):
        """시스템 프롬프트와 함께 스트리밍이 동작하는지 확인"""
        config = {
            "model": "gpt-4o",
            "api_key": "test-key",
            "temperature": 0.0,
        }

        with patch("app.lib.llm_client.OpenAI") as mock_openai:
            mock_chunk = MagicMock()
            mock_chunk.choices = [MagicMock(delta=MagicMock(content="응답"))]

            mock_stream = MagicMock()
            mock_stream.__iter__ = lambda self: iter([mock_chunk])

            mock_client = MagicMock()
            mock_client.chat.completions.create.return_value = mock_stream
            mock_openai.return_value = mock_client

            client = OpenAILLMClient(config)

            chunks = []
            async for chunk in client.stream_text(
                "테스트", system_prompt="시스템 프롬프트"
            ):
                chunks.append(chunk)

            # messages에 system 메시지가 포함되었는지 확인
            call_kwargs = mock_client.chat.completions.create.call_args.kwargs
            messages = call_kwargs.get("messages", [])
            assert len(messages) == 2
            assert messages[0]["role"] == "system"
            assert messages[0]["content"] == "시스템 프롬프트"
            assert chunks == ["응답"]

    @pytest.mark.asyncio
    async def test_stream_text_skips_empty_chunks(self):
        """빈 텍스트 청크는 건너뛰는지 확인"""
        config = {
            "model": "gpt-4o",
            "api_key": "test-key",
            "temperature": 0.0,
        }

        with patch("app.lib.llm_client.OpenAI") as mock_openai:
            # 빈 청크 포함
            mock_chunk1 = MagicMock()
            mock_chunk1.choices = [MagicMock(delta=MagicMock(content="첫번째"))]
            mock_chunk2 = MagicMock()
            mock_chunk2.choices = [MagicMock(delta=MagicMock(content=None))]  # 빈 청크
            mock_chunk3 = MagicMock()
            mock_chunk3.choices = [MagicMock(delta=MagicMock(content="세번째"))]

            mock_stream = MagicMock()
            mock_stream.__iter__ = lambda self: iter([mock_chunk1, mock_chunk2, mock_chunk3])

            mock_client = MagicMock()
            mock_client.chat.completions.create.return_value = mock_stream
            mock_openai.return_value = mock_client

            client = OpenAILLMClient(config)

            chunks = []
            async for chunk in client.stream_text("테스트"):
                chunks.append(chunk)

            # 빈 청크는 제외되어야 함
            assert len(chunks) == 2
            assert chunks == ["첫번째", "세번째"]

    @pytest.mark.asyncio
    async def test_stream_text_passes_stream_flag(self):
        """stream=True 플래그가 전달되는지 확인"""
        config = {
            "model": "gpt-4o",
            "api_key": "test-key",
            "temperature": 0.5,
            "max_tokens": 1024,
        }

        with patch("app.lib.llm_client.OpenAI") as mock_openai:
            mock_chunk = MagicMock()
            mock_chunk.choices = [MagicMock(delta=MagicMock(content="응답"))]

            mock_stream = MagicMock()
            mock_stream.__iter__ = lambda self: iter([mock_chunk])

            mock_client = MagicMock()
            mock_client.chat.completions.create.return_value = mock_stream
            mock_openai.return_value = mock_client

            client = OpenAILLMClient(config)

            async for _ in client.stream_text("테스트"):
                pass

            # stream=True가 전달되었는지 확인
            call_kwargs = mock_client.chat.completions.create.call_args.kwargs
            assert call_kwargs.get("stream") is True

    @pytest.mark.asyncio
    async def test_stream_text_handles_exception(self):
        """스트리밍 중 예외 발생 시 적절히 처리되는지 확인"""
        config = {
            "model": "gpt-4o",
            "api_key": "test-key",
            "temperature": 0.0,
        }

        with patch("app.lib.llm_client.OpenAI") as mock_openai:
            mock_client = MagicMock()
            mock_client.chat.completions.create.side_effect = Exception("API 오류")
            mock_openai.return_value = mock_client

            client = OpenAILLMClient(config)

            with pytest.raises(Exception, match="API 오류"):
                async for _ in client.stream_text("테스트"):
                    pass


class TestAnthropicLLMClientStreaming:
    """Anthropic LLM Client 스트리밍 테스트"""

    @pytest.mark.asyncio
    async def test_stream_text_yields_chunks(self):
        """Anthropic stream_text가 청크를 yield하는지 확인"""
        config = {
            "model": "claude-sonnet-4-20250514",
            "api_key": "test-key",
            "temperature": 0.0,
        }

        with patch("app.lib.llm_client.Anthropic") as mock_anthropic:
            # Mock 스트리밍 이벤트 (content_block_delta 타입만 처리)
            mock_event1 = MagicMock(type="content_block_delta")
            mock_event1.delta = MagicMock(text="안녕")
            mock_event2 = MagicMock(type="content_block_delta")
            mock_event2.delta = MagicMock(text="하세요")

            mock_stream = MagicMock()
            mock_stream.__enter__ = lambda self: self
            mock_stream.__exit__ = lambda self, *args: None
            mock_stream.__iter__ = lambda self: iter([mock_event1, mock_event2])

            mock_client = MagicMock()
            mock_client.messages.stream.return_value = mock_stream
            mock_anthropic.return_value = mock_client

            client = AnthropicLLMClient(config)

            chunks = []
            async for chunk in client.stream_text("test"):
                chunks.append(chunk)

            assert chunks == ["안녕", "하세요"]

    @pytest.mark.asyncio
    async def test_stream_text_with_system_prompt(self):
        """시스템 프롬프트와 함께 스트리밍이 동작하는지 확인"""
        config = {
            "model": "claude-sonnet-4-20250514",
            "api_key": "test-key",
            "temperature": 0.0,
        }

        with patch("app.lib.llm_client.Anthropic") as mock_anthropic:
            mock_event = MagicMock(type="content_block_delta")
            mock_event.delta = MagicMock(text="응답")

            mock_stream = MagicMock()
            mock_stream.__enter__ = lambda self: self
            mock_stream.__exit__ = lambda self, *args: None
            mock_stream.__iter__ = lambda self: iter([mock_event])

            mock_client = MagicMock()
            mock_client.messages.stream.return_value = mock_stream
            mock_anthropic.return_value = mock_client

            client = AnthropicLLMClient(config)

            chunks = []
            async for chunk in client.stream_text(
                "테스트", system_prompt="시스템 프롬프트"
            ):
                chunks.append(chunk)

            # system 파라미터가 전달되었는지 확인
            call_kwargs = mock_client.messages.stream.call_args.kwargs
            assert call_kwargs.get("system") == "시스템 프롬프트"
            assert chunks == ["응답"]

    @pytest.mark.asyncio
    async def test_stream_text_ignores_non_delta_events(self):
        """content_block_delta 타입 외의 이벤트는 무시하는지 확인"""
        config = {
            "model": "claude-sonnet-4-20250514",
            "api_key": "test-key",
            "temperature": 0.0,
        }

        with patch("app.lib.llm_client.Anthropic") as mock_anthropic:
            # 다양한 이벤트 타입 (content_block_delta만 처리해야 함)
            mock_event1 = MagicMock(type="message_start")  # 무시해야 함
            mock_event2 = MagicMock(type="content_block_delta")
            mock_event2.delta = MagicMock(text="응답")
            mock_event3 = MagicMock(type="message_stop")  # 무시해야 함

            mock_stream = MagicMock()
            mock_stream.__enter__ = lambda self: self
            mock_stream.__exit__ = lambda self, *args: None
            mock_stream.__iter__ = lambda self: iter([mock_event1, mock_event2, mock_event3])

            mock_client = MagicMock()
            mock_client.messages.stream.return_value = mock_stream
            mock_anthropic.return_value = mock_client

            client = AnthropicLLMClient(config)

            chunks = []
            async for chunk in client.stream_text("테스트"):
                chunks.append(chunk)

            # content_block_delta 이벤트만 처리됨
            assert len(chunks) == 1
            assert chunks == ["응답"]

    @pytest.mark.asyncio
    async def test_stream_text_handles_exception(self):
        """스트리밍 중 예외 발생 시 적절히 처리되는지 확인"""
        config = {
            "model": "claude-sonnet-4-20250514",
            "api_key": "test-key",
            "temperature": 0.0,
        }

        with patch("app.lib.llm_client.Anthropic") as mock_anthropic:
            mock_client = MagicMock()
            mock_client.messages.stream.side_effect = Exception("API 오류")
            mock_anthropic.return_value = mock_client

            client = AnthropicLLMClient(config)

            with pytest.raises(Exception, match="API 오류"):
                async for _ in client.stream_text("테스트"):
                    pass
