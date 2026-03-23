# 채용 요구사항 정렬 (Requirement-to-Project Mapping)

이 문서는 채용 공고의 요구사항을 CareerFlow AI MVP 기능/기술 구현과 1:1로 연결한다.

## 매핑 테이블

| 채용 요구사항/우대 | 프로젝트 내 반영 위치 | 증명하는 기능/기술 구현 | 포트폴리오/인터뷰 설명 문장 |
|---|---|---|---|
| AI/LLM 기반 문제 해결 | `backend/src/modules/langchain/*`, `analysis`/`followup-questions`/`generated-documents` API | 이력서/포트폴리오/JD를 구조화 JSON으로 변환 후 갭 분석, 후속 질문, 문서 생성까지 단계형 실행 | "단일 생성기가 아니라, 정보 부족을 탐지하고 보완하는 LLM 워크플로우를 설계했습니다." |
| OpenAI API 실무 운용 | `langchain-workflow.service.ts`, `.env.example` | 단일 공급자(OpenAI) 전략 + 환경변수 기반 키 주입 + fallback 처리 | "공급자를 단순화해 MVP 리스크를 낮추고, 키 미설정 시에도 로컬 플로우 검증이 가능하도록 설계했습니다." |
| 모델 라우팅 최적화 | `langchain-workflow.service.ts` | 단계별 모델 라우팅(경량 모델 vs 고품질 모델)으로 비용/품질 균형 | "문서 생성/리라이트만 고품질 모델을 사용해 비용 대비 품질을 최적화했습니다." |
| LangChain 실사용 역량 | `langchain-workflow.service.ts` 및 체인 분리 예정 파일 | `PromptTemplate` + 구조화 파싱 + `RunnableSequence`로 체인 모듈화 | "모든 AI 단계를 LangChain 체인으로 분리해 디버깅/재사용/개선이 가능하도록 만들었습니다." |
| TypeScript 실무 역량 | Backend + Frontend 전역 | DTO/class-validator/Zod 기반 타입 안정성, JSON 스키마 명시화 | "입력-분석-출력 전 구간에 타입 계약을 두어 AI 결과도 코드 레벨에서 검증했습니다." |
| NestJS 기반 백엔드 설계 | `AppModule`, `SourceDocumentsModule`, `AnalysisModule`, `PrismaModule`, `LangchainModule` | 모듈형 구조, REST API, ValidationPipe, 서비스 레이어 분리 | "NestJS 모듈 경계로 AI 오케스트레이션과 도메인 로직을 분리해 유지보수성을 확보했습니다." |
| Next.js/React 활용 능력 | `frontend/app/new/page.tsx`, `frontend/app/results/[id]/page.tsx` | 입력→분석 실행→후속답변→문서/면접질문 생성 플로우를 페이지 기반으로 구현 | "단순 채팅 UI가 아니라 실제 취업 준비 흐름을 반영한 태스크형 화면을 구현했습니다." |
| PostgreSQL 데이터 모델링 | `prisma/schema.prisma` | Application 중심 상태 전이 + 분석/생성 결과 JSON 저장 | "AI 중간 산출물을 DB에 남겨 재현성과 개선 이력을 확보했습니다." |
| 배포 가능성/운영 준비 | `README.md`, `.env.example`, `docs/api-spec.md`, `docs/architecture.md` | 실행 절차, 환경변수, API/아키텍처 문서화 | "코드뿐 아니라 재현 가능한 실행/배포 문서를 함께 제공해 실무 인수인계 수준으로 정리했습니다." |
| End-to-End 오너십 | 루트 문서 + 백엔드 구현 + 이후 프론트 연결 | 문제정의, 설계, 구현, 저장, 문서화, 배포 준비를 단일 프로젝트로 수행 | "요구사항 해석부터 제품 구현/검증/문서화까지 전 과정을 직접 리딩했습니다." |
| Product Thinking | 후속 질문 단계, JD 맞춤 리라이트 단계 | '정보 부족 탐지→질문→재생성' 루프와 타겟 맞춤 산출물 최적화 | "사용자 목표(합격 가능성 향상)에 맞춰 품질 개선 루프를 제품 기능으로 구현했습니다." |
| PM/PO 유사 오너십 | `docs/project-overview.md`, `docs/dev-log.md`, `docs/portfolio-points.md` | 범위 통제(MVP strict), 우선순위, 일정 계획, 변경 로그 관리 | "7일 MVP 제약 내에서 must/nice/cut을 관리하며 실행 가능한 로드맵으로 운영했습니다." |
| 문제 분해(Problem Decomposition) | 아키텍처 및 LangChain 단계 설계 | 파싱→추출→비교→갭탐지→질문→재생성→생성→리라이트로 분해 | "복잡한 생성 문제를 독립 검증 가능한 단계로 분해해 품질과 설명 가능성을 높였습니다." |
| 실무형 자동화 가치 | `POST /source-documents`, `/analysis/run`, `/followup-questions/submit`, `/generated-documents/generate`, `/interview/generate` | 채용 준비에 반복 발생하는 문서 작성/정합성 점검 작업 자동화 | "반복적이고 시간이 많이 드는 지원서 커스터마이징 업무를 자동화하는 도구로 설계했습니다." |
| 운영 안정성/비용 통제 | `request-rate-limiter.service.ts`, `workflow-execution-lock.service.ts` | 레이트 제한(429), 동시 실행 락(409), 중복 재실행 스킵 | "AI API 오남용을 방지하고, 동일 요청 중복 실행을 억제해 운영 안정성을 확보했습니다." |
| LLM/Agent/RAG 이해도 (과장 없는 수준) | 체인 기반 오케스트레이션, RAG 제외 의사결정 | MVP에서 RAG/멀티에이전트를 의도적으로 제외하고 체인 중심 구현 | "요구 가치 대비 복잡도를 고려해 RAG를 배제하고 체인 품질을 먼저 완성하는 선택을 했습니다." |

## 인터뷰용 핵심 스토리라인

1. 왜 챗봇이 아닌 워크플로우 제품으로 만들었는가  
2. 왜 one-shot 프롬프트 대신 단계형 체인을 택했는가  
3. 후속 질문 루프로 품질이 어떻게 개선되는가  
4. DB 저장/문서화/배포 준비로 어떻게 '프로젝트'가 아닌 '제품'이 되었는가

## 포트폴리오 작성 가이드 (요약)

- 문제: "지원 문서 품질과 JD 정합성을 빠르게 높이기 어렵다."
- 해결: "멀티스텝 LLM 워크플로우 + 보완 질문 루프 + 결과 리라이트."
- 증거: API 스펙, Prisma 스키마, 체인 구조, 전후 결과 비교, 트러블슈팅 로그.
