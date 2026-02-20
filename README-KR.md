# claude-code-web

Claude Code 에이전트를 HTTP endpoint로 노출하는 셀프호스팅 서버. \
API 키 불필요 — 기존 Claude 구독으로 동작. \
Docker 한 줄 배포.

![로그인 화면](docs/screenshots/login.png)
![채팅 세션](docs/screenshots/chat.png)
![단발성 모드](docs/screenshots/single.png)
![My CLAUDE.md](docs/screenshots/claude-md.png)

## 이게 뭔가요?

claude.ai는 채팅 UI입니다. 이건 다릅니다.

**Claude Code CLI 에이전트** — 파일 읽기/쓰기, 셸 명령 실행, 도구 사용 — 를 HTTP endpoint로 노출합니다.

```bash
curl -X POST http://localhost:8080/run \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prompt": "이 디렉토리의 TypeScript 파일에서 any 타입 찾아서 고쳐줘"}'

# {"success": true, "output": "...", "durationMs": 8432}
```

웹 UI는 이 위에 얹은 인터페이스일 뿐입니다.

## 활용 예시

- **Slack/Discord 봇** — 메시지 수신 → `POST /run` → 응답 전송
- **CI 자동 코드 리뷰** — PR diff → `POST /run` → 리뷰 코멘트
- **n8n / Make 자동화** — HTTP 노드로 Claude Code 연결
- **배치 처리** — 문서 요약, 번역, 분석 파이프라인
- **개인 AI 게이트웨이** — 개인 서버에 배포, 어디서든 브라우저로 접속

## 빠른 시작

```bash
cp .env.example .env
# NEXTAUTH_SECRET=$(openssl rand -base64 32)
# USERS=admin:yourpassword

docker compose up --build
```

http://localhost:3000 접속 → 로그인 → 헤더의 **"Not logged in · Setup"** 클릭 → Claude 계정 OAuth 인증

## 기존 프로젝트와 차이

| | CloudCLI / claude-code-webui | **claude-code-web** |
|---|---|---|
| 통합 방식 | CLI spawn + stdout 파싱 | **Agent SDK 직접 호출** |
| HTTP API | 없음 | **`POST /run` endpoint** |
| 외부 연동 | 웹 UI에서만 | **curl, 스크립트, 봇, CI** |
| 인증 | 로컬 `~/.claude` 의존 | **웹 OAuth (Docker 내부)** |

## 기능

- **`POST /run`** — Claude Code 에이전트를 HTTP로 호출
- **멀티턴 세션** — 사용자별 컨텍스트 유지
- **단발성 모드** — 상태 없는 워커 풀, stateless 처리
- **개인 CLAUDE.md** — 사용자별 커스텀 지시사항
- **웹 OAuth** — API 키 없이 기존 Claude 구독으로 인증
- **자격증명 인증** — 환경변수 기반 계정 관리 (DB 없음)

## 설정

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `NEXTAUTH_SECRET` | **필수** | JWT 서명용 랜덤 시크릿 |
| `NEXTAUTH_URL` | `http://localhost:3000` | 앱의 공개 URL |
| `USERS` | — | `아이디:패스워드` 쌍, 쉼표로 구분 |
| `CLAUDE_MODEL` | `claude-sonnet-4-6` | 사용할 Claude 모델 |
| `AUTOMATION_POOL_SIZE` | `1` | 사전 워밍 워커 수 |
| `PORT` | `3000` | 웹 포트 |

## Claude 인증

Claude 자격증명은 Docker named volume(`claude-auth`)에 저장됩니다. 로컬 `~/.claude` 마운트 불필요.

1. 앱 접속 → 로그인
2. 헤더의 **"Not logged in · Setup"** 클릭
3. OAuth 링크로 claude.ai 이동 → 인증
4. 콜백 페이지의 코드 복사 → 붙여넣기
5. 워커 자동 재시작, 즉시 사용 가능

## 개발 환경

```bash
pnpm install
cp .env.example .env.local
pnpm dev:all
```

## 아키텍처

```
브라우저 / curl
    ↓
Next.js (인증, UI, 프록시)
    ↓ HMAC 토큰
automation-server (워커 풀 관리)
    ↓ Agent SDK
Claude Code CLI (에이전트 실행)
```

- **automation-server** — `@anthropic-ai/claude-agent-sdk`로 세션 관리. CLI를 subprocess로 spawn하지 않음.
- **워커 풀** — 미리 예열된 세션으로 첫 응답 지연 최소화

## 문서

- [보안](docs/security.md) — 권한 모드, 네트워크 보안, 자격증명 저장
