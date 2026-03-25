# Troubleshooting

## 빠른 참조 (최신 동작 기준)

| 증상 | 확인 |
|------|------|
| Vercel에서 API가 안 붙음 | `NEXT_PUBLIC_API_BASE_URL`, Mixed Content 시 `BACKEND_URL` + `next.config.ts` rewrites |
| 브라우저 CORS 차단 | EC2 `CORS_ORIGIN`에 **프론트 정확한 Origin** (콤마 구분). production에서 비우면 요청 거부 |
| `PATCH .../meta` CORS 실패 | 백엔드 `enableCors`에 `PATCH` 허용 여부 확인 |
| `GET .../by-test-user/009` **403** | `x-test-user-id` 헤더와 URL의 **테스트 ID가 동일**해야 함. `/my`에서 조회 전 활성 ID 동기화 |
| 문서 생성 실패(503) | `GEMINI_API_KEY`, 쿼터, 네트워크. 실패 시 **기존 초안은 placeholder로 덮지 않음** |
| 분석이 “스킵됨”처럼 느껴짐 | `POST /analysis/run`은 **매번 전체 파이프라인 실행**. 다른 포트/다른 인스턴스에 붙었는지 확인 |
| EC2 배포 | 서버에서 `git pull` 후 **`backend`에서** `npm ci` → `prisma generate` → `migrate deploy` → `npm run build` → PM2 |

---

## 이슈 이력 (날짜순)

### 2026-03-23 — npm / git / PATH

- Node·Git 미설치 또는 PATH 미설정 시 명령 실패 → LTS Node·Git 설치 후 새 터미널에서 확인.

### 2026-03-23 — Backend `npm install` 의존성 충돌

- `langchain` vs `@langchain/*` 충돌 → 불필요한 `langchain` 의존성 제거.

### 2026-03-23 — Prisma `P1000` Authentication failed

- `DATABASE_URL`과 로컬 Postgres 계정 불일치 → 계정·비밀번호 맞춘 뒤 재실행.

### 2026-03-23 — Frontend 빌드 타입 / EPERM `.next/trace`

- `next build` 중 dev 서버가 `.next` 잠금 → `next dev` 종료 후 빌드 또는 `.next` 삭제 후 재시도.

### 2026-03-23 — Backend `EADDRINUSE :4000`

- 기존 프로세스 점유 → PID 종료 후 재기동. 다른 백엔드/도구가 4000 사용 중인지 확인.

### 2026-03-23 — Nest DI `RequestRateLimiterService`

- `CommonModule` 전역 등록으로 해결.

### 2026-03-23 — Next dev 500 (`routes-manifest`, chunk 누락)

- `.next` 손상 시 dev 종료 → `.next` 삭제 → `npm run dev` 재시작.

### 2026-03-23 — Gemini 라우팅 vs fallback

- `llmRoute`만 보지 말고 `llmExecution.fallbackUsed`, `hasProviderApiKey` 확인. 키 미설정 시 fallback.

### 2026-03-23 — 후보 추출 파싱 `evidence` 타입

- LLM이 문자열 반환 시 Zod 실패 → `string | string[]` 정규화 후 `string[]`로 통일.

### 2026-03-24 — Gemini 429 / 분석 지연

- 무료 티어 한도·재시도로 체감 지연 → 쿼터 확인, `maxRetries` 조정, 호출 수 줄이기.

### 2026-03-24 — Next `778.js` / `routes-manifest.json`

- 동일하게 `.next` 정리 후 dev 재시작.

---

## 문서·운영 (최신)

### 문서 생성 시 내부 텍스트 유출

- 과거: LLM 실패 시 placeholder가 `generatedDraftJson`에 섞일 수 있음.  
- 현재: 실패 시 **503**, `WorkflowRun`에 실패 기록, **유효한 기존 초안은 덮어쓰지 않음**.

### 워크플로 이름 저장 CORS

- `PATCH`가 프리플라이트에서 막히면 백엔드 CORS `methods`에 `PATCH` 포함 여부 확인.

---

## 참고

- 로컬·배포 환경변수: `backend/.env.example`, `frontend/.env.local.example`  
- 배포 절차: 루트 `README.md`  
