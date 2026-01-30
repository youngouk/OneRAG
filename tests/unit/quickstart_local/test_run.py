"""
원클릭 실행 스크립트 단위 테스트

의존성 확인 로직을 테스트합니다.
"""



class TestRunHelpers:
    """실행 스크립트 헬퍼 함수 테스트"""

    def test_check_dependencies_all_installed(self):
        """
        모든 의존성이 설치된 경우

        Given: 필수 패키지 모두 설치됨
        When: check_dependencies() 호출
        Then: (True, []) 반환
        """
        from quickstart_local.run import check_dependencies

        ok, missing = check_dependencies()

        # chromadb는 프로젝트 의존성이므로 설치됨
        assert ok is True
        assert len(missing) == 0

    def test_check_env_file_missing(self):
        """
        .env 파일 미존재 시 경고

        Given: .env 파일이 없는 경로
        When: check_env_file() 호출
        Then: False 반환
        """
        from quickstart_local.run import check_env_file

        result = check_env_file("/nonexistent/path/.env")
        assert result is False

    def test_check_data_loaded_false_when_no_dir(self):
        """
        데이터 미적재 상태 확인

        Given: ChromaDB 데이터 디렉토리가 없음
        When: check_data_loaded() 호출
        Then: False 반환
        """
        from quickstart_local.run import check_data_loaded

        result = check_data_loaded("/nonexistent/chroma_data")
        assert result is False
