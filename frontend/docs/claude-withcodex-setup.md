# Claude Code + Codex Pre-Analysis Integration

이 프로젝트 루트에 Claude UserPromptSubmit 훅을 추가해 Codex CLI(gpt-5-codex)를 통해 프롬프트 선분석 결과를 Claude에 주입하도록 구성했습니다. 아래 절차를 따르면 로컬 사용자 환경에서 `claude --withCodex` 사용 시 자동으로 동작합니다.

## 1. 선행 준비
- Codex CLI 설치: `npm i -g @openai/codex` 또는 `brew install codex`
- Claude Code CLI 최신 버전 설치
- Codex 분석 전용 보안 모드 권장값: `--sandbox read-only --ask-for-approval never`

## 2. --withCodex 플래그 래퍼 추가
사용자 셸(rc) 파일에 아래 함수 추가 후 셸을 재시작합니다.

```sh
claude() {
  local WITH=
  local args=()
  for arg in "$@"; do
    case "$arg" in
      --withCodex) WITH=1 ;;
      *) args+=("$arg") ;;
    esac
  done

  if [[ -n "$WITH" ]]; then
    CLAUDE_WITHCODEX=1 command claude "${args[@]}"
  else
    command claude "${args[@]}"
  fi
}
```

## 3. 프로젝트 내 훅 구성
- `.claude/hooks/withcodex_codex.py`: Codex exec 호출 및 추가 컨텍스트 반환 (에러 시 메시지도 첨부)
- `.claude/settings.json`: UserPromptSubmit 이벤트에 위 스크립트 등록 (`"$CLAUDE_PROJECT_DIR"`로 경로 인용, `dangerouslyOverrideSandbox: true`로 Codex CLI가 macOS Seatbelt에 막히지 않도록 설정)

## 4. 사용 방법
- 기본 실행: `claude`
- Codex 선분석: `claude --withCodex`
- 문제 발생 시 `claude --debug`로 훅 로그 확인

## 5. 선택 사항
`~/.codex/config.toml`에 아래를 추가하면 Codex CLI 기본 모델과 reasoning high를 고정할 수 있습니다.

```
model = "gpt-5-codex"
model_reasoning_effort = "high"
```

## 6. 보안 주의사항
- 훅 스크립트는 임의 명령 실행이 가능하므로 버전 관리를 통해 변경 내역을 추적합니다.
- 환경변수는 항상 따옴표로 감싸 주입합니다 (`"$CLAUDE_PROJECT_DIR"`).
- Codex CLI는 분석용으로만 사용 시 읽기 전용 샌드박스와 승인 차단 옵션을 유지합니다.
