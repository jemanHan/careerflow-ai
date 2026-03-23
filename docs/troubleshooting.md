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

## 2026-03-23 - AI 과호출 보호 추가
- **문제**: 반복 클릭/중복 요청 시 불필요한 LLM 호출과 비용 증가 가능성
- **조치**:
  1. 요청 레이트 제한(429)
  2. 동일 단계 동시 실행 락(409)
  3. 기존 결과 재사용 스킵 로직 도입
- **결과**: 중복 실행 억제 및 비용/안정성 개선
