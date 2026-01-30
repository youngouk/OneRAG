"""
NullEnricher 단위 테스트

Null Object 패턴으로 구현된 NullEnricher의 모든 메서드를 검증합니다.
보강 기능이 비활성화된 상태에서 안전하게 동작하는지 확인합니다.

대상 모듈: app/modules/core/enrichment/enrichers/null_enricher.py
의존성: EnricherInterface, EnrichmentResult
"""

import pytest

from app.modules.core.enrichment.enrichers.null_enricher import NullEnricher
from app.modules.core.enrichment.interfaces.enricher_interface import EnricherInterface
from app.modules.core.enrichment.schemas.enrichment_schema import EnrichmentResult


class TestNullEnricher:
    """NullEnricher 단위 테스트 스위트"""

    def test_인스턴스_생성(self) -> None:
        """NullEnricher 인스턴스가 정상적으로 생성되는지 확인한다."""
        enricher = NullEnricher()
        assert enricher is not None

    def test_인터페이스_구현_확인(self) -> None:
        """NullEnricher가 EnricherInterface를 구현하는지 확인한다."""
        enricher = NullEnricher()
        assert isinstance(enricher, EnricherInterface)

    @pytest.mark.asyncio
    async def test_enrich_일반_문서_None_반환(self) -> None:
        """enrich()가 일반 문서에 대해 None을 반환하는지 확인한다."""
        enricher = NullEnricher()
        document = {"content": "테스트 문서 내용입니다."}

        result = await enricher.enrich(document)

        assert result is None

    @pytest.mark.asyncio
    async def test_enrich_빈_문서_None_반환(self) -> None:
        """enrich()가 빈 딕셔너리에 대해 None을 반환하는지 확인한다."""
        enricher = NullEnricher()

        result = await enricher.enrich({})

        assert result is None

    @pytest.mark.asyncio
    async def test_enrich_batch_여러_문서_None_리스트_반환(self) -> None:
        """enrich_batch()가 문서 수만큼의 None 리스트를 반환하는지 확인한다."""
        enricher = NullEnricher()
        documents = [
            {"content": "문서 1"},
            {"content": "문서 2"},
            {"content": "문서 3"},
        ]

        result = await enricher.enrich_batch(documents)

        assert result == [None, None, None]
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_enrich_batch_빈_리스트_빈_리스트_반환(self) -> None:
        """enrich_batch()가 빈 리스트 입력에 대해 빈 리스트를 반환하는지 확인한다."""
        enricher = NullEnricher()

        result = await enricher.enrich_batch([])

        assert result == []
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_validate_enrichment_True_반환(self) -> None:
        """validate_enrichment()가 어떤 EnrichmentResult에 대해서든 True를 반환하는지 확인한다."""
        enricher = NullEnricher()
        # EnrichmentResult 직접 생성 (필수 필드 모두 제공)
        enrichment = EnrichmentResult(
            category_main="테스트",
            category_sub="단위테스트",
            intent="검증 요청",
            consult_type="테스트문의",
            keywords=["테스트", "검증"],
            summary="NullEnricher 검증용 테스트 데이터",
        )

        result = await enricher.validate_enrichment(enrichment)

        assert result is True

    @pytest.mark.asyncio
    async def test_initialize_cleanup_에러_없음(self) -> None:
        """initialize()와 cleanup() 호출 시 에러가 발생하지 않는지 확인한다."""
        enricher = NullEnricher()

        # 에러 없이 정상 실행되어야 함
        await enricher.initialize()
        await enricher.cleanup()
