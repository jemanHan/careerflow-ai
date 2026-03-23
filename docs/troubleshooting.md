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
