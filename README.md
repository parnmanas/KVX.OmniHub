# KVX.OmniHub

ESP32 + IR 송수신기를 사용한 무인 매장 하드웨어 컨트롤러.

## 구성

```
KVX.OmniHub/
├─ apps/
│  ├─ api/         NestJS 서버 (REST + WebSocket)
│  ├─ web/         Vite + React 관리자 UI
│  └─ firmware/    ESP32 펌웨어 (Phase 4 예정)
├─ packages/
│  └─ shared/      ESP32 ↔ 서버 프로토콜 타입 (TS)
└─ docs/
```

## 사전 요구사항

- **Node.js** 22 이상
- **pnpm** 10 이상 (`npm install -g pnpm`)
- Windows / macOS / Linux 모두 지원

## 빠른 시작

```powershell
# 1) 의존성 설치
pnpm install

# 2) 공유 패키지 빌드 (한 번)
pnpm build:shared

# 3) API .env 준비
Copy-Item apps/api/.env.example apps/api/.env

# 4) 개발 모드 (API + Web 동시 기동)
pnpm dev
```

- API: http://localhost:3000
- Web: http://localhost:5173 (API 로 `/api`, `/ws` 프록시)

### 기본 관리자 계정

최초 기동 시 `apps/api/.env` 의 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 로 자동 생성됩니다.

기본값: `admin` / `admin1234`

## DB 전환

기본은 SQLite (파일: `apps/api/data/omnihub.sqlite`). `.env` 에서 변경 가능:

```env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=omnihub
DB_PASSWORD=...
DB_DATABASE=omnihub
```

지원: `sqlite | postgres | mysql | mariadb | mssql`

> `synchronize: true` 는 개발 전용. 운영에서는 TypeORM migration 사용.

## 개별 명령

```powershell
pnpm --filter @omnihub/api dev          # API 만
pnpm --filter @omnihub/web dev          # Web 만
pnpm --filter @omnihub/shared dev       # 공유 타입 watch
pnpm typecheck                          # 전체 타입 체크
pnpm build                              # 전체 빌드
```

## Phase 진행 상황

- [x] **Phase 1** 웹 스캐폴딩 + DB 스키마 + 단일 관리자 로그인
- [ ] **Phase 2** 매장 / 장비 CRUD
- [ ] **Phase 3** WebSocket 허브 + ESP32 페어링 플로우
- [ ] **Phase 4** ESP32 펌웨어 기본 (Wi-Fi, WebSocket, heartbeat)
- [ ] **Phase 5** IR 학습 / 송신
- [ ] **Phase 6** 장비 템플릿 공유

## 프로토콜

ESP32 ↔ 서버 WebSocket 메시지 정의: [`packages/shared/src/protocol.ts`](./packages/shared/src/protocol.ts)
