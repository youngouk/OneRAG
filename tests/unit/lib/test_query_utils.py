"""
QueryNormalizer / QueryCache 단위 테스트

대상 모듈: app/lib/query_utils.py
테스트 범위: 쿼리 정규화, 캐시 키 생성, 캐시 CRUD 및 통계
"""


from app.lib.query_utils import QueryCache, QueryNormalizer

# ============================================================
# QueryNormalizer.normalize() 테스트 (7개)
# ============================================================


class TestQueryNormalizerNormalize:
    """QueryNormalizer.normalize() 메서드 테스트"""

    def test_empty_query_returns_empty_string(self) -> None:
        """빈 쿼리를 넣으면 빈 문자열을 반환해야 한다."""
        assert QueryNormalizer.normalize("") == ""

    def test_converts_to_lowercase(self) -> None:
        """영문 대문자를 소문자로 변환해야 한다."""
        result = QueryNormalizer.normalize("HELLO WORLD")
        # 공백도 제거되므로 "helloworld"
        assert result == "helloworld"

    def test_removes_whitespace_including_multiple(self) -> None:
        """단일 공백과 다중 공백 모두 제거해야 한다."""
        result = QueryNormalizer.normalize("hello   world   test")
        assert result == "helloworldtest"

    def test_removes_korean_josa(self) -> None:
        """한국어 조사(을/를/이/가/은/는 등)를 제거해야 한다."""
        # 조사 패턴: 조사 뒤에 공백 또는 문자열 끝이 와야 매칭됨
        # 공백 제거가 조사 제거보다 먼저 수행되므로,
        # 공백이 먼저 제거되면 조사가 단어 끝에 위치하게 됨
        result = QueryNormalizer.normalize("삼성전자는")
        assert "는" not in result

        result2 = QueryNormalizer.normalize("서비스를")
        assert "를" not in result2

    def test_strips_leading_and_trailing_whitespace(self) -> None:
        """앞뒤 공백을 제거해야 한다."""
        result = QueryNormalizer.normalize("  hello  ")
        assert result == "hello"

    def test_idempotent(self) -> None:
        """두 번 적용해도 동일한 결과를 반환해야 한다 (멱등성)."""
        query = "  Hello  WORLD  삼성전자는  "
        first = QueryNormalizer.normalize(query)
        second = QueryNormalizer.normalize(first)
        assert first == second

    def test_mixed_english_korean_query(self) -> None:
        """영문과 한국어가 혼합된 쿼리도 정규화해야 한다."""
        result = QueryNormalizer.normalize("Samsung 전자는 좋은 회사")
        # 소문자 변환 + 공백 제거 + 조사 제거 적용
        assert "samsung" in result
        assert " " not in result


# ============================================================
# QueryNormalizer.get_cache_key() 테스트 (4개)
# ============================================================


class TestQueryNormalizerGetCacheKey:
    """QueryNormalizer.get_cache_key() 메서드 테스트"""

    def test_returns_md5_hex_string_of_32_chars(self) -> None:
        """MD5 해시 hex 문자열(32자)을 반환해야 한다."""
        key = QueryNormalizer.get_cache_key("test query")
        assert len(key) == 32
        # hex 문자열은 0-9, a-f 만 포함
        assert all(c in "0123456789abcdef" for c in key)

    def test_same_query_produces_same_key(self) -> None:
        """동일한 쿼리는 동일한 캐시 키를 생성해야 한다."""
        key1 = QueryNormalizer.get_cache_key("hello world")
        key2 = QueryNormalizer.get_cache_key("hello world")
        assert key1 == key2

    def test_different_queries_produce_different_keys(self) -> None:
        """서로 다른 쿼리는 서로 다른 캐시 키를 생성해야 한다."""
        key1 = QueryNormalizer.get_cache_key("hello")
        key2 = QueryNormalizer.get_cache_key("world")
        assert key1 != key2

    def test_normalized_equivalent_queries_produce_same_key(self) -> None:
        """정규화 후 동일한 쿼리는 같은 키를 생성해야 한다 (대소문자 무시)."""
        key_upper = QueryNormalizer.get_cache_key("Hello")
        key_lower = QueryNormalizer.get_cache_key("hello")
        assert key_upper == key_lower


# ============================================================
# QueryCache 테스트 (5개)
# ============================================================


class TestQueryCache:
    """QueryCache 클래스 테스트"""

    def test_get_nonexistent_key_returns_none(self) -> None:
        """존재하지 않는 키를 조회하면 None을 반환해야 한다."""
        cache = QueryCache(maxsize=10, ttl=60)
        result = cache.get("없는 쿼리")
        assert result is None

    def test_set_then_get_returns_stored_value(self) -> None:
        """set() 후 get()으로 저장된 값을 조회할 수 있어야 한다."""
        cache = QueryCache(maxsize=10, ttl=60)
        expected = {"answer": "테스트 응답", "score": 0.95}
        cache.set("테스트 쿼리", expected)
        result = cache.get("테스트 쿼리")
        assert result == expected

    def test_clear_removes_all_entries(self) -> None:
        """clear() 후 get()은 None을 반환해야 한다."""
        cache = QueryCache(maxsize=10, ttl=60)
        cache.set("쿼리1", "값1")
        cache.set("쿼리2", "값2")
        cache.clear()
        assert cache.get("쿼리1") is None
        assert cache.get("쿼리2") is None

    def test_stats_tracks_hits_and_misses(self) -> None:
        """hits/misses 통계가 정확히 추적되어야 한다."""
        cache = QueryCache(maxsize=10, ttl=60)

        # miss 1회
        cache.get("없는 쿼리")

        # 저장 후 hit 1회
        cache.set("쿼리", "값")
        cache.get("쿼리")

        stats = cache.get_stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["total_requests"] == 2

    def test_hit_rate_calculation(self) -> None:
        """hit_rate가 정확히 계산되어야 한다."""
        cache = QueryCache(maxsize=10, ttl=60)

        cache.set("쿼리", "값")

        # hit 3회
        cache.get("쿼리")
        cache.get("쿼리")
        cache.get("쿼리")

        # miss 1회
        cache.get("없는 쿼리")

        stats = cache.get_stats()
        # 4회 요청 중 3회 hit = 75.0%
        assert stats["total_requests"] == 4
        assert stats["hits"] == 3
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 75.0
