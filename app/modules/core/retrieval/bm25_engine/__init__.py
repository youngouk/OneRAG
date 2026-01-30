"""
BM25 실행 엔진 모듈

벡터 DB가 BM25를 내장하지 않는 경우(ChromaDB, pgvector, MongoDB)에
Python 기반 독립 BM25 검색을 제공합니다.

구성요소:
- KoreanTokenizer: Kiwi 기반 한국어 형태소 토크나이저
- BM25Index: rank-bm25 래핑 인덱스
- HybridMerger: Dense + BM25 결과 RRF 병합

의존성 (선택적):
- kiwipiepy: pip install kiwipiepy
- rank-bm25: pip install rank-bm25
"""

from app.modules.core.retrieval.bm25_engine.hybrid_merger import HybridMerger
from app.modules.core.retrieval.bm25_engine.index import BM25Index
from app.modules.core.retrieval.bm25_engine.tokenizer import KoreanTokenizer

__all__ = [
    "KoreanTokenizer",
    "BM25Index",
    "HybridMerger",
]
