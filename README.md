# CareerFlow AI

AI 기반 취업 지원 문서 워크플로우 MVP입니다.  
이력서/포트폴리오/JD를 입력하면 분석, 갭 탐지, 후속 질문, 문서 생성, JD 맞춤 리라이트까지 수행합니다.

## Stack
- Frontend: Next.js + TypeScript + Tailwind CSS
- Backend: NestJS + TypeScript
- DB: PostgreSQL + Prisma
- AI: OpenAI API + LangChain

## MVP 기능
1. 입력 문서 수집
2. 후보자/JD 구조화 분석
3. 갭 분석 + 후속 질문 생성
4. 후속 답변 반영 재분석
5. 지원 문서 및 면접 질문 생성
6. JD 맞춤 리라이트

## Backend 시작 (Node 설치 후)
```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

### OpenAI 환경변수
- `OPENAI_API_KEY`: 실제 키 (없으면 fallback 모드)
- `OPENAI_MODEL`: 기본/경량 작업용 모델
- `OPENAI_HIGH_QUALITY_MODEL`: 문서 생성/리라이트용 고품질 모델
- `OPENAI_TEMPERATURE`: 공통 temperature

### 과호출 보호(기본 내장)
- AI 라우트별 분당 호출 제한
- 동일 워크플로우 단계 동시 실행 차단
- 기존 결과가 있으면 중복 재생성 스킵

## Frontend 시작
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

## Safe Local Run Rules
- 백엔드 실행 전:
  - `netstat -ano | findstr :4000`
- 프론트 실행 전:
  - `netstat -ano | findstr :3000`
- 포트 점유 PID 종료:
  - `cmd.exe /c "taskkill /PID 26500 /F"`
- 규칙:
  - 정상 서버가 이미 떠 있으면 재사용
  - 비정상 프로세스만 종료 후 재기동
  - 동일 서버 중복 실행 금지
  - 동일 실패 명령 반복 전 원인 진단 우선

## Docs
- `docs/project-overview.md`
- `docs/job-alignment.md`
- `docs/architecture.md`
- `docs/api-spec.md`
- `docs/db-schema.md`
- `docs/troubleshooting.md`
- `docs/dev-log.md`
- `docs/portfolio-points.md`
