# claude-code-web

셀프호스팅 Claude Code 웹 채팅 인터페이스. 데이터베이스 불필요 — Docker만으로 완전 구동.

<!-- screenshots -->
<!-- ![로그인 화면](docs/screenshots/login.png) -->
<!-- ![채팅 세션](docs/screenshots/chat.png) -->
<!-- ![단발성 모드](docs/screenshots/single.png) -->
<!-- ![My CLAUDE.md](docs/screenshots/claude-md.png) -->

## 기능

- **멀티턴 채팅** — 세션 컨텍스트 유지
- **단발성 모드** — 상태 없는 워커 풀로 단건 요청 처리
- **개인 CLAUDE.md** — 사용자별 지시 파일
- **웹 기반 Claude 로그인** — UI에서 OAuth 플로우 진행, 로컬 `~/.claude` 마운트 불필요
- **자격증명 인증** — 환경변수 기반 아이디/패스워드 (DB 없음)
- **Google OAuth** — `GOOGLE_CLIENT_ID` 설정 시 선택적 활성화

## 빠른 시작

```bash
# 1. 환경변수 파일 복사
cp .env.example .env

# 2. .env 편집 — 최소한 NEXTAUTH_SECRET과 USERS 설정
#    NEXTAUTH_SECRET=$(openssl rand -base64 32)
#    USERS=admin:yourpassword

# 3. 시작
docker compose up --build
```

http://localhost:3000 접속

로그인 후 헤더의 **"Claude: Not logged in"** 을 클릭해 Claude 계정 OAuth 인증을 진행합니다.

## 설정

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `NEXTAUTH_SECRET` | **필수** | JWT 서명용 랜덤 시크릿 |
| `NEXTAUTH_URL` | `http://localhost:3000` | 앱의 공개 URL |
| `USERS` | — | `아이디:패스워드` 쌍, 쉼표로 구분 |
| `GOOGLE_CLIENT_ID` | — | Google OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth 클라이언트 시크릿 |
| `CLAUDE_MODEL` | `claude-sonnet-4-6` | 사용할 Claude 모델 |
| `AUTOMATION_POOL_SIZE` | `1` | 사전 워밍 워커 수 |
| `PORT` | `3000` | 웹 포트 |

## Claude 인증

Claude 자격증명은 컨테이너 내부 `/home/node/.claude`에 마운트된 Docker named volume(`claude-auth`)에 저장됩니다. 로컬 `~/.claude` 디렉토리를 마운트하지 않아도 됩니다.

**인증 방법:**
1. 앱에 접속해 계정으로 로그인
2. 헤더의 **"Claude: Not logged in"** 클릭
3. claude.ai OAuth 링크로 이동
4. 콜백 페이지에서 인증 코드를 복사해 붙여넣기
5. 새 자격증명으로 워커가 자동 재시작

자격증명은 Docker volume을 통해 컨테이너 재시작 후에도 유지됩니다.

## 개발 환경

```bash
pnpm install
cp .env.example .env.local
# .env.local 편집 (NEXTAUTH_SECRET, USERS 등)
pnpm dev:all   # automation-server + Next.js 동시 실행
```

## 아키텍처

```
브라우저 → Next.js (웹) → automation-server → Claude Code CLI
                  ↕ HMAC 토큰 인증
```

- **Next.js** — 인증(NextAuth.js) 처리, UI 제공, API 호출 프록시
- **automation-server** — Agent SDK를 통해 Claude Code 워커 풀 관리
- 워커는 사용자별로 격리(세션 모드) 또는 상태 없음(단발성 모드)
- Claude 로그인 후 새 자격증명을 반영하기 위해 워커가 자동 재시작

## FAQ

**claude.ai와 뭐가 다른가요?**

claude.ai는 채팅 인터페이스입니다. 이 프로젝트는 실제 Claude Code CLI 에이전트 — 파일 읽기/쓰기, 셸 명령 실행, 도구 사용 — 를 자체 서버에서 실행합니다. HTTP endpoint(`POST /run`)도 노출하기 때문에 스크립트나 자동화에 연동할 수 있습니다.

**CloudCLI나 claude-code-webui와 뭐가 다른가요?**

그 프로젝트들은 Claude Code CLI를 자식 프로세스로 실행하고 출력을 파싱합니다. 이 프로젝트는 [Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)를 직접 사용해 세션을 프로그래밍적으로 생성하고 관리합니다. 결과적으로 깔끔한 HTTP API이지, 터미널 스크래퍼가 아닙니다.

**`bypassPermissions`가 안전한가요?**

[docs/security.md](docs/security.md)를 참고하세요. 요약하면: Claude Code의 에이전트 기능은 비대화형 승인이 필요합니다. 웹 서버 환경에는 TTY가 없어서 `bypassPermissions`가 전체 에이전트를 활성화하는 유일한 모드입니다. 자체 Docker 컨테이너 안에서 실행되므로 접근 범위를 직접 통제할 수 있습니다.

**API 키가 필요한가요?**

아니요. 기존 Claude 계정으로 OAuth 인증합니다. Anthropic API 키가 필요 없습니다.

## 문서

- [보안](docs/security.md) — 권한 모드, 네트워크 보안, 자격증명 저장
