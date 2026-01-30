"""
KoreanTokenizer 단위 테스트

Kiwi 기반 한국어 형태소 분석 토크나이저.
kiwipiepy가 설치되지 않은 환경에서도 테스트가 로드되어야 합니다.

테스트 범위:
1. 기본 토큰화
2. 빈 입력 처리
3. 배치 토큰화
4. 기존 전처리 모듈과의 연동
5. Kiwi 미설치 시 Graceful Degradation
"""

import pytest

# kiwipiepy 선택적 의존성 - 미설치 환경에서도 테스트 로드 가능
kiwi_available = pytest.importorskip("kiwipiepy")


class TestKoreanTokenizerBasic:
    """KoreanTokenizer 기본 기능 테스트"""

    def test_tokenize_korean_sentence(self) -> None:
        """
        한국어 문장 토큰화

        Given: 한국어 문장 "삼성전자의 주가가 올랐습니다"
        When: tokenize() 호출
        Then: 의미 있는 형태소 토큰 리스트 반환 (조사/어미 제거)
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        tokens = tokenizer.tokenize("삼성전자의 주가가 올랐습니다")

        # 검증: 명사/동사 어간 등 의미 있는 토큰만 추출
        assert "삼성전자" in tokens
        assert "주가" in tokens
        # 조사 "의", "가" 등은 제거되어야 함
        assert "의" not in tokens

    def test_tokenize_english_mixed(self) -> None:
        """
        한영 혼합 문장 토큰화

        Given: "RAG 시스템을 설치합니다"
        When: tokenize() 호출
        Then: 영문 토큰도 포함
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        tokens = tokenizer.tokenize("RAG 시스템을 설치합니다")

        assert "RAG" in tokens or "rag" in tokens.copy() or any("RAG" in t or "rag" in t for t in tokens)
        assert "시스템" in tokens
        assert "설치" in tokens

    def test_tokenize_empty_string(self) -> None:
        """
        빈 문자열 처리

        Given: 빈 문자열
        When: tokenize() 호출
        Then: 빈 리스트 반환, 에러 없음
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        tokens = tokenizer.tokenize("")

        assert tokens == []

    def test_tokenize_returns_list_of_strings(self) -> None:
        """
        반환 타입 확인

        Given: 정상 한국어 문장
        When: tokenize() 호출
        Then: list[str] 타입 반환
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        tokens = tokenizer.tokenize("테스트 문장입니다")

        assert isinstance(tokens, list)
        assert all(isinstance(t, str) for t in tokens)


class TestKoreanTokenizerBatch:
    """KoreanTokenizer 배치 토큰화 테스트"""

    def test_tokenize_batch(self) -> None:
        """
        다수 문서 일괄 토큰화

        Given: 문서 3개
        When: tokenize_batch() 호출
        Then: 각 문서별 토큰 리스트 반환
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        docs = [
            "삼성전자 주가 분석",
            "애플 아이폰 출시",
            "RAG 시스템 설치 가이드",
        ]
        result = tokenizer.tokenize_batch(docs)

        # 검증: 3개 문서 → 3개 토큰 리스트
        assert len(result) == 3
        assert all(isinstance(tokens, list) for tokens in result)
        assert all(len(tokens) > 0 for tokens in result)

    def test_tokenize_batch_empty_list(self) -> None:
        """
        빈 리스트 처리

        Given: 빈 리스트
        When: tokenize_batch() 호출
        Then: 빈 리스트 반환
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        result = tokenizer.tokenize_batch([])

        assert result == []


class TestKoreanTokenizerWithPreprocessors:
    """기존 BM25 전처리 모듈과의 연동 테스트"""

    def test_tokenize_with_stopword_filter(self) -> None:
        """
        불용어 필터와 함께 사용

        Given: StopwordFilter가 주입된 토크나이저
        When: tokenize() 호출
        Then: 불용어가 제거된 토큰 리스트 반환
        """
        from app.modules.core.retrieval.bm25.stopwords import StopwordFilter
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        stopword_filter = StopwordFilter(use_defaults=True, enabled=True)
        tokenizer = KoreanTokenizer(stopword_filter=stopword_filter)

        tokens = tokenizer.tokenize("있는 맛집 같은 것")

        # 검증: 불용어 "있는", "같은", "것" 등이 제거됨
        assert "맛집" in tokens
        # 기본 불용어에 포함된 단어는 제거
        for stopword in ["있는", "같은", "것"]:
            assert stopword not in tokens

    def test_tokenize_without_preprocessors(self) -> None:
        """
        전처리 모듈 없이도 정상 동작

        Given: 전처리 모듈 없는 토크나이저
        When: tokenize() 호출
        Then: 형태소 분석만 수행, 에러 없음
        """
        from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

        tokenizer = KoreanTokenizer()
        tokens = tokenizer.tokenize("테스트 문장입니다")

        assert len(tokens) > 0
