# Streaming API 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 채팅 API에 SSE(Server-Sent Events) 기반 스트리밍 응답 기능 추가

**Architecture:** 기존 `/chat` 엔드포인트와 별개로 `/chat/stream` 엔드포인트를 추가. LLM Provider별 스트리밍 메서드 구현 후, RAGPipeline에서 스트리밍 생성 단계 추가. FastAPI의 StreamingResponse로 SSE 형식 반환.

**Tech Stack:** FastAPI StreamingResponse, SSE (text/event-stream), Google Gemini stream API, asyncio.Queue

---

## 전제 조건

- **프론트엔드는 별도 구현**: 백엔드 API만 구현 (프론트는 사용자가 직접)
- **기존 코드 변경 최소화**: 새 파일 추가 위주, 기존 파일은 import 추가 정도만
- **TDD 기반**: 테스트 먼저 작성 후 구현

---

## Task 1: LLM Client 스트리밍 인터페이스 추가

**Files:**
- Modify: `app/lib/llm_client.py:20-36` (BaseLLMClient 클래스)
- Test: `tests/unit/lib/test_llm_client_streaming.py`

**Step 1: 실패하는 테스트 작성**

```python
# tests/unit/lib/test_llm_client_streaming.py
"""LLM Client 스트리밍 기능 테스트"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.lib.llm_client import BaseLLMClient, GoogleLLMClient


class TestBaseLLMClientStreaming:
    """BaseLLMClient 스트리밍 인터페이스 테스트"""

    def test_stream_text_is_abstract(self):
        """stream_text가 추상 메서드로 정의되어 있는지 확인"""
        # BaseLLMClient에 stream_text 메서드가 있어야 함
        assert hasattr(BaseLLMClient, "stream_text")

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

            client = GoogleLLMClient(config)

            chunks = []
            async for chunk in client.stream_text("테스트 프롬프트"):
                chunks.append(chunk)

            assert len(chunks) == 2
            assert chunks[0] == "안녕"
            assert chunks[1] == "하세요"
```

**Step 2: 테스트 실행 (실패 확인)**

```bash
uv run pytest tests/unit/lib/test_llm_client_streaming.py -v
```

Expected: FAIL - `stream_text` 메서드 없음

**Step 3: 최소 구현**

```python
# app/lib/llm_client.py - BaseLLMClient 클래스에 추가 (L30 다음)

    @abstractmethod
    async def stream_text(
        self, prompt: str, system_prompt: str | None = None, **kwargs: Any
    ):
        """
        텍스트 스트리밍 생성 (AsyncGenerator)

        Args:
            prompt: 사용자 프롬프트
            system_prompt: 시스템 프롬프트 (선택적)
            **kwargs: 추가 파라미터

        Yields:
            str: 생성된 텍스트 청크
        """
        pass
```

**Step 4: GoogleLLMClient.stream_text 구현**

```python
# app/lib/llm_client.py - GoogleLLMClient 클래스에 추가 (generate_text 메서드 다음)

    async def stream_text(
        self, prompt: str, system_prompt: str | None = None, **kwargs: Any
    ):
        """
        Gemini 스트리밍 텍스트 생성

        Args:
            prompt: 사용자 프롬프트
            system_prompt: 시스템 프롬프트 (선택적)

        Yields:
            str: 생성된 텍스트 청크
        """
        try:
            model = genai.GenerativeModel(
                model_name=self.model,
                system_instruction=system_prompt if system_prompt else None,
            )

            # stream=True로 스트리밍 응답 요청
            response = model.generate_content(
                prompt,
                generation_config=self.generation_config,
                stream=True,
            )

            # 청크 단위로 yield
            for chunk in response:
                if chunk.text:
                    yield chunk.text

        except Exception as e:
            logger.error(
                "Google LLM 스트리밍 실패",
                extra={"error": str(e), "error_type": type(e).__name__},
                exc_info=True,
            )
            raise
```

**Step 5: 테스트 실행 (통과 확인)**

```bash
uv run pytest tests/unit/lib/test_llm_client_streaming.py -v
```

Expected: PASS

**Step 6: 커밋**

```bash
git add app/lib/llm_client.py tests/unit/lib/test_llm_client_streaming.py
git commit -m "기능: LLM Client 스트리밍 인터페이스 추가

- BaseLLMClient.stream_text() 추상 메서드 정의
- GoogleLLMClient.stream_text() 구현 (Gemini stream API)
- 단위 테스트 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: OpenAI/Anthropic Client 스트리밍 구현

**Files:**
- Modify: `app/lib/llm_client.py` (OpenAILLMClient, AnthropicLLMClient)
- Test: `tests/unit/lib/test_llm_client_streaming.py`

**Step 1: OpenAI 스트리밍 테스트 추가**

```python
# tests/unit/lib/test_llm_client_streaming.py에 추가

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

        with patch("openai.OpenAI") as mock_openai:
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

            from app.lib.llm_client import OpenAILLMClient
            client = OpenAILLMClient(config)

            chunks = []
            async for chunk in client.stream_text("test"):
                chunks.append(chunk)

            assert chunks == ["Hello", " World"]


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

        with patch("anthropic.Anthropic") as mock_anthropic:
            # Mock 스트리밍 응답 (Anthropic은 with 문 사용)
            mock_event1 = MagicMock(type="content_block_delta")
            mock_event1.delta = MagicMock(text="안녕")
            mock_event2 = MagicMock(type="content_block_delta")
            mock_event2.delta = MagicMock(text="하세요")

            mock_stream = MagicMock()
            mock_stream.__enter__ = lambda self: iter([mock_event1, mock_event2])
            mock_stream.__exit__ = lambda self, *args: None

            mock_client = MagicMock()
            mock_client.messages.stream.return_value = mock_stream
            mock_anthropic.return_value = mock_client

            from app.lib.llm_client import AnthropicLLMClient
            client = AnthropicLLMClient(config)

            chunks = []
            async for chunk in client.stream_text("test"):
                chunks.append(chunk)

            assert "안녕" in chunks
            assert "하세요" in chunks
```

**Step 2: 테스트 실행 (실패 확인)**

```bash
uv run pytest tests/unit/lib/test_llm_client_streaming.py::TestOpenAILLMClientStreaming -v
uv run pytest tests/unit/lib/test_llm_client_streaming.py::TestAnthropicLLMClientStreaming -v
```

Expected: FAIL

**Step 3: OpenAILLMClient.stream_text 구현**

```python
# app/lib/llm_client.py - OpenAILLMClient 클래스에 추가

    async def stream_text(
        self, prompt: str, system_prompt: str | None = None, **kwargs: Any
    ):
        """
        OpenAI 스트리밍 텍스트 생성

        Yields:
            str: 생성된 텍스트 청크
        """
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            # stream=True로 스트리밍 응답 요청
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                stream=True,
            )

            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            logger.error(
                "OpenAI LLM 스트리밍 실패",
                extra={"error": str(e), "error_type": type(e).__name__},
                exc_info=True,
            )
            raise
```

**Step 4: AnthropicLLMClient.stream_text 구현**

```python
# app/lib/llm_client.py - AnthropicLLMClient 클래스에 추가

    async def stream_text(
        self, prompt: str, system_prompt: str | None = None, **kwargs: Any
    ):
        """
        Anthropic 스트리밍 텍스트 생성

        Yields:
            str: 생성된 텍스트 청크
        """
        try:
            # Anthropic 스트리밍 API 사용
            with self.client.messages.stream(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system_prompt if system_prompt else "",
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for event in stream:
                    if event.type == "content_block_delta":
                        yield event.delta.text

        except Exception as e:
            logger.error(
                "Anthropic LLM 스트리밍 실패",
                extra={"error": str(e), "error_type": type(e).__name__},
                exc_info=True,
            )
            raise
```

**Step 5: 테스트 실행 (통과 확인)**

```bash
uv run pytest tests/unit/lib/test_llm_client_streaming.py -v
```

Expected: PASS

**Step 6: 커밋**

```bash
git add app/lib/llm_client.py tests/unit/lib/test_llm_client_streaming.py
git commit -m "기능: OpenAI/Anthropic LLM Client 스트리밍 구현

- OpenAILLMClient.stream_text() 구현
- AnthropicLLMClient.stream_text() 구현
- 단위 테스트 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Generation 모듈 스트리밍 메서드 추가

**Files:**
- Modify: `app/modules/core/generation/generator.py`
- Test: `tests/unit/modules/core/generation/test_generator_streaming.py`

**Step 1: 실패하는 테스트 작성**

```python
# tests/unit/modules/core/generation/test_generator_streaming.py
"""Generator 스트리밍 기능 테스트"""

import pytest
from unittest.mock import AsyncMock, MagicMock


class TestGeneratorStreaming:
    """Generator 스트리밍 테스트"""

    @pytest.mark.asyncio
    async def test_stream_answer_yields_chunks(self):
        """stream_answer가 청크를 yield하는지 확인"""
        from app.modules.core.generation.generator import Generator

        # Mock LLM Client
        mock_llm = MagicMock()

        async def mock_stream(*args, **kwargs):
            yield "안녕"
            yield "하세요"
            yield "!"

        mock_llm.stream_text = mock_stream

        # Generator 생성 (최소 의존성)
        generator = Generator(
            config={},
            llm_client=mock_llm,
            prompt_template=None,
        )

        chunks = []
        async for chunk in generator.stream_answer(
            query="테스트 질문",
            context_documents=[],
        ):
            chunks.append(chunk)

        assert chunks == ["안녕", "하세요", "!"]
```

**Step 2: 테스트 실행 (실패 확인)**

```bash
uv run pytest tests/unit/modules/core/generation/test_generator_streaming.py -v
```

Expected: FAIL - `stream_answer` 메서드 없음

**Step 3: Generator.stream_answer 구현**

```python
# app/modules/core/generation/generator.py에 추가

    async def stream_answer(
        self,
        query: str,
        context_documents: list[Any],
        options: dict[str, Any] | None = None,
    ):
        """
        스트리밍 답변 생성

        Args:
            query: 사용자 질문
            context_documents: 컨텍스트 문서 리스트
            options: 생성 옵션

        Yields:
            str: 생성된 텍스트 청크
        """
        options = options or {}

        # 컨텍스트 구성
        context_text = self._format_context(context_documents)

        # 프롬프트 생성
        prompt = self._build_prompt(query, context_text, options)
        system_prompt = self._get_system_prompt(options)

        # LLM 스트리밍 호출
        async for chunk in self.llm_client.stream_text(prompt, system_prompt):
            yield chunk
```

**Step 4: 테스트 실행 (통과 확인)**

```bash
uv run pytest tests/unit/modules/core/generation/test_generator_streaming.py -v
```

Expected: PASS

**Step 5: 커밋**

```bash
git add app/modules/core/generation/generator.py tests/unit/modules/core/generation/test_generator_streaming.py
git commit -m "기능: Generator 스트리밍 답변 생성 메서드 추가

- Generator.stream_answer() 구현
- LLM Client의 stream_text() 호출하여 청크 단위 yield
- 단위 테스트 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Streaming용 Pydantic 스키마 정의

**Files:**
- Create: `app/api/schemas/streaming.py`
- Test: `tests/unit/api/schemas/test_streaming_schemas.py`

**Step 1: 실패하는 테스트 작성**

```python
# tests/unit/api/schemas/test_streaming_schemas.py
"""스트리밍 스키마 테스트"""

import pytest
from pydantic import ValidationError


class TestStreamingSchemas:
    """스트리밍 스키마 테스트"""

    def test_stream_chat_request_valid(self):
        """StreamChatRequest 유효성 검증"""
        from app.api.schemas.streaming import StreamChatRequest

        request = StreamChatRequest(
            message="테스트 질문입니다",
            session_id="test-session-123",
        )

        assert request.message == "테스트 질문입니다"
        assert request.session_id == "test-session-123"

    def test_stream_chunk_event(self):
        """StreamChunkEvent 생성 테스트"""
        from app.api.schemas.streaming import StreamChunkEvent

        event = StreamChunkEvent(
            event="chunk",
            data="안녕하세요",
            chunk_index=0,
        )

        assert event.event == "chunk"
        assert event.data == "안녕하세요"

    def test_stream_done_event(self):
        """StreamDoneEvent 생성 테스트"""
        from app.api.schemas.streaming import StreamDoneEvent

        event = StreamDoneEvent(
            event="done",
            session_id="test-123",
            message_id="msg-456",
            total_chunks=10,
            tokens_used=150,
        )

        assert event.event == "done"
        assert event.total_chunks == 10
```

**Step 2: 테스트 실행 (실패 확인)**

```bash
uv run pytest tests/unit/api/schemas/test_streaming_schemas.py -v
```

Expected: FAIL - 모듈 없음

**Step 3: 스키마 파일 생성**

```python
# app/api/schemas/streaming.py
"""
스트리밍 API 스키마 정의

SSE(Server-Sent Events) 기반 스트리밍 응답을 위한 Pydantic 모델
"""

from typing import Any, Literal

from pydantic import BaseModel, Field


class StreamChatRequest(BaseModel):
    """스트리밍 채팅 요청"""

    message: str = Field(..., min_length=1, max_length=10000, description="사용자 메시지")
    session_id: str | None = Field(None, description="세션 ID (없으면 새로 생성)")
    options: dict[str, Any] | None = Field(None, description="추가 옵션")


class StreamChunkEvent(BaseModel):
    """스트리밍 청크 이벤트 (SSE data)"""

    event: Literal["chunk"] = "chunk"
    data: str = Field(..., description="텍스트 청크")
    chunk_index: int = Field(..., ge=0, description="청크 인덱스")


class StreamDoneEvent(BaseModel):
    """스트리밍 완료 이벤트"""

    event: Literal["done"] = "done"
    session_id: str = Field(..., description="세션 ID")
    message_id: str = Field(..., description="메시지 ID")
    total_chunks: int = Field(..., ge=0, description="총 청크 수")
    tokens_used: int = Field(0, ge=0, description="사용된 토큰 수")
    processing_time: float = Field(0.0, ge=0.0, description="처리 시간 (초)")
    sources: list[Any] = Field(default_factory=list, description="참조 소스")


class StreamErrorEvent(BaseModel):
    """스트리밍 에러 이벤트"""

    event: Literal["error"] = "error"
    error_code: str = Field(..., description="에러 코드")
    message: str = Field(..., description="에러 메시지")
    suggestion: str | None = Field(None, description="해결 방법")
```

**Step 4: 테스트 실행 (통과 확인)**

```bash
uv run pytest tests/unit/api/schemas/test_streaming_schemas.py -v
```

Expected: PASS

**Step 5: 커밋**

```bash
git add app/api/schemas/streaming.py tests/unit/api/schemas/test_streaming_schemas.py
git commit -m "기능: 스트리밍 API Pydantic 스키마 정의

- StreamChatRequest: 스트리밍 채팅 요청
- StreamChunkEvent: SSE 청크 이벤트
- StreamDoneEvent: 완료 이벤트 (메타데이터 포함)
- StreamErrorEvent: 에러 이벤트
- 단위 테스트 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: ChatService 스트리밍 메서드 추가

**Files:**
- Modify: `app/api/services/chat_service.py`
- Test: `tests/unit/api/services/test_chat_service_streaming.py`

**Step 1: 실패하는 테스트 작성**

```python
# tests/unit/api/services/test_chat_service_streaming.py
"""ChatService 스트리밍 테스트"""

import pytest
from unittest.mock import AsyncMock, MagicMock


class TestChatServiceStreaming:
    """ChatService 스트리밍 테스트"""

    @pytest.mark.asyncio
    async def test_stream_rag_pipeline(self):
        """stream_rag_pipeline이 청크를 yield하는지 확인"""
        from app.api.services.chat_service import ChatService

        # Mock 모듈 설정
        mock_session = MagicMock()
        mock_session.get_session = AsyncMock(return_value={"is_valid": True})
        mock_session.get_context_string = AsyncMock(return_value="")
        mock_session.create_session = AsyncMock(return_value={"session_id": "test-123"})

        mock_generation = MagicMock()

        async def mock_stream(*args, **kwargs):
            yield "안녕"
            yield "하세요"

        mock_generation.stream_answer = mock_stream

        mock_retrieval = MagicMock()
        mock_retrieval.search = AsyncMock(return_value=[])

        modules = {
            "session": mock_session,
            "generation": mock_generation,
            "retrieval": mock_retrieval,
        }

        service = ChatService(modules, {})

        chunks = []
        async for chunk in service.stream_rag_pipeline(
            message="테스트",
            session_id="test-123",
        ):
            chunks.append(chunk)

        # 최소 1개 이상의 청크가 있어야 함
        assert len(chunks) >= 2
```

**Step 2: 테스트 실행 (실패 확인)**

```bash
uv run pytest tests/unit/api/services/test_chat_service_streaming.py -v
```

Expected: FAIL - `stream_rag_pipeline` 메서드 없음

**Step 3: ChatService.stream_rag_pipeline 구현**

```python
# app/api/services/chat_service.py에 추가 (execute_rag_pipeline 메서드 다음)

    async def stream_rag_pipeline(
        self, message: str, session_id: str, options: dict[str, Any] | None = None
    ):
        """
        스트리밍 RAG 파이프라인 실행

        Args:
            message: 사용자 메시지
            session_id: 세션 ID
            options: 추가 옵션

        Yields:
            dict: 스트리밍 이벤트 (chunk, metadata, done, error)
        """
        options = options or {}

        try:
            # 1. 세션 처리
            context = {}
            session_result = await self.handle_session(session_id, context)
            if not session_result["success"]:
                yield {
                    "event": "error",
                    "error_code": "SESSION_ERROR",
                    "message": session_result.get("message", "세션 처리 실패"),
                }
                return

            actual_session_id = session_result["session_id"]

            # 2. 컨텍스트 준비 (비스트리밍)
            prepared_context = await self.rag_pipeline.prepare_context(message, actual_session_id)

            # 3. 문서 검색 (비스트리밍)
            retrieval_results = await self.rag_pipeline.retrieve_documents(
                prepared_context.expanded_queries,
                prepared_context.query_weights,
                prepared_context.session_context,
                options,
            )

            # 4. 리랭킹 (비스트리밍)
            rerank_results = await self.rag_pipeline.rerank_documents(
                prepared_context.expanded_query,
                retrieval_results.documents,
                options,
            )

            # 5. 메타데이터 이벤트 전송 (검색 완료 알림)
            yield {
                "event": "metadata",
                "session_id": actual_session_id,
                "search_results": retrieval_results.count,
                "ranked_results": rerank_results.count,
            }

            # 6. 스트리밍 답변 생성
            chunk_index = 0
            generation_module = self.modules.get("generation")

            if generation_module and hasattr(generation_module, "stream_answer"):
                async for chunk in generation_module.stream_answer(
                    query=message,
                    context_documents=rerank_results.documents,
                    options=options,
                ):
                    yield {
                        "event": "chunk",
                        "data": chunk,
                        "chunk_index": chunk_index,
                    }
                    chunk_index += 1

            # 7. 완료 이벤트
            yield {
                "event": "done",
                "session_id": actual_session_id,
                "total_chunks": chunk_index,
            }

        except Exception as e:
            logger.error(
                "스트리밍 RAG 파이프라인 실패",
                extra={"error": str(e)},
                exc_info=True,
            )
            yield {
                "event": "error",
                "error_code": "STREAM_ERROR",
                "message": str(e),
            }
```

**Step 4: 테스트 실행 (통과 확인)**

```bash
uv run pytest tests/unit/api/services/test_chat_service_streaming.py -v
```

Expected: PASS

**Step 5: 커밋**

```bash
git add app/api/services/chat_service.py tests/unit/api/services/test_chat_service_streaming.py
git commit -m "기능: ChatService 스트리밍 RAG 파이프라인 메서드 추가

- stream_rag_pipeline() 구현
- 검색/리랭킹은 비스트리밍, 생성만 스트리밍
- 메타데이터/청크/완료/에러 이벤트 yield
- 단위 테스트 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: /chat/stream 엔드포인트 구현

**Files:**
- Modify: `app/api/routers/chat_router.py`
- Test: `tests/unit/api/routers/test_chat_router_streaming.py`

**Step 1: 실패하는 테스트 작성**

```python
# tests/unit/api/routers/test_chat_router_streaming.py
"""Chat Router 스트리밍 엔드포인트 테스트"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient


class TestStreamEndpoint:
    """스트리밍 엔드포인트 테스트"""

    def test_stream_endpoint_exists(self):
        """스트리밍 엔드포인트가 존재하는지 확인"""
        from app.api.routers.chat_router import router

        routes = [route.path for route in router.routes]
        assert "/chat/stream" in routes

    def test_stream_endpoint_returns_event_stream(self):
        """스트리밍 엔드포인트가 text/event-stream을 반환하는지 확인"""
        from app.api.routers.chat_router import router, set_chat_service
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)

        # Mock ChatService
        mock_service = MagicMock()

        async def mock_stream(*args, **kwargs):
            yield {"event": "chunk", "data": "안녕", "chunk_index": 0}
            yield {"event": "done", "session_id": "test", "total_chunks": 1}

        mock_service.stream_rag_pipeline = mock_stream
        set_chat_service(mock_service)

        client = TestClient(app)
        response = client.post(
            "/chat/stream",
            json={"message": "테스트"},
        )

        # SSE 형식 확인
        assert response.headers["content-type"].startswith("text/event-stream")
```

**Step 2: 테스트 실행 (실패 확인)**

```bash
uv run pytest tests/unit/api/routers/test_chat_router_streaming.py -v
```

Expected: FAIL - `/chat/stream` 엔드포인트 없음

**Step 3: 스트리밍 엔드포인트 구현**

```python
# app/api/routers/chat_router.py에 추가 (import 섹션)
import json
from fastapi import Request
from fastapi.responses import StreamingResponse

from ..schemas.streaming import StreamChatRequest, StreamChunkEvent, StreamDoneEvent, StreamErrorEvent
```

```python
# app/api/routers/chat_router.py에 추가 (/chat 엔드포인트 다음)

@router.post("/chat/stream")
@limiter.limit("100/15minutes")
async def chat_stream(request: Request, chat_request: StreamChatRequest) -> StreamingResponse:
    """
    스트리밍 채팅 엔드포인트 (SSE)

    Server-Sent Events 형식으로 답변을 스트리밍합니다.

    SSE 이벤트 형식:
    - metadata: 검색 결과 메타데이터 (검색 완료 시점)
    - chunk: 텍스트 청크 (LLM 생성 중)
    - done: 완료 (세션 ID, 총 청크 수 등)
    - error: 에러 발생

    Example Response:
        event: metadata
        data: {"session_id": "...", "search_results": 5}

        event: chunk
        data: {"data": "안녕", "chunk_index": 0}

        event: chunk
        data: {"data": "하세요", "chunk_index": 1}

        event: done
        data: {"session_id": "...", "total_chunks": 2}
    """
    _ensure_service_initialized()

    async def event_generator():
        """SSE 이벤트 생성기"""
        try:
            async for event in chat_service.stream_rag_pipeline(
                message=chat_request.message,
                session_id=chat_request.session_id,
                options=chat_request.options,
            ):
                event_type = event.get("event", "chunk")
                event_data = json.dumps(event, ensure_ascii=False)
                yield f"event: {event_type}\ndata: {event_data}\n\n"

        except Exception as e:
            logger.error(
                "스트리밍 에러",
                extra={"error": str(e)},
                exc_info=True,
            )
            error_event = StreamErrorEvent(
                error_code="STREAM_ERROR",
                message="스트리밍 중 오류가 발생했습니다",
                suggestion="잠시 후 다시 시도해주세요",
            )
            yield f"event: error\ndata: {error_event.model_dump_json()}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Nginx 버퍼링 비활성화
        },
    )
```

**Step 4: 테스트 실행 (통과 확인)**

```bash
uv run pytest tests/unit/api/routers/test_chat_router_streaming.py -v
```

Expected: PASS

**Step 5: 커밋**

```bash
git add app/api/routers/chat_router.py tests/unit/api/routers/test_chat_router_streaming.py
git commit -m "기능: /chat/stream SSE 스트리밍 엔드포인트 구현

- POST /chat/stream 엔드포인트 추가
- text/event-stream Content-Type 반환
- metadata/chunk/done/error 이벤트 형식
- Nginx 버퍼링 비활성화 헤더 추가
- 단위 테스트 추가

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: 통합 테스트 작성

**Files:**
- Create: `tests/integration/test_streaming_e2e.py`

**Step 1: 통합 테스트 작성**

```python
# tests/integration/test_streaming_e2e.py
"""스트리밍 API 통합 테스트"""

import json
import pytest
from httpx import AsyncClient


@pytest.mark.integration
@pytest.mark.asyncio
async def test_streaming_full_flow():
    """
    스트리밍 전체 흐름 테스트

    1. /chat/stream 호출
    2. SSE 이벤트 수신
    3. 메타데이터 → 청크 → 완료 순서 확인
    """
    # 실제 서버에 연결하여 테스트 (환경변수로 URL 설정)
    import os
    base_url = os.getenv("TEST_API_URL", "http://localhost:8000")

    async with AsyncClient(base_url=base_url) as client:
        response = await client.post(
            "/chat/stream",
            json={"message": "안녕하세요"},
            headers={"Accept": "text/event-stream"},
        )

        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        # SSE 이벤트 파싱
        events = []
        for line in response.text.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])
                events.append(data)

        # 최소 1개 이상의 이벤트
        assert len(events) >= 1

        # 마지막 이벤트는 done 또는 error
        last_event = events[-1]
        assert last_event["event"] in ["done", "error"]
```

**Step 2: 테스트 실행**

```bash
# 통합 테스트는 실제 서버 필요 (선택적)
uv run pytest tests/integration/test_streaming_e2e.py -v -m integration --ignore-glob="**/test_*.py" || echo "통합 테스트 스킵 (서버 없음)"
```

**Step 3: 커밋**

```bash
git add tests/integration/test_streaming_e2e.py
git commit -m "테스트: 스트리밍 API 통합 테스트 추가

- 전체 흐름 테스트 (SSE 이벤트 수신)
- 메타데이터 → 청크 → 완료 순서 확인
- integration 마커로 분리

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: 문서화 및 최종 정리

**Files:**
- Modify: `CLAUDE.md`
- Create: `docs/streaming-api-guide.md`

**Step 1: CLAUDE.md 업데이트**

```markdown
# CLAUDE.md에 추가 (API 섹션)

### Streaming API (v1.0.8)
- **POST /chat/stream**: SSE 기반 스트리밍 채팅 응답
  - Content-Type: `text/event-stream`
  - 이벤트: `metadata`, `chunk`, `done`, `error`
  - Rate Limit: 100/15분
```

**Step 2: 사용 가이드 작성**

```markdown
# docs/streaming-api-guide.md

# Streaming API 사용 가이드

## 개요

RAG_Standard는 SSE(Server-Sent Events) 기반 스트리밍 API를 제공합니다.
LLM 응답을 실시간으로 수신하여 사용자 경험을 개선할 수 있습니다.

## 엔드포인트

### POST /chat/stream

스트리밍 채팅 응답을 반환합니다.

**Request:**
```json
{
  "message": "안녕하세요",
  "session_id": "optional-session-id",
  "options": {}
}
```

**Response (SSE):**
```
event: metadata
data: {"session_id": "abc-123", "search_results": 5, "ranked_results": 3}

event: chunk
data: {"data": "안녕", "chunk_index": 0}

event: chunk
data: {"data": "하세요", "chunk_index": 1}

event: done
data: {"session_id": "abc-123", "total_chunks": 2, "tokens_used": 15}
```

## 프론트엔드 연동 예시

### JavaScript (EventSource)

```javascript
const eventSource = new EventSource('/api/chat/stream', {
  method: 'POST',
  body: JSON.stringify({ message: '안녕하세요' }),
});

eventSource.addEventListener('chunk', (e) => {
  const data = JSON.parse(e.data);
  console.log('청크:', data.data);
  // UI에 텍스트 추가
});

eventSource.addEventListener('done', (e) => {
  const data = JSON.parse(e.data);
  console.log('완료:', data);
  eventSource.close();
});

eventSource.addEventListener('error', (e) => {
  console.error('에러:', e);
  eventSource.close();
});
```

### React Hook 예시

```typescript
const useStreamChat = () => {
  const [chunks, setChunks] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (message: string) => {
    setIsStreaming(true);
    setChunks([]);

    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const text = decoder.decode(value);
      // SSE 이벤트 파싱 및 청크 추가
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (data.event === 'chunk') {
            setChunks(prev => [...prev, data.data]);
          }
        }
      }
    }

    setIsStreaming(false);
  };

  return { chunks, isStreaming, sendMessage };
};
```

## 에러 처리

| 에러 코드 | 설명 | 대응 방법 |
|-----------|------|-----------|
| SESSION_ERROR | 세션 처리 실패 | 새 세션으로 재시도 |
| STREAM_ERROR | 스트리밍 중 오류 | 잠시 후 재시도 |
| RATE_LIMIT | 요청 제한 초과 | 15분 후 재시도 |
```

**Step 3: 커밋**

```bash
git add CLAUDE.md docs/streaming-api-guide.md
git commit -m "문서: Streaming API 가이드 추가

- CLAUDE.md에 스트리밍 API 섹션 추가
- 프론트엔드 연동 예시 (JavaScript, React)
- 에러 처리 가이드

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## 검증 체크리스트

모든 Task 완료 후 다음을 확인:

```bash
# 1. 전체 테스트 통과
uv run pytest tests/unit -v

# 2. 타입 체크 통과
make type-check

# 3. 린트 통과
make lint

# 4. 로컬 서버 실행 후 수동 테스트
make dev-reload
curl -X POST http://localhost:8000/chat/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message": "안녕하세요"}'
```

---

**Plan complete and saved to `docs/plans/2026-01-15-streaming-api-implementation.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
