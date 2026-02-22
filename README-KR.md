# claude-code-web

[claude-code-api](https://github.com/exitxio/claude-code-api)용 채팅 UI. \
API 키 불필요 — 기존 Claude 구독으로 동작. \
Docker 한 줄 배포.

![로그인 화면](docs/screenshots/login.png)
![Claude OAuth 설정](docs/screenshots/oauth-modal.png)
![채팅 세션](docs/screenshots/chat.png)
![단발성 모드](docs/screenshots/single.png)
![My CLAUDE.md](docs/screenshots/claude-md.png)

## 아키텍처

```
브라우저
    ↓
claude-code-web (Next.js — 인증, 채팅 UI)
    ↓ HMAC 토큰 (exitx 네트워크)
claude-code-api (워커 풀 + 큐)
    ↓ Agent SDK
Claude Code CLI (에이전트 실행)
```

- **claude-code-web** — 채팅 UI, 사용자 인증, API로 요청 프록시
- **[claude-code-api](https://github.com/exitxio/claude-code-api)** — 에이전트 엔진, 워커 풀, API key 인증 지원 HTTP API

## 빠른 시작

먼저 claude-code-api가 실행 중이어야 합니다. [claude-code-api](https://github.com/exitxio/claude-code-api) 참고.

```bash
git clone https://github.com/exitxio/claude-code-web.git
cd claude-code-web
cp .env.example .env
# NEXTAUTH_SECRET= (claude-code-api와 동일한 값)
# USERS=admin:yourpassword

pnpm docker:up
```

| 스크립트 | 동작 |
|----------|------|
| `pnpm docker:up` | 빌드 & 컨테이너 시작 |
| `pnpm docker:down` | 컨테이너 중지 |
| `pnpm docker:logs` | 컨테이너 로그 추적 |
| `pnpm docker:prod` | GHCR 이미지로 시작 |

http://localhost:3000 접속 → 로그인 → 헤더의 **"Not logged in · Setup"** 클릭 → Claude 계정 OAuth 인증

## 네트워크

claude-code-web과 claude-code-api는 **별도의** Docker Compose 스택으로 실행되며, 공유 `exitx` 네트워크로 연결됩니다.

```
claude-code-api (포트 8080)  ──┐
                                ├── exitx 네트워크
claude-code-web (포트 3000)  ──┘
```

claude-code-api가 네트워크를 생성합니다. claude-code-web은 external로 참조:

```yaml
# docker-compose.yml
services:
  web:
    environment:
      - AUTOMATION_SERVER_URL=http://claude-code-api:8080  # 환경변수명은 호환성 유지
    networks:
      - exitx

networks:
  exitx:
    external: true
```

**실행 순서:** api 먼저, web 나중.

```bash
# 1. API 시작
cd claude-code-api && pnpm docker:up

# 2. Web 시작
cd claude-code-web && pnpm docker:up
```

## 기능

- **멀티턴 세션** — 사용자별 컨텍스트 유지
- **단발성 모드** — 상태 없는 워커 풀, stateless 처리
- **개인 CLAUDE.md** — 사용자별 커스텀 지시사항
- **웹 OAuth** — API 키 없이 기존 Claude 구독으로 인증
- **자격증명 인증** — 환경변수 기반 계정 관리 (DB 없음)

## 설정

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `NEXTAUTH_SECRET` | **필수** | JWT 서명용 랜덤 시크릿 (api와 동일 값) |
| `NEXTAUTH_URL` | `http://localhost:3000` | 앱의 공개 URL |
| `USERS` | — | `아이디:패스워드` 쌍, 쉼표로 구분 |
| `PORT` | `3000` | 웹 포트 |

## Claude 인증

Claude 자격증명은 **api** 컨테이너의 Docker named volume(`claude-auth`)에 저장됩니다. 로컬 `~/.claude` 마운트 불필요.

1. 앱 접속 → 로그인
2. 헤더의 **"Not logged in · Setup"** 클릭
3. OAuth 링크로 claude.ai 이동 → 인증
4. 콜백 페이지의 코드 복사 → 붙여넣기
5. 워커 자동 재시작, 즉시 사용 가능

## 개발 환경

웹 UI와 API 서버는 별도 프로젝트입니다. 로컬 개발 시:

```bash
# 터미널 1 — API 서버 실행
cd ../claude-code-api
pnpm install
pnpm dev

# 터미널 2 — 웹 UI 실행
pnpm install
cp .env.example .env.local
pnpm dev
```

## HTTP API

HTTP API는 `claude-code-api`에서 제공합니다. API key 인증을 포함한 전체 API 문서는 [claude-code-api README](https://github.com/exitxio/claude-code-api)를 참고하세요.

## 문서

- [보안](docs/security.md) — 권한 모드, 네트워크 보안, 자격증명 저장
