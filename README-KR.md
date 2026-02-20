# claude-code-web

셀프호스팅 Claude Code 웹 채팅 인터페이스. 데이터베이스 불필요 — Docker만으로 완전 구동.

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
