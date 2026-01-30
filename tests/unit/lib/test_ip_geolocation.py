"""
IP Geolocation 모듈 단위 테스트

대상: app/lib/ip_geolocation.py (IPGeolocationModule)
목적: 사설 IP 분기, 캐시 히트/만료, API 에러 핸들링, 배치 예외 필터링 등
      실제 버그를 방지하는 유의미한 분기 로직 검증
의존성: pytest, pytest-asyncio, httpx (Mock)
"""

import hashlib
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.lib.ip_geolocation import IPGeolocationModule

# ---------------------------------------------------------------------------
# 픽스처 (Fixture)
# ---------------------------------------------------------------------------


@pytest.fixture
def module() -> IPGeolocationModule:
    """기본 설정의 IPGeolocationModule 인스턴스 생성"""
    return IPGeolocationModule(config={})


@pytest.fixture
def module_short_ttl() -> IPGeolocationModule:
    """짧은 캐시 TTL(1초)을 가진 인스턴스 생성"""
    return IPGeolocationModule(config={"ip_geolocation": {"cache_ttl": 1}})


# ---------------------------------------------------------------------------
# 1. _is_private_ip() — 6가지 분기 검증
# ---------------------------------------------------------------------------


class TestIsPrivateIP:
    """사설/내부 IP 판별 로직의 모든 분기를 검증한다."""

    def test_railway_internal_ip(self, module: IPGeolocationModule) -> None:
        """Railway 내부 IP(100.64.x.x)는 startswith 체크로 True를 반환해야 한다.

        Railway 배포 환경에서 100.64.0.0/10 대역이 사용되며,
        ipaddress 모듈만으로는 이 대역을 사설로 판별하지 못할 수 있다.
        startswith("100.64.")로 명시적 체크하는 로직이 핵심이다.
        """
        assert module._is_private_ip("100.64.1.1") is True
        assert module._is_private_ip("100.64.255.255") is True

    def test_standard_private_ips(self, module: IPGeolocationModule) -> None:
        """RFC 1918 사설 IP 대역은 True를 반환해야 한다."""
        # 10.0.0.0/8 대역
        assert module._is_private_ip("10.0.0.1") is True
        # 172.16.0.0/12 대역
        assert module._is_private_ip("172.16.0.1") is True
        # 192.168.0.0/16 대역
        assert module._is_private_ip("192.168.1.1") is True

    def test_loopback_ip(self, module: IPGeolocationModule) -> None:
        """루프백 IP(127.x.x.x)는 True를 반환해야 한다."""
        assert module._is_private_ip("127.0.0.1") is True

    def test_link_local_ip(self, module: IPGeolocationModule) -> None:
        """링크-로컬 IP(169.254.x.x)는 True를 반환해야 한다."""
        assert module._is_private_ip("169.254.0.1") is True

    def test_public_ip(self, module: IPGeolocationModule) -> None:
        """공인 IP는 False를 반환해야 한다."""
        assert module._is_private_ip("8.8.8.8") is False
        assert module._is_private_ip("1.1.1.1") is False

    def test_invalid_ip_format(self, module: IPGeolocationModule) -> None:
        """잘못된 IP 형식은 ValueError를 잡아서 False를 반환해야 한다.

        사용자 입력이나 프록시 헤더에서 비정상 문자열이 올 수 있다.
        ValueError 분기가 없으면 예외가 전파되어 서버 에러가 발생한다.
        """
        assert module._is_private_ip("not_an_ip") is False
        assert module._is_private_ip("999.999.999.999") is False
        assert module._is_private_ip("abc.def.ghi.jkl") is False


# ---------------------------------------------------------------------------
# 2. get_location() — 빈 IP, 사설 IP, 캐시, API 호출 분기
# ---------------------------------------------------------------------------


class TestGetLocation:
    """get_location()의 주요 분기 로직을 검증한다."""

    @pytest.mark.asyncio
    async def test_empty_ip_returns_fallback(self, module: IPGeolocationModule) -> None:
        """빈 문자열 IP는 fallback 결과를 반환하고 stats를 증가시켜야 한다."""
        result = await module.get_location("")

        assert result["country"] == "Unknown"
        assert result["country_code"] == "XX"
        assert result["ip"] == "unknown"
        assert module.stats["total_requests"] == 1

    @pytest.mark.asyncio
    async def test_private_ip_returns_local_network(
        self, module: IPGeolocationModule
    ) -> None:
        """사설 IP는 API를 호출하지 않고 즉시 Local Network 응답을 반환해야 한다."""
        result = await module.get_location("192.168.1.1")

        assert result["is_private"] is True
        assert result["country"] == "Local Network"
        assert result["country_code"] == "XX"
        assert result["ip"] == "192.168.1.1"
        # API 호출이 없어야 한다
        assert module.stats["api_calls"] == 0

    @pytest.mark.asyncio
    async def test_cache_hit_within_ttl(self, module: IPGeolocationModule) -> None:
        """TTL 이내의 캐시가 있으면 API를 호출하지 않고 캐시 데이터를 반환해야 한다."""
        ip = "8.8.8.8"
        cache_key = module.hash_ip(ip)
        cached_data = {
            "ip": ip,
            "ip_hash": cache_key,
            "country": "United States",
            "country_code": "US",
            "city": "Mountain View",
            "region": "California",
            "latitude": 37.386,
            "longitude": -122.084,
            "timezone": "America/Los_Angeles",
            "is_private": False,
            "cached": False,
        }

        # 유효한 캐시 직접 삽입 (1시간 후 만료)
        module.cache[cache_key] = {
            "data": cached_data.copy(),
            "expires_at": datetime.now() + timedelta(hours=1),
        }

        result = await module.get_location(ip)

        assert result["cached"] is True
        assert result["country"] == "United States"
        assert module.stats["cache_hits"] == 1
        assert module.stats["api_calls"] == 0

    @pytest.mark.asyncio
    async def test_cache_expired_triggers_api_call(
        self, module: IPGeolocationModule
    ) -> None:
        """만료된 캐시는 삭제하고 API를 다시 호출해야 한다."""
        ip = "8.8.8.8"
        cache_key = module.hash_ip(ip)
        expired_data = {
            "ip": ip,
            "ip_hash": cache_key,
            "country": "Old Country",
            "country_code": "OC",
            "cached": False,
        }

        # 이미 만료된 캐시 삽입
        module.cache[cache_key] = {
            "data": expired_data.copy(),
            "expires_at": datetime.now() - timedelta(hours=1),
        }

        # API 응답 Mock
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "country": "United States",
            "country_code": "US",
            "city": "Mountain View",
            "region": "California",
            "latitude": "37.386",
            "longitude": "-122.084",
            "timezone": "America/Los_Angeles",
        }
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.lib.ip_geolocation.httpx.AsyncClient", return_value=mock_client):
            result = await module.get_location(ip)

        # 만료 캐시가 삭제되고 새 데이터로 교체되었는지 확인
        assert result["country"] == "United States"
        assert result["cached"] is False
        assert module.stats["api_calls"] == 1
        # 캐시가 갱신되었는지 확인
        assert cache_key in module.cache
        assert module.cache[cache_key]["data"]["country"] == "United States"

    @pytest.mark.asyncio
    async def test_api_success_with_nil_latitude(
        self, module: IPGeolocationModule
    ) -> None:
        """GeoJS API가 'nil' 문자열을 반환하면 safe_float가 None으로 변환해야 한다.

        GeoJS API는 위치를 알 수 없는 경우 latitude/longitude에 "nil"을
        문자열로 반환한다. 이를 float()로 변환하면 ValueError가 발생하므로
        safe_float() 함수의 'nil' 처리 분기가 필수적이다.
        """
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "country": "South Korea",
            "country_code": "KR",
            "city": "Seoul",
            "region": "Seoul",
            "latitude": "nil",  # GeoJS가 실제로 반환하는 값
            "longitude": "126.978",
            "timezone": "Asia/Seoul",
        }
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.lib.ip_geolocation.httpx.AsyncClient", return_value=mock_client):
            result = await module.get_location("1.2.3.4")

        # "nil" → None, "126.978" → 126.978
        assert result["latitude"] is None
        assert result["longitude"] == 126.978
        assert result["country"] == "South Korea"
        assert result["is_private"] is False

    @pytest.mark.asyncio
    async def test_api_timeout_returns_fallback(
        self, module: IPGeolocationModule
    ) -> None:
        """API 타임아웃 시 fallback 결과를 반환하고 errors 카운트를 증가시켜야 한다."""
        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.TimeoutException("Connection timed out")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.lib.ip_geolocation.httpx.AsyncClient", return_value=mock_client):
            result = await module.get_location("8.8.8.8")

        assert result["country"] == "Unknown"
        assert result["country_code"] == "XX"
        assert result["ip"] == "8.8.8.8"
        assert module.stats["errors"] == 1
        assert module.stats["api_calls"] == 1

    @pytest.mark.asyncio
    async def test_api_http_error_returns_fallback(
        self, module: IPGeolocationModule
    ) -> None:
        """API가 HTTP 에러(4xx/5xx)를 반환하면 fallback 결과를 반환해야 한다."""
        # HTTPStatusError 생성에는 request와 response 객체가 필요
        mock_request = httpx.Request("GET", "https://example.com")
        mock_http_response = httpx.Response(429, request=mock_request)

        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.HTTPStatusError(
            "Rate limited", request=mock_request, response=mock_http_response
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.lib.ip_geolocation.httpx.AsyncClient", return_value=mock_client):
            result = await module.get_location("8.8.8.8")

        assert result["country"] == "Unknown"
        assert module.stats["errors"] == 1

    @pytest.mark.asyncio
    async def test_api_generic_exception_returns_fallback(
        self, module: IPGeolocationModule
    ) -> None:
        """예상치 못한 예외(네트워크 끊김 등)도 fallback으로 안전하게 처리해야 한다."""
        mock_client = AsyncMock()
        mock_client.get.side_effect = ConnectionError("Network unreachable")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.lib.ip_geolocation.httpx.AsyncClient", return_value=mock_client):
            result = await module.get_location("8.8.8.8")

        assert result["country"] == "Unknown"
        assert module.stats["errors"] == 1


# ---------------------------------------------------------------------------
# 3. get_location_batch() — 예외 필터링 검증
# ---------------------------------------------------------------------------


class TestGetLocationBatch:
    """배치 처리에서 예외가 발생한 항목이 결과에서 올바르게 필터링되는지 검증한다."""

    @pytest.mark.asyncio
    async def test_batch_filters_exceptions(
        self, module: IPGeolocationModule
    ) -> None:
        """3개 IP 중 1개가 예외를 발생시키면 정상 2개만 결과에 포함되어야 한다.

        asyncio.gather(return_exceptions=True)가 예외를 dict 대신 Exception 객체로
        반환하므로, isinstance(result, dict) 필터링이 없으면 KeyError가 발생한다.
        """
        ip_private = "192.168.1.1"  # 사설 IP → 정상 응답
        ip_empty = ""  # 빈 IP → 정상 fallback 응답

        # get_location을 부분 Mock: 특정 IP에서만 예외 발생
        original_get_location = module.get_location

        async def mock_get_location(ip: str) -> dict:
            if ip == "CRASH":
                raise RuntimeError("Unexpected crash")
            return await original_get_location(ip)

        module.get_location = mock_get_location  # type: ignore[assignment]

        result = await module.get_location_batch([ip_private, "CRASH", ip_empty])

        # 예외가 발생한 "CRASH"는 필터링되고, 나머지 2개만 포함
        assert len(result) == 2
        # 사설 IP와 빈 IP의 해시가 결과에 존재해야 한다
        assert module.hash_ip(ip_private) in result
        assert module.hash_ip("unknown") in result


# ---------------------------------------------------------------------------
# 4. get_stats() — 통계 계산 검증
# ---------------------------------------------------------------------------


class TestGetStats:
    """통계 계산 로직, 특히 ZeroDivisionError 방지 분기를 검증한다."""

    def test_stats_zero_requests(self, module: IPGeolocationModule) -> None:
        """요청이 0건일 때 cache_hit_rate가 0이어야 한다 (ZeroDivisionError 방지)."""
        stats = module.get_stats()
        assert stats["cache_hit_rate"] == 0
        assert stats["cache_size"] == 0
        assert stats["total_requests"] == 0

    @pytest.mark.asyncio
    async def test_stats_with_cache_hit(self, module: IPGeolocationModule) -> None:
        """캐시 히트 후 cache_hit_rate가 정확하게 계산되어야 한다."""
        ip = "8.8.8.8"
        cache_key = module.hash_ip(ip)

        # 유효한 캐시 삽입
        module.cache[cache_key] = {
            "data": {
                "ip": ip,
                "ip_hash": cache_key,
                "country": "US",
                "cached": False,
            },
            "expires_at": datetime.now() + timedelta(hours=1),
        }

        # 2회 요청 (모두 캐시 히트)
        await module.get_location(ip)
        await module.get_location(ip)

        stats = module.get_stats()
        assert stats["total_requests"] == 2
        assert stats["cache_hits"] == 2
        assert stats["cache_hit_rate"] == 100.0
        assert stats["cache_size"] == 1


# ---------------------------------------------------------------------------
# 5. hash_ip() — 해시 일관성 검증
# ---------------------------------------------------------------------------


class TestHashIP:
    """IP 해시 함수의 결정적(deterministic) 동작을 검증한다."""

    def test_hash_consistency(self, module: IPGeolocationModule) -> None:
        """동일 IP는 항상 동일한 SHA256 해시를 반환해야 한다."""
        ip = "8.8.8.8"
        expected = hashlib.sha256(ip.encode("utf-8")).hexdigest()

        assert module.hash_ip(ip) == expected
        # 두 번 호출해도 같은 값
        assert module.hash_ip(ip) == module.hash_ip(ip)

    def test_different_ips_produce_different_hashes(
        self, module: IPGeolocationModule
    ) -> None:
        """다른 IP는 다른 해시를 생성해야 한다 (충돌 방지 기본 검증)."""
        assert module.hash_ip("8.8.8.8") != module.hash_ip("8.8.4.4")
