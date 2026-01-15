"""
ChatService 스트리밍 테스트

ChatService.stream_rag_pipeline() 메서드 구현을 위한 TDD 테스트.
비동기 제너레이터로 스트리밍 이벤트를 yield하는 메서드 테스트.

이벤트 타입:
- metadata: 검색 결과 메타데이터 (문서 수, 소스 등)
- chunk: LLM 응답 텍스트 청크
- done: 스트리밍 완료 이벤트
- error: 에러 이벤트
"""

from unittest.mock import AsyncMock, MagicMock

import pytest


class TestChatServiceStreaming:
    """ChatService 스트리밍 테스트"""

    @pytest.mark.asyncio
    async def test_stream_rag_pipeline_yields_chunks(self):
        """stream_rag_pipeline이 청크를 yield하는지 확인"""
        from app.api.services.chat_service import ChatService

        # Mock 세션 모듈 설정
        mock_session = MagicMock()
        mock_session.get_session = AsyncMock(return_value={"is_valid": True})
        mock_session.get_context_string = AsyncMock(return_value="")
        mock_session.create_session = AsyncMock(return_value={"session_id": "test-123"})

        # Mock 생성 모듈 설정 - 스트리밍 제너레이터 반환
        mock_generation = MagicMock()

        async def mock_stream(*args, **kwargs):
            """스트리밍 응답 시뮬레이터"""
            yield "안녕"
            yield "하세요"

        mock_generation.stream_answer = mock_stream

        # Mock 검색 모듈 설정
        mock_retrieval = MagicMock()
        mock_retrieval.search = AsyncMock(return_value=[])

        modules = {
            "session": mock_session,
            "generation": mock_generation,
            "retrieval": mock_retrieval,
        }

        service = ChatService(modules, {})

        # 스트리밍 호출
        chunks = []
        async for event in service.stream_rag_pipeline(
            message="테스트",
            session_id="test-123",
        ):
            chunks.append(event)

        # 최소 1개 이상의 청크가 있어야 함
        assert len(chunks) >= 2

    @pytest.mark.asyncio
    async def test_stream_rag_pipeline_event_types(self):
        """스트리밍 이벤트 타입 확인 (metadata, chunk, done)"""
        from app.api.services.chat_service import ChatService

        # Mock 세션 모듈
        mock_session = MagicMock()
        mock_session.get_session = AsyncMock(return_value={"is_valid": True})
        mock_session.get_context_string = AsyncMock(return_value="")
        mock_session.create_session = AsyncMock(return_value={"session_id": "test-123"})

        # Mock 생성 모듈 - 스트리밍
        mock_generation = MagicMock()

        async def mock_stream(*args, **kwargs):
            yield "테스트 응답입니다."

        mock_generation.stream_answer = mock_stream

        # Mock 검색 모듈 - 문서 반환
        mock_retrieval = MagicMock()
        mock_doc = MagicMock()
        mock_doc.metadata = {"source": "test.pdf", "score": 0.9}
        mock_doc.content = "테스트 컨텐츠"
        mock_doc.page_content = "테스트 컨텐츠"
        mock_retrieval.search = AsyncMock(return_value=[mock_doc])

        modules = {
            "session": mock_session,
            "generation": mock_generation,
            "retrieval": mock_retrieval,
        }

        service = ChatService(modules, {})

        # 스트리밍 호출
        events = []
        async for event in service.stream_rag_pipeline(
            message="테스트 질문",
            session_id="test-123",
        ):
            events.append(event)

        # 이벤트 타입 확인
        event_types = [e.get("event") for e in events if isinstance(e, dict)]

        # metadata 이벤트가 있어야 함
        assert "metadata" in event_types, f"metadata 이벤트가 없습니다. 실제 이벤트: {event_types}"

        # chunk 이벤트가 있어야 함
        assert "chunk" in event_types, f"chunk 이벤트가 없습니다. 실제 이벤트: {event_types}"

        # done 이벤트가 있어야 함
        assert "done" in event_types, f"done 이벤트가 없습니다. 실제 이벤트: {event_types}"

    @pytest.mark.asyncio
    async def test_stream_rag_pipeline_metadata_event_content(self):
        """metadata 이벤트에 검색 결과 정보가 포함되는지 확인"""
        from app.api.services.chat_service import ChatService

        # Mock 세션 모듈
        mock_session = MagicMock()
        mock_session.get_session = AsyncMock(return_value={"is_valid": True})
        mock_session.get_context_string = AsyncMock(return_value="")
        mock_session.create_session = AsyncMock(return_value={"session_id": "test-123"})

        # Mock 생성 모듈
        mock_generation = MagicMock()

        async def mock_stream(*args, **kwargs):
            yield "응답"

        mock_generation.stream_answer = mock_stream

        # Mock 검색 모듈 - 2개 문서
        mock_retrieval = MagicMock()
        mock_docs = []
        for i in range(2):
            doc = MagicMock()
            doc.metadata = {"source": f"doc{i}.pdf", "score": 0.9 - i * 0.1}
            doc.content = f"문서 {i} 내용"
            doc.page_content = f"문서 {i} 내용"
            mock_docs.append(doc)

        mock_retrieval.search = AsyncMock(return_value=mock_docs)

        modules = {
            "session": mock_session,
            "generation": mock_generation,
            "retrieval": mock_retrieval,
        }

        service = ChatService(modules, {})

        # 스트리밍 호출
        metadata_event = None
        async for event in service.stream_rag_pipeline(
            message="테스트",
            session_id="test-123",
        ):
            if isinstance(event, dict) and event.get("event") == "metadata":
                metadata_event = event
                break

        # metadata 이벤트 검증
        assert metadata_event is not None, "metadata 이벤트가 없습니다"
        assert "data" in metadata_event, "metadata 이벤트에 data가 없습니다"

        data = metadata_event["data"]
        assert "session_id" in data, "session_id가 없습니다"
        assert "search_results" in data, "search_results가 없습니다"
        assert data["search_results"] == 2, f"검색 결과 수가 2가 아닙니다: {data['search_results']}"

    @pytest.mark.asyncio
    async def test_stream_rag_pipeline_chunk_event_content(self):
        """chunk 이벤트에 텍스트와 인덱스가 포함되는지 확인"""
        from app.api.services.chat_service import ChatService

        # Mock 세션 모듈
        mock_session = MagicMock()
        mock_session.get_session = AsyncMock(return_value={"is_valid": True})
        mock_session.get_context_string = AsyncMock(return_value="")
        mock_session.create_session = AsyncMock(return_value={"session_id": "test-123"})

        # Mock 생성 모듈 - 여러 청크
        mock_generation = MagicMock()

        async def mock_stream(*args, **kwargs):
            yield "첫번째"
            yield "두번째"
            yield "세번째"

        mock_generation.stream_answer = mock_stream

        # Mock 검색 모듈
        mock_retrieval = MagicMock()
        mock_doc = MagicMock()
        mock_doc.metadata = {"source": "test.pdf"}
        mock_doc.content = "테스트"
        mock_doc.page_content = "테스트"
        mock_retrieval.search = AsyncMock(return_value=[mock_doc])

        modules = {
            "session": mock_session,
            "generation": mock_generation,
            "retrieval": mock_retrieval,
        }

        service = ChatService(modules, {})

        # 스트리밍 호출
        chunk_events = []
        async for event in service.stream_rag_pipeline(
            message="테스트",
            session_id="test-123",
        ):
            if isinstance(event, dict) and event.get("event") == "chunk":
                chunk_events.append(event)

        # 청크 이벤트 검증
        assert len(chunk_events) == 3, f"청크 수가 3이 아닙니다: {len(chunk_events)}"

        # 각 청크에 필수 필드 확인
        for i, chunk in enumerate(chunk_events):
            assert "data" in chunk, f"청크 {i}에 data가 없습니다"
            assert "chunk_index" in chunk, f"청크 {i}에 chunk_index가 없습니다"
            assert chunk["chunk_index"] == i, f"청크 인덱스가 잘못됨: {chunk['chunk_index']} != {i}"

    @pytest.mark.asyncio
    async def test_stream_rag_pipeline_done_event_content(self):
        """done 이벤트에 완료 정보가 포함되는지 확인"""
        from app.api.services.chat_service import ChatService

        # Mock 세션 모듈
        mock_session = MagicMock()
        mock_session.get_session = AsyncMock(return_value={"is_valid": True})
        mock_session.get_context_string = AsyncMock(return_value="")
        mock_session.create_session = AsyncMock(return_value={"session_id": "test-123"})

        # Mock 생성 모듈
        mock_generation = MagicMock()

        async def mock_stream(*args, **kwargs):
            yield "청크1"
            yield "청크2"

        mock_generation.stream_answer = mock_stream

        # Mock 검색 모듈
        mock_retrieval = MagicMock()
        mock_retrieval.search = AsyncMock(return_value=[])

        modules = {
            "session": mock_session,
            "generation": mock_generation,
            "retrieval": mock_retrieval,
        }

        service = ChatService(modules, {})

        # 스트리밍 호출
        done_event = None
        async for event in service.stream_rag_pipeline(
            message="테스트",
            session_id="test-123",
        ):
            if isinstance(event, dict) and event.get("event") == "done":
                done_event = event
                break

        # done 이벤트 검증
        assert done_event is not None, "done 이벤트가 없습니다"
        assert "data" in done_event, "done 이벤트에 data가 없습니다"

        data = done_event["data"]
        assert "session_id" in data, "session_id가 없습니다"
        assert "total_chunks" in data, "total_chunks가 없습니다"
        assert data["total_chunks"] == 2, f"청크 수가 2가 아닙니다: {data['total_chunks']}"

    @pytest.mark.asyncio
    async def test_stream_rag_pipeline_error_handling(self):
        """에러 발생 시 error 이벤트가 yield되는지 확인"""
        from app.api.services.chat_service import ChatService

        # Mock 세션 모듈 - 에러 발생
        mock_session = MagicMock()
        mock_session.get_session = AsyncMock(side_effect=Exception("세션 에러"))
        mock_session.create_session = AsyncMock(return_value={"session_id": "test-123"})

        modules = {
            "session": mock_session,
            "generation": MagicMock(),
            "retrieval": MagicMock(),
        }

        service = ChatService(modules, {})

        # 스트리밍 호출 - 에러 이벤트 확인
        error_event = None
        async for event in service.stream_rag_pipeline(
            message="테스트",
            session_id="test-123",
        ):
            if isinstance(event, dict) and event.get("event") == "error":
                error_event = event
                break

        # error 이벤트 검증
        assert error_event is not None, "error 이벤트가 없습니다"
        assert "error_code" in error_event, "error_code가 없습니다"
        assert "message" in error_event, "message가 없습니다"

    @pytest.mark.asyncio
    async def test_stream_rag_pipeline_creates_session_if_needed(self):
        """세션이 없으면 새로 생성하는지 확인"""
        from app.api.services.chat_service import ChatService

        # Mock 세션 모듈 - 세션 없음 → 새로 생성
        mock_session = MagicMock()
        mock_session.get_session = AsyncMock(return_value={"is_valid": False})
        mock_session.create_session = AsyncMock(return_value={"session_id": "new-session-456"})
        mock_session.get_context_string = AsyncMock(return_value="")

        # Mock 생성 모듈
        mock_generation = MagicMock()

        async def mock_stream(*args, **kwargs):
            yield "응답"

        mock_generation.stream_answer = mock_stream

        # Mock 검색 모듈
        mock_retrieval = MagicMock()
        mock_retrieval.search = AsyncMock(return_value=[])

        modules = {
            "session": mock_session,
            "generation": mock_generation,
            "retrieval": mock_retrieval,
        }

        service = ChatService(modules, {})

        # 스트리밍 호출
        metadata_event = None
        async for event in service.stream_rag_pipeline(
            message="테스트",
            session_id=None,  # 세션 ID 없음
        ):
            if isinstance(event, dict) and event.get("event") == "metadata":
                metadata_event = event
                break

        # 새 세션 생성 확인
        mock_session.create_session.assert_called_once()

        # metadata에 새 세션 ID가 포함되어야 함
        assert metadata_event is not None
        assert metadata_event["data"]["session_id"] == "new-session-456"

    @pytest.mark.asyncio
    async def test_stream_rag_pipeline_with_options(self):
        """옵션이 올바르게 전달되는지 확인"""
        from app.api.services.chat_service import ChatService

        # Mock 세션 모듈
        mock_session = MagicMock()
        mock_session.get_session = AsyncMock(return_value={"is_valid": True})
        mock_session.get_context_string = AsyncMock(return_value="")
        mock_session.create_session = AsyncMock(return_value={"session_id": "test-123"})

        # Mock 생성 모듈 - 옵션 확인
        mock_generation = MagicMock()
        received_options = {}

        async def mock_stream(query, context_documents, options=None):
            nonlocal received_options
            received_options = options or {}
            yield "응답"

        mock_generation.stream_answer = mock_stream

        # Mock 검색 모듈
        mock_retrieval = MagicMock()
        mock_doc = MagicMock()
        mock_doc.metadata = {"source": "test.pdf"}
        mock_doc.content = "테스트"
        mock_doc.page_content = "테스트"
        mock_retrieval.search = AsyncMock(return_value=[mock_doc])

        modules = {
            "session": mock_session,
            "generation": mock_generation,
            "retrieval": mock_retrieval,
        }

        service = ChatService(modules, {})

        # 옵션과 함께 스트리밍 호출
        options = {
            "temperature": 0.7,
            "max_tokens": 1000,
            "model": "anthropic/claude-sonnet-4",
        }

        async for _ in service.stream_rag_pipeline(
            message="테스트",
            session_id="test-123",
            options=options,
        ):
            pass

        # 옵션이 전달되었는지 확인
        assert "temperature" in received_options
        assert received_options["temperature"] == 0.7
