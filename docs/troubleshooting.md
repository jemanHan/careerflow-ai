# Troubleshooting

## 2026-03-23 - npm 명령 미인식
- **문제**: 개발 환경에서 `npm`/`node` 실행이 되지 않음
- **가능 원인**: Node.js 미설치 또는 PATH 미설정
- **조치**:
  1. Node.js LTS 설치
  2. 새 터미널에서 `node -v`, `npm -v` 확인
  3. `backend`에서 `npm install` 재실행
- **영향**: 현재 커밋은 실행 전 코드 스캐폴딩 중심

## 2026-03-23 - git 명령 미인식
- **문제**: `git status` 실행 시 `git` 명령이 인식되지 않음
- **가능 원인**: Git 미설치 또는 PATH 미설정
- **조치**:
  1. Git 설치
  2. 새 터미널에서 `git --version` 확인
  3. 이후 커밋/브랜치 작업 진행
- **영향**: 현재 단계에서 실행 검증 및 커밋 자동화 불가

## 2026-03-23 - Backend npm install 의존성 충돌(해결)
- **문제**: `npm install` 시 `ERESOLVE unable to resolve dependency tree`
- **원인**: `langchain` 패키지와 `@langchain/*` 계열 버전 충돌
- **조치**: `backend/package.json`에서 불필요한 `langchain` 의존성 제거
- **결과**: backend 의존성 설치 성공

## 2026-03-23 - Prisma 마이그레이션 인증 실패(해결)
- **문제**: `npx prisma migrate dev --name init` 실행 시 `P1000 Authentication failed`
- **원인**: `.env`의 `DATABASE_URL` 계정 정보와 로컬 PostgreSQL 계정 정보 불일치
- **조치**:
  1. PostgreSQL 계정/비밀번호 확인
  2. `backend/.env`의 `DATABASE_URL` 수정
  3. 마이그레이션 재실행
- **결과**: 마이그레이션 성공, backend DB 연결 정상

## 2026-03-23 - Frontend build 타입 오류(해결)
- **문제**: `next build` 중 `results-client.tsx`에서 `unknown` 타입 대입 오류
- **원인**: API 응답 타입 미지정
- **조치**: 상태 업데이트 시 응답을 `ApplicationData`로 캐스팅
- **결과**: frontend build 성공

## 2026-03-23 - Backend 실행 시 포트 충돌(해결)
- **문제**: `listen EADDRINUSE :::4000`
- **원인**: 기존 프로세스가 4000 포트를 점유
- **조치**: 점유 PID 종료 후 backend 재기동
- **결과**: backend `start:dev` 정상 기동
- **예방 규칙**:
  1. 서버 시작 전 `netstat -ano | findstr :4000`로 포트 선점 확인
  2. 정상 서버면 재사용, 비정상이면 PID 종료 후 재기동
  3. 동일 서버 중복 세션 실행 금지

## 2026-03-23 - AI 과호출 보호 추가
- **문제**: 반복 클릭/중복 요청 시 불필요한 LLM 호출과 비용 증가 가능성
- **조치**:
  1. 요청 레이트 제한(429)
  2. 동일 단계 동시 실행 락(409)
  3. 기존 결과 재사용 스킵 로직 도입
- **결과**: 중복 실행 억제 및 비용/안정성 개선

## 2026-03-23 - OpenAI 429 insufficient_quota (해결: fallback 지속 실행)
- **문제**: 분석 단계에서 OpenAI `429 insufficient_quota` 발생
- **원인**: API 키는 유효했지만 계정 quota/billing 한도 초과
- **조치**:
  1. LangChain 단계 호출 예외를 잡아 fallback 응답으로 이어가도록 보강
  2. 워크플로우가 `500`으로 중단되지 않게 유지
- **결과**: quota 이슈가 있어도 입력→분석→질문→문서→면접질문 플로우 지속 가능
- **예방 규칙**:
  1. quota/billing 상태 사전 점검
  2. 외부 LLM API 실패 시 graceful fallback 유지
  3. 동일 실패 재시도 전 원인(429/401/timeout) 분류 후 대응

## 2026-03-23 - Nest DI 오류로 서버 시작 실패(해결)
- **문제**: `Nest can't resolve dependencies ... RequestRateLimiterService`
- **원인**: 공통 provider를 모듈 스코프에 노출하지 않아 `AnalysisModule`에서 주입 실패
- **조치**:
  1. `src/common/common.module.ts` 생성
  2. `@Global()` + provider/export 설정
  3. `AppModule`에 `CommonModule` import
- **결과**: backend 정상 기동
- **예방 규칙**:
  1. 공통 서비스는 Global module로 관리
  2. 신규 DI 서비스 추가 시 provider/export/import 경로를 함께 점검

## 2026-03-23 - Frontend build 중 EPERM `.next/trace` (진단 완료)
- **문제**: `next build` 실행 시 `EPERM: operation not permitted, open '.next/trace'`
- **원인**: `next dev` 실행 중 Windows 파일 잠금으로 `.next/trace` 접근 충돌
- **조치**:
  1. 개발 서버 실행 중에는 `build` 대신 `lint`/런타임 테스트 수행
  2. `build` 필요 시 프론트 dev 서버를 먼저 종료 후 실행
- **결과**: 코드 변경 자체는 `tsc --noEmit` 기준 정상
- **예방 규칙**:
  1. 포트/프로세스 상태 확인 후 빌드/서버 명령 분리
  2. 동일 산출 디렉터리를 공유하는 명령(`dev`/`build`) 동시 실행 금지

## 2026-03-23 - Frontend 500 (`routes-manifest.json` / chunk module not found) (해결)
- **문제**: `/new`, `/results/:id` 접속 시 500. 로그에 `ENOENT .next/routes-manifest.json`, `Cannot find module './778.js'`
- **원인**: Next dev 캐시 산출물(`.next`) 손상/불일치 상태에서 서버가 계속 실행됨
- **조치**:
  1. 포트 3000 점유 프로세스 확인
  2. 기존 frontend dev 프로세스 종료
  3. frontend dev 서버 단일 인스턴스로 재기동
- **결과**: `/new`, `/results/4` 모두 200 복구
- **예방 규칙**:
  1. 프론트 500 발생 시 동일 명령 반복 대신 로그에서 `ENOENT`/chunk 누락 여부 먼저 확인
  2. 캐시 산출물 오류면 기존 dev 프로세스를 종료 후 재기동
  3. 프론트 dev 서버는 한 인스턴스만 유지

## 2026-03-23 - 결과 화면 버튼 클릭 시 반응 없음처럼 보임(해결)
- **문제**: 워크플로우 버튼 클릭 후 실패/스킵 결과가 UI에 보이지 않아 무응답처럼 인지됨
- **원인**: 버튼 핸들러에서 API 에러/스킵 상태를 사용자 메시지로 노출하지 않음
- **조치**:
  1. `results-client`에 에러 메시지/액션 결과 메시지 표시 추가
  2. 이미 생성된 단계는 프론트에서 재요청 차단 및 안내 문구 표시
- **결과**: 클릭 후 성공/실패/스킵이 화면에 즉시 표시됨
- **예방 규칙**:
  1. 사용자 액션에는 반드시 가시적 성공/실패 피드백 제공
  2. 중복 호출 가능 버튼은 상태 기반 사전 차단

## 2026-03-23 - Gemini 라우팅인데 fallback 고정 출력 발생(진단 완료)
- **문제**: `WorkflowRun.inputJson.llmRoute`는 Gemini 모델로 기록되지만 실제 결과는 `LLM API 키 미설정 상태의 기본 프로필` fallback만 반환
- **원인**:
  1. 실행 환경에서 `provider=gemini`로 선택됨
  2. 그러나 실제 로딩된 환경값은 `geminiKeyPresent=false`, `openaiKeyPresent=true`
  3. 즉, 라우팅 메타데이터는 Gemini지만, Gemini 키 미탑재로 `getModelRouter()`가 `undefined`를 반환하여 fallback 분기로 진입
- **조치**:
  1. `LangchainWorkflowService`에 단계별 진단 로그 추가(`LLM success`/`Fallback used`, reason 포함)
  2. `WorkflowRun.inputJson`에 `llmExecution` 메타데이터 추가(`fallbackUsed`, `fallbackReason`, `hasProviderApiKey`)
  3. 환경 파일 직접 파싱 보강(`.env` 경로 탐색) 및 온도 변수(`LLM_TEMPERATURE`) 우선 읽기 보강
- **결과**: 이제 각 단계가 실제 LLM 응답인지 fallback인지 DB 로그에서 즉시 구분 가능
- **예방 규칙**:
  1. `llmRoute`만 보지 말고 `llmExecution.fallbackUsed`/`hasProviderApiKey`를 함께 확인
  2. provider 변경 후 최초 1회는 서버 부팅 로그의 `geminiKeyPresent` 값을 확인
  3. fallback 텍스트가 보이면 재시도보다 먼저 환경변수 로딩 상태를 확인

## 2026-03-23 - Gemini 키 인식 후 candidate 단계만 fallback (해결)
- **문제**: Gemini 키 인식은 정상인데 `EXTRACT_CANDIDATE` 단계만 fallback 발생
- **원인**: 모델 출력에서 `projects[].evidence`가 문자열로 반환되어 Zod 스키마(`string[]`) 파싱 실패
- **조치**:
  1. candidate 체인에서 `evidence`를 `string | string[]`로 유연 파싱
  2. 이후 항상 `string[]`로 정규화하여 최종 스키마 검증
- **결과**: 후보자 추출 포함 전체 단계 `fallbackUsed=false` 확인
- **예방 규칙**:
  1. LLM structured output은 엄격 스키마 전 정규화 레이어를 둔다
  2. 단계별 fallback 원인은 `workflowRuns.inputJson.llmExecution.fallbackReason`으로 즉시 확인한다

## 2026-03-23 - 결과 화면에서 상태 파악이 어려움 (해결)
- **문제**: 생성은 되었지만 사용자 입장에서 "왜 이렇게 나왔는지", "처리 중인지"를 판단하기 어려움
- **원인**:
  1. 정보 밀도가 높은 Raw JSON/UI 로그가 화면을 복잡하게 만듦
  2. 후속 질문 입력이 자유 텍스트 1박스라 질문-답변 매핑이 불명확
  3. LLM 처리 중 가시적인 진행 상태 표시 부족
- **조치**:
  1. 결과 페이지를 카드형 섹션으로 재구성
  2. `왜 이런 결과가 나왔나` 근거 요약 섹션 추가
  3. 후속 질문 1:1 입력 폼 도입
  4. 로딩 스피너/진행 문구 표시
  5. API 실행 로그/Raw JSON은 프론트에서 제거하고 서버 `WorkflowRun` 중심으로 운영
- **결과**: 사용자 관점에서 결과 해석과 입력 흐름이 명확해짐
- **예방 규칙**:
  1. 사용자 화면에는 요약/행동 중심 정보만 노출
  2. 상세 디버깅 로그는 서버 로그 저장소(`WorkflowRun`)로 분리

## 2026-03-24 - Cursor 환경 이식 스크립트 실행 후 설정 미적용 (해결)
- **문제**: `restore-env.ps1` 실행 성공 메시지가 나와도 Cursor 설정/키바인딩이 반영되지 않음
- **원인**: 스크립트가 `backup/`, `reports/` 하위 폴더 구조를 전제로 작성됐으나, 실제 `dev-env-backup.zip`은 루트 파일 구조
- **조치**:
  1. 스크립트에 구조 fallback 추가 (`backup/` 없으면 루트 경로 사용)
  2. 수정된 스크립트 재실행 후 `settings.json`, `keybindings.json` 반영 확인
- **결과**: Cursor 설정/키바인딩 정상 복원
- **예방 규칙**:
  1. 복원 스크립트는 zip 내부 경로 구조를 먼저 검증
  2. 성공 메시지 외에 실제 대상 파일 내용을 후검증

## 2026-03-24 - Gemini 429 / 분석이 끝나지 않음처럼 보임(원인: 무료 티어 쿼터)
- **문제**: 지원 적합도 분석 버튼 후 로딩이 매우 길거나 멈춘 것처럼 보임. 백엔드 로그에 `429 Too Many Requests`, `generate_content_free_tier_requests`, `limit: 20` 등
- **원인**: Gemini Developer API 무료 티어는 **모델별 일일 생성 요청 수**에 상한이 있음. 한도 초과 시 API가 `Retry-After`(예: 40초)를 주고, 클라이언트 재시도로 **한 단계만 수 분** 걸릴 수 있음. 분석은 LLM 호출이 여러 번 연속이라 체감상 “안 끝남”으로 보일 수 있음
- **조치**:
  1. [Google AI Studio 쿼터/요금](https://ai.google.dev/gemini-api/docs/rate-limits) 확인, **익일 재시도** 또는 유료/상위 플랜 검토
  2. 코드: LangChain `ChatGoogleGenerativeAI`에 `maxRetries: 0` 적용해 429 시 **즉시 실패 → 기존 fallback**으로 넘기고 응답 시간 단축(`langchain-workflow.service.ts`)
  3. 결과 화면에서 `llmExecution.fallbackUsed`·사유 확인
- **예방**: 데모/개발 시 호출 수를 줄이기(불필요한 `force` 반복 금지), 필요 시 `OPENAI` provider로 전환
- **모델 라우팅**: 기본(`GEMINI_DEFAULT_MODEL`, 예: `gemini-3.1-flash-lite`)과 고품질(`GEMINI_HIGH_QUALITY_MODEL`, 예: `gemini-2.5-flash`)은 **별도 쿼터 풀**이다. 한 모델로 합치지 않는 것이 의도된 설계(역할·비용·포트폴리오 설명 가능성). 429가 나면 해당 모델명만 한도 초과 가능
- **대략적인 LLM 호출 수(한 번의 ① 분석)**: 후보·JD·갭·후속 질문 등 **light 모델 호출이 여러 번** 연속됨. 동일 공고를 짧은 시간에 반복 실행하면 해당 모델 일일 한도를 빠르게 소모함

## 2026-03-24 - Next.js dev Internal Server Error (`778.js` / `routes-manifest.json`)(해결)
- **문제**: 브라우저에서 `Internal Server Error`, 터미널에 `Cannot find module './778.js'`, `ENOENT routes-manifest.json`, webpack 캐시 오류
- **원인**: `frontend/.next` 산출물이 HMR/중단·동시 편집 등으로 불완전해져 청크 참조가 깨짐
- **조치**:
  1. 포트 3000에서 기존 `next dev` 프로세스 종료
  2. `frontend/.next` 폴더 삭제
  3. `cd frontend && npm run dev`로 재기동
- **예방 규칙**: 동일 증상 시 코드 수정 전에 먼저 `.next` 정리 후 재시작
