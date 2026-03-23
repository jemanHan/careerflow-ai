# 아키텍처

## 시스템 구조
- Frontend (Next.js): 입력/결과 조회/분석 실행/후속답변/문서 생성/면접 질문 생성 화면
- Backend (NestJS): 모듈형 API + 워크플로우 오케스트레이션
- DB (PostgreSQL + Prisma): 상태, 단계 로그, 산출물 영속화
- AI (OpenAI + LangChain): 단계별 RunnableSequence 체인
- AI Provider: OpenAI 단일 제공자(초기 MVP 안정성/운영 단순성 우선)

## 백엔드 폴더 구조
```text
backend/
  prisma/
    schema.prisma
  src/
    app.module.ts
    main.ts
    modules/
      applications/
        # 제거됨 (중복 책임 정리)
      source-documents/
      analysis/
      followup-questions/
      generated-documents/
      interview/
      langchain/
        chains/
          candidate-profile.chain.ts
          job-posting.chain.ts
          gap-detection.chain.ts
          follow-up-questions.chain.ts
          document-generation.chain.ts
          interview-questions.chain.ts
          rewrite-tailoring.chain.ts
        langchain.module.ts
        langchain-workflow.service.ts
        workflow.types.ts
      prisma/
        prisma.module.ts
        prisma.service.ts
```

## 모듈 책임
- `SourceDocumentsModule`: 입력 원문 저장/조회
- `AnalysisModule`: parse~follow-up 질문 생성까지 실행
- `FollowupQuestionsModule`: 후속 답변 반영 재분석
- `GeneratedDocumentsModule`: 문서 생성 + 리라이트
- `InterviewModule`: 면접 질문 생성
- `LangchainModule`: 각 단계 체인 실행과 출력 형식 보장
- `PrismaModule`: DB 연결과 트랜잭션/CRUD 접근

## 구조화 AI 워크플로우 단계
1. `PARSE_SOURCE`: 입력 문서 결합/정규화
2. `EXTRACT_CANDIDATE`: 후보자 구조화 JSON 추출
3. `EXTRACT_JOB`: JD 구조화 JSON 추출
4. `DETECT_GAP`: 매칭/누락/근거약함 탐지
5. `GENERATE_FOLLOW_UP`: 보완 질문 생성
6. `REGENERATE_CANDIDATE`: 후속 답변 반영 재분석
7. `GENERATE_DRAFTS`: 문서 3종 초안 생성
8. `GENERATE_INTERVIEW`: 면접 질문 생성
9. `REWRITE_FOR_JOB`: JD 맞춤 리라이트

## 체인 오케스트레이션 원칙
- 각 단계는 독립 함수 + 독립 PromptTemplate 사용
- 단계별 입출력은 JSON으로 강제(파싱 실패 지점 명확화)
- 단계 실행 결과는 `WorkflowRun`으로 DB에 누적 기록
- one-shot 프롬프트 금지, 단계별 재실행 가능성 우선

## OpenAI 모델 라우팅
- 기본 모델(`OPENAI_MODEL`):
  - 후보자 추출
  - JD 분석
  - 갭 탐지
  - 후속 질문 생성
  - 면접 질문 생성
- 고품질 모델(`OPENAI_HIGH_QUALITY_MODEL`):
  - 문서 3종 생성
  - JD 맞춤 리라이트
- 키 미설정 시 fallback 응답을 반환해 로컬 E2E를 유지

## API 과호출 방지 설계(MVP)
- `RequestRateLimiterService`: 라우트별 분당 호출 제한(429)
- `WorkflowExecutionLockService`: 동일 `applicationId+stage` 동시 실행 차단(409)
- 재사용 캐시 전략:
  - 분석 결과가 이미 있으면 재분석 스킵
  - 동일 후속답변 재제출 시 재실행 스킵
  - 문서/면접질문이 이미 있으면 재생성 스킵
- 스킵 이벤트는 `WorkflowRun.errorMessage`에 기록

## 현재 엔드포인트
- `POST /v1/source-documents`
- `GET /v1/source-documents/:id`
- `POST /v1/analysis/run`
- `POST /v1/followup-questions/submit`
- `POST /v1/generated-documents/generate`
- `POST /v1/interview/generate`

## 프론트엔드 구현 상태
- `frontend/app/page.tsx`: 진입 페이지
- `frontend/app/new/page.tsx`: 소스 입력 폼
- `frontend/app/results/[id]/page.tsx`: 결과 확인 페이지
- `frontend/components/results-client.tsx`: 분석/후속/문서/면접 버튼 및 결과 섹션
