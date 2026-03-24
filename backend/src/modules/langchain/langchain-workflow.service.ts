import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { config as dotenvConfig } from "dotenv";
import { join } from "path";
import { runCandidateProfileChain } from "./chains/candidate-profile.chain";
import { runDocumentGenerationChain } from "./chains/document-generation.chain";
import { runFollowUpQuestionsChain } from "./chains/follow-up-questions.chain";
import { runGapDetectionChain } from "./chains/gap-detection.chain";
import { runInterviewQuestionsChain } from "./chains/interview-questions.chain";
import { runJobPostingChain } from "./chains/job-posting.chain";
import { runRewriteTailoringChain } from "./chains/rewrite-tailoring.chain";
import {
  CandidateProfile,
  GapAnalysis,
  GeneratedDraft,
  InterviewReportItem,
  JobPostingProfile,
  RewriteDraft
} from "./workflow.types";

type RouteKind = "light" | "quality";
type WorkflowStep =
  | "extractCandidateProfile"
  | "extractJobPosting"
  | "detectGaps"
  | "generateFollowUpQuestions"
  | "generateDocuments"
  | "generateInterviewQuestions"
  | "rewriteForTargetJob";

type RoutingInfo = {
  provider: "gemini" | "openai";
  route: RouteKind;
  model: string;
};

type ExecutionDiagnostics = RoutingInfo & {
  fallbackUsed: boolean;
  fallbackReason?: string;
  hasProviderApiKey: boolean;
};

@Injectable()
export class LangchainWorkflowService {
  private readonly logger = new Logger(LangchainWorkflowService.name);
  private readonly provider: "gemini" | "openai";
  private readonly geminiApiKey?: string;
  private readonly openaiApiKey?: string;
  private readonly defaultModel: string;
  private readonly highQualityModel: string;
  private readonly temperature: number;
  private readonly llmByModel = new Map<string, BaseChatModel>();
  private readonly lastExecutionByStep = new Map<WorkflowStep, ExecutionDiagnostics>();

  private readNonEmpty(...values: Array<string | undefined>): string | undefined {
    for (const value of values) {
      const trimmed = value?.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    return undefined;
  }

  constructor(private readonly configService: ConfigService) {
    const parsedFromCwd = dotenvConfig({ path: join(process.cwd(), ".env") }).parsed ?? {};
    const parsedFromBackendRoot = dotenvConfig({ path: join(process.cwd(), "backend/.env") }).parsed ?? {};
    const parsedDotenv = { ...parsedFromBackendRoot, ...parsedFromCwd };
    const rawProvider = this.readNonEmpty(
      this.configService.get<string>("LLM_PROVIDER"),
      parsedDotenv.LLM_PROVIDER
    )?.toLowerCase();
    this.geminiApiKey = this.readNonEmpty(
      this.configService.get<string>("GEMINI_API_KEY"),
      parsedDotenv.GEMINI_API_KEY,
      this.configService.get<string>("GOOGLE_API_KEY"),
      parsedDotenv.GOOGLE_API_KEY
    );
    this.openaiApiKey = this.readNonEmpty(
      this.configService.get<string>("OPENAI_API_KEY"),
      parsedDotenv.OPENAI_API_KEY
    );
    this.provider = rawProvider === "openai" ? "openai" : "gemini";
    if (this.provider === "gemini") {
      // 역할 기반 라우팅: 경량(기본) vs 고품질은 별도 모델·별도 쿼터. 한 모델로 합치지 않음.
      this.defaultModel =
        this.configService.get<string>("GEMINI_DEFAULT_MODEL") ??
        parsedDotenv.GEMINI_DEFAULT_MODEL ??
        "gemini-3.1-flash-lite";
      this.highQualityModel =
        this.configService.get<string>("GEMINI_HIGH_QUALITY_MODEL") ??
        parsedDotenv.GEMINI_HIGH_QUALITY_MODEL ??
        "gemini-2.5-flash";
    } else {
      this.defaultModel =
        this.configService.get<string>("OPENAI_MODEL") ?? parsedDotenv.OPENAI_MODEL ?? "gpt-4.1-mini";
      this.highQualityModel =
        this.configService.get<string>("OPENAI_HIGH_QUALITY_MODEL") ??
        parsedDotenv.OPENAI_HIGH_QUALITY_MODEL ??
        this.defaultModel;
    }
    this.temperature = Number(
      this.configService.get<string>("LLM_TEMPERATURE") ??
        parsedDotenv.LLM_TEMPERATURE ??
        this.configService.get<string>("OPENAI_TEMPERATURE") ??
        parsedDotenv.OPENAI_TEMPERATURE ??
        "0.2"
    );
    this.logger.log(
      `LLM config loaded: provider=${this.provider}, geminiKeyPresent=${Boolean(this.geminiApiKey)}, openaiKeyPresent=${Boolean(this.openaiApiKey)}, defaultModel=${this.defaultModel}, highQualityModel=${this.highQualityModel}`
    );
  }

  private routeOf(step: WorkflowStep): RouteKind {
    // light(기본): 추출·JD·갭·후속·면접 질문. quality(고품질): 문서 생성·JD 맞춤 리라이트만.
    return step === "generateDocuments" || step === "rewriteForTargetJob" ? "quality" : "light";
  }

  getRoutingInfo(step: WorkflowStep): RoutingInfo {
    const route = this.routeOf(step);
    return {
      provider: this.provider,
      route,
      model: route === "quality" ? this.highQualityModel : this.defaultModel
    };
  }

  getExecutionDiagnostics(step: WorkflowStep): ExecutionDiagnostics {
    const route = this.getRoutingInfo(step);
    return (
      this.lastExecutionByStep.get(step) ?? {
        ...route,
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      }
    );
  }

  private markExecution(step: WorkflowStep, data: Omit<ExecutionDiagnostics, "provider" | "route" | "model">): void {
    const route = this.getRoutingInfo(step);
    const payload: ExecutionDiagnostics = {
      ...route,
      ...data
    };
    this.lastExecutionByStep.set(step, payload);
    if (payload.fallbackUsed) {
      this.logger.warn(
        `Fallback used at ${step}: provider=${payload.provider}, model=${payload.model}, reason=${payload.fallbackReason ?? "unknown"}`
      );
    } else {
      this.logger.debug(`LLM success at ${step}: provider=${payload.provider}, model=${payload.model}`);
    }
  }

  private getModelRouter(stage: RouteKind): BaseChatModel | undefined {
    const key = `${this.provider}:${stage === "quality" ? this.highQualityModel : this.defaultModel}`;
    const existing = this.llmByModel.get(key);
    if (existing) {
      return existing;
    }

    const modelName = stage === "quality" ? this.highQualityModel : this.defaultModel;
    if (this.provider === "gemini") {
      if (!this.geminiApiKey) {
        return undefined;
      }
      const created = new ChatGoogleGenerativeAI({
        apiKey: this.geminiApiKey,
        model: modelName,
        temperature: this.temperature,
        // 429(쿼터) 등에는 재시도해도 같은 날 소용없어 응답이 길어지기만 함 → 즉시 실패 후 fallback
        maxRetries: 0
      });
      this.llmByModel.set(key, created);
      return created;
    }

    if (!this.openaiApiKey) {
      return undefined;
    }
    const created = new ChatOpenAI({
      apiKey: this.openaiApiKey,
      model: modelName,
      temperature: this.temperature,
      maxRetries: 0
    });
    this.llmByModel.set(key, created);
    return created;
  }

  async extractCandidateProfile(
    inputText: string,
    prioritizedProjectContext?: string
  ): Promise<CandidateProfile> {
    const step: WorkflowStep = "extractCandidateProfile";
    const llm = this.getModelRouter(this.routeOf(step));
    if (!llm) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: "missing_api_key_or_provider_unavailable",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        summary: "LLM API 키 미설정 상태의 기본 프로필",
        strengths: ["TypeScript", "문제 해결", "제품 중심 사고"],
        experiences: [],
        projects: []
      };
    }
    try {
      const result = await runCandidateProfileChain(llm, inputText, prioritizedProjectContext);
      this.markExecution(step, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return result;
    } catch (error) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: error instanceof Error ? error.message : "unknown_error",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        summary: "LLM 호출 실패 시 기본 프로필",
        strengths: ["TypeScript", "문제 해결", "제품 중심 사고"],
        experiences: [],
        projects: []
      };
    }
  }

  async extractJobPosting(jobText: string): Promise<JobPostingProfile> {
    const step: WorkflowStep = "extractJobPosting";
    const llm = this.getModelRouter(this.routeOf(step));
    if (!llm) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: "missing_api_key_or_provider_unavailable",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        role: "AI/Data Product Engineer",
        requiredSkills: ["TypeScript", "NestJS", "React", "PostgreSQL", "AWS"],
        preferredSkills: ["LangChain", "LLM Product Engineering"],
        responsibilities: ["제품 구현", "배포", "기술 의사결정"],
        evaluationSignals: ["end-to-end ownership", "practical AI problem solving"]
      };
    }
    try {
      const result = await runJobPostingChain(llm, jobText);
      this.markExecution(step, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return result;
    } catch (error) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: error instanceof Error ? error.message : "unknown_error",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        role: "AI/Data Product Engineer",
        requiredSkills: ["TypeScript", "NestJS", "React", "PostgreSQL", "AWS"],
        preferredSkills: ["LangChain", "LLM Product Engineering"],
        responsibilities: ["제품 구현", "배포", "기술 의사결정"],
        evaluationSignals: ["end-to-end ownership", "practical AI problem solving"]
      };
    }
  }

  async detectGaps(
    candidate: CandidateProfile,
    job: JobPostingProfile
  ): Promise<GapAnalysis> {
    const step: WorkflowStep = "detectGaps";
    const llm = this.getModelRouter(this.routeOf(step));
    if (!llm) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: "missing_api_key_or_provider_unavailable",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        matchedSignals: ["TypeScript 기반 구현 경험"],
        missingSignals: ["AWS 운영 증거", "배포 자동화 증거"],
        weakEvidence: ["정량 성과 지표 부족"]
      };
    }
    try {
      const result = await runGapDetectionChain(llm, candidate, job);
      this.markExecution(step, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return result;
    } catch (error) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: error instanceof Error ? error.message : "unknown_error",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        matchedSignals: ["TypeScript 기반 구현 경험"],
        missingSignals: ["AWS 운영 증거", "배포 자동화 증거"],
        weakEvidence: ["정량 성과 지표 부족"]
      };
    }
  }

  async generateFollowUpQuestions(gap: GapAnalysis): Promise<string[]> {
    const step: WorkflowStep = "generateFollowUpQuestions";
    const llm = this.getModelRouter(this.routeOf(step));
    if (!llm) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: "missing_api_key_or_provider_unavailable",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return [
        "지원하려는 직무에서 자신 있게 쓸 수 있는 기술 키워드 2~3개를 적어 주세요.",
        "최근에 몰입했던 프로젝트에서 본인이 맡은 역할을 한 문장으로 적어 주세요.",
        "성과나 배운 점을 한 줄로 적어 주세요. (없으면 '없음')"
      ];
    }
    try {
      const result = await runFollowUpQuestionsChain(llm, gap);
      this.markExecution(step, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return result;
    } catch (error) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: error instanceof Error ? error.message : "unknown_error",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return [
        "지원하려는 직무에서 자신 있게 쓸 수 있는 기술 키워드 2~3개를 적어 주세요.",
        "최근에 몰입했던 프로젝트에서 본인이 맡은 역할을 한 문장으로 적어 주세요.",
        "성과나 배운 점을 한 줄로 적어 주세요. (없으면 '없음')"
      ];
    }
  }

  async regenerateCandidateWithFollowUp(
    currentCandidate: CandidateProfile,
    followUpAnswers: string,
    prioritizedProjectContext?: string
  ): Promise<CandidateProfile> {
    const mergedInput = [
      "Current candidate profile JSON:",
      JSON.stringify(currentCandidate),
      "New follow-up evidence:",
      followUpAnswers
    ].join("\n");
    return this.extractCandidateProfile(mergedInput, prioritizedProjectContext);
  }

  async generateDocuments(
    candidate: CandidateProfile,
    job: JobPostingProfile,
    prioritizedProjectContext?: string
  ): Promise<GeneratedDraft> {
    const step: WorkflowStep = "generateDocuments";
    const llm = this.getModelRouter(this.routeOf(step));
    if (!llm) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: "missing_api_key_or_provider_unavailable",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        coverLetter: `지원 동기와 직무 정합성을 강조한 초안\n${JSON.stringify(candidate)}`,
        careerDescription: `경력 기술 초안\n${JSON.stringify(candidate)}`,
        projectIntro: `프로젝트 소개 초안\n${JSON.stringify(candidate)}`
      };
    }
    try {
      const result = await runDocumentGenerationChain(llm, candidate, job, prioritizedProjectContext);
      this.markExecution(step, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return result;
    } catch (error) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: error instanceof Error ? error.message : "unknown_error",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        coverLetter: `지원 동기와 직무 정합성을 강조한 초안\n${JSON.stringify(candidate)}`,
        careerDescription: `경력 기술 초안\n${JSON.stringify(candidate)}`,
        projectIntro: `프로젝트 소개 초안\n${JSON.stringify(candidate)}`
      };
    }
  }

  async generateInterviewQuestions(
    candidate: CandidateProfile,
    job: JobPostingProfile,
    prioritizedProjectContext?: string,
    gapAnalysis?: GapAnalysis
  ): Promise<InterviewReportItem[]> {
    const step: WorkflowStep = "generateInterviewQuestions";
    const llm = this.getModelRouter(this.routeOf(step));
    if (!llm) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: "missing_api_key_or_provider_unavailable",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return [
        {
          section: "core",
          question: "강조 프로젝트에서 본인의 역할과 기여 범위를 어떻게 나눠 설명하시겠습니까?",
          whyAsked: "JD의 책임 범위 검증과 프로젝트 실제 기여도 확인을 위해 생성되었습니다.",
          answerPoints: ["요구사항-담당 범위-결과를 1세트로 설명", "팀 협업 경계와 본인 결정 지점을 분리"],
          modelAnswer:
            "저는 요구사항 정의, 워크플로우 설계, 구현 우선순위 결정까지 맡았습니다.\n이후 백엔드 체인 구조와 프론트 결과 화면을 직접 연결해 사용자 흐름을 완성했습니다.\n결과적으로 분석-보완-문서-면접 단계가 한 화면에서 재실행 가능해졌고, 반복 개선이 쉬워졌습니다.\n팀 작업에서는 설계 기준과 역할 경계를 먼저 정리해 충돌을 줄였습니다.",
          caution: "개인 기여를 팀 전체 성과처럼 과장하지 마세요."
        },
        {
          section: "core",
          question: "핵심 기술 선택(스택/아키텍처)의 판단 기준과 트레이드오프는 무엇이었나요?",
          whyAsked: "JD의 기술 의사결정 역량 항목과 포트폴리오 기술 선택 근거를 연결하기 위한 질문입니다.",
          answerPoints: ["대안 2개 이상과 선택 이유", "성능/개발속도/운영비용 중 무엇을 우선했는지"],
          modelAnswer:
            "빠른 MVP 검증이 목표라서 Next.js + NestJS + Prisma 조합을 선택했습니다.\n프론트/백 타입 일관성과 유지보수를 위해 TypeScript를 기본으로 가져갔습니다.\n초기에는 기능 완성 속도를 우선했고, 이후 단계에서 로그 추적과 재실행 안정성을 보강했습니다.\n즉, 단기 속도와 장기 운영성을 단계적으로 맞추는 전략을 택했습니다.",
          caution: "RAG/Agent/대규모 운영을 실제 수행하지 않았다면 단정적으로 말하지 마세요."
        },
        {
          section: "core",
          question: "요구사항 변경 시 우선순위를 어떻게 재조정했고 결과를 어떻게 검증했나요?",
          whyAsked: "JD의 실행력/문제해결 역량을 실전 사례로 확인하기 위한 질문입니다.",
          answerPoints: ["변경 전후 계획 차이", "검증 지표 또는 테스트 방식", "결과와 다음 개선점"],
          modelAnswer:
            "초기에는 기능 구현이 우선이었지만, 운영 중에는 사용자 체감 문제가 큰 항목부터 재정렬했습니다.\n예를 들어 문서 가독성/면접 리포트 구조/단계 독립성 이슈를 우선순위 상단으로 올렸습니다.\n변경 후에는 실제 화면 결과와 단계별 로그를 기준으로 동작을 확인했습니다.\n이 방식으로 기능 추가보다 사용성 개선 효과가 큰 작업을 먼저 처리했습니다.",
          caution: "정량 수치가 없으면 추정치로 포장하지 말고 관찰 근거 중심으로 답변하세요."
        },
        {
          section: "deep",
          question: "예상과 달랐던 실패 사례와 이후 개선 조치를 설명해 주세요.",
          whyAsked: "약한 근거 영역의 리스크 대응 역량을 확인하기 위해 생성되었습니다.",
          answerPoints: ["문제 상황", "원인 분석", "재발 방지 조치"],
          modelAnswer:
            "문서 생성 단계에서 모델 응답이 문자열이 아닌 객체/배열로 내려와 fallback이 반복된 적이 있었습니다.\n원인은 파서 스키마가 문자열만 허용하던 부분이었습니다.\n응답 정규화 로직을 추가해 객체/배열/JSON 문자열도 읽을 수 있는 텍스트로 변환하도록 수정했습니다.\n이후 같은 유형의 실패가 줄고, 사용자 화면 품질도 함께 개선됐습니다.",
          caution: "원인 없는 성공담 위주 답변은 신뢰도를 떨어뜨릴 수 있습니다."
        },
        {
          section: "deep",
          question: "이 직무(JD) 기준으로 본인 경험을 어떤 순서로 매핑해 설명하시겠습니까?",
          whyAsked: "서류의 핵심 강점과 JD 요구사항의 정합도를 면접 답변으로 연결하기 위한 질문입니다.",
          answerPoints: ["JD 핵심 요구 2~3개 선정", "요구별 대응 경험 1개씩 배치", "근거 부족 항목은 보완 계획 제시"],
          modelAnswer:
            "먼저 JD의 핵심 요구를 비정형 데이터 구조화, 내부도구 자동화, 제품 실행력으로 정리합니다.\n다음으로 CareerFlow AI에서 단계형 워크플로우 설계와 모델 라우팅 운영 경험을 대응시킵니다.\nPM 경험은 요구사항 구조화와 우선순위 결정 역량으로 연결해 설명합니다.\n근거가 약한 항목은 현재 수준과 보완 계획을 분리해서 솔직하게 답변합니다."
        }
      ];
    }
    try {
      const result = await runInterviewQuestionsChain(llm, candidate, job, prioritizedProjectContext, gapAnalysis);
      this.markExecution(step, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return result;
    } catch (error) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: error instanceof Error ? error.message : "unknown_error",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return [
        {
          section: "core",
          question: "강조 프로젝트에서 본인의 역할과 기여 범위를 어떻게 나눠 설명하시겠습니까?",
          whyAsked: "JD의 책임 범위 검증과 프로젝트 실제 기여도 확인을 위해 생성되었습니다.",
          answerPoints: ["요구사항-담당 범위-결과를 1세트로 설명", "팀 협업 경계와 본인 결정 지점을 분리"],
          modelAnswer:
            "저는 요구사항 정의, 워크플로우 설계, 구현 우선순위 결정까지 맡았습니다.\n이후 백엔드 체인 구조와 프론트 결과 화면을 직접 연결해 사용자 흐름을 완성했습니다.\n결과적으로 분석-보완-문서-면접 단계가 한 화면에서 재실행 가능해졌고, 반복 개선이 쉬워졌습니다.\n팀 작업에서는 설계 기준과 역할 경계를 먼저 정리해 충돌을 줄였습니다.",
          caution: "개인 기여를 팀 전체 성과처럼 과장하지 마세요."
        },
        {
          section: "core",
          question: "핵심 기술 선택(스택/아키텍처)의 판단 기준과 트레이드오프는 무엇이었나요?",
          whyAsked: "JD의 기술 의사결정 역량 항목과 포트폴리오 기술 선택 근거를 연결하기 위한 질문입니다.",
          answerPoints: ["대안 2개 이상과 선택 이유", "성능/개발속도/운영비용 중 무엇을 우선했는지"],
          modelAnswer:
            "빠른 MVP 검증이 목표라서 Next.js + NestJS + Prisma 조합을 선택했습니다.\n프론트/백 타입 일관성과 유지보수를 위해 TypeScript를 기본으로 가져갔습니다.\n초기에는 기능 완성 속도를 우선했고, 이후 단계에서 로그 추적과 재실행 안정성을 보강했습니다.\n즉, 단기 속도와 장기 운영성을 단계적으로 맞추는 전략을 택했습니다.",
          caution: "RAG/Agent/대규모 운영을 실제 수행하지 않았다면 단정적으로 말하지 마세요."
        },
        {
          section: "core",
          question: "요구사항 변경 시 우선순위를 어떻게 재조정했고 결과를 어떻게 검증했나요?",
          whyAsked: "JD의 실행력/문제해결 역량을 실전 사례로 확인하기 위한 질문입니다.",
          answerPoints: ["변경 전후 계획 차이", "검증 지표 또는 테스트 방식", "결과와 다음 개선점"],
          modelAnswer:
            "초기에는 기능 구현이 우선이었지만, 운영 중에는 사용자 체감 문제가 큰 항목부터 재정렬했습니다.\n예를 들어 문서 가독성/면접 리포트 구조/단계 독립성 이슈를 우선순위 상단으로 올렸습니다.\n변경 후에는 실제 화면 결과와 단계별 로그를 기준으로 동작을 확인했습니다.\n이 방식으로 기능 추가보다 사용성 개선 효과가 큰 작업을 먼저 처리했습니다.",
          caution: "정량 수치가 없으면 추정치로 포장하지 말고 관찰 근거 중심으로 답변하세요."
        },
        {
          section: "deep",
          question: "예상과 달랐던 실패 사례와 이후 개선 조치를 설명해 주세요.",
          whyAsked: "약한 근거 영역의 리스크 대응 역량을 확인하기 위해 생성되었습니다.",
          answerPoints: ["문제 상황", "원인 분석", "재발 방지 조치"],
          modelAnswer:
            "문서 생성 단계에서 모델 응답이 문자열이 아닌 객체/배열로 내려와 fallback이 반복된 적이 있었습니다.\n원인은 파서 스키마가 문자열만 허용하던 부분이었습니다.\n응답 정규화 로직을 추가해 객체/배열/JSON 문자열도 읽을 수 있는 텍스트로 변환하도록 수정했습니다.\n이후 같은 유형의 실패가 줄고, 사용자 화면 품질도 함께 개선됐습니다.",
          caution: "원인 없는 성공담 위주 답변은 신뢰도를 떨어뜨릴 수 있습니다."
        },
        {
          section: "deep",
          question: "이 직무(JD) 기준으로 본인 경험을 어떤 순서로 매핑해 설명하시겠습니까?",
          whyAsked: "서류의 핵심 강점과 JD 요구사항의 정합도를 면접 답변으로 연결하기 위한 질문입니다.",
          answerPoints: ["JD 핵심 요구 2~3개 선정", "요구별 대응 경험 1개씩 배치", "근거 부족 항목은 보완 계획 제시"],
          modelAnswer:
            "먼저 JD의 핵심 요구를 비정형 데이터 구조화, 내부도구 자동화, 제품 실행력으로 정리합니다.\n다음으로 CareerFlow AI에서 단계형 워크플로우 설계와 모델 라우팅 운영 경험을 대응시킵니다.\nPM 경험은 요구사항 구조화와 우선순위 결정 역량으로 연결해 설명합니다.\n근거가 약한 항목은 현재 수준과 보완 계획을 분리해서 솔직하게 답변합니다."
        }
      ];
    }
  }

  async rewriteForTargetJob(
    draft: GeneratedDraft,
    job: JobPostingProfile,
    prioritizedProjectContext?: string
  ): Promise<RewriteDraft> {
    const step: WorkflowStep = "rewriteForTargetJob";
    const llm = this.getModelRouter(this.routeOf(step));
    if (!llm) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: "missing_api_key_or_provider_unavailable",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        coverLetter: `${draft.coverLetter}\n\n[JD 맞춤 리라이트 적용]`,
        careerDescription: `${draft.careerDescription}\n\n[JD 맞춤 리라이트 적용]`,
        projectIntro: `${draft.projectIntro}\n\n[JD 맞춤 리라이트 적용]`
      };
    }
    try {
      const result = await runRewriteTailoringChain(llm, draft, job, prioritizedProjectContext);
      this.markExecution(step, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return result;
    } catch (error) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: error instanceof Error ? error.message : "unknown_error",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        coverLetter: `${draft.coverLetter}\n\n[JD 맞춤 리라이트 적용]`,
        careerDescription: `${draft.careerDescription}\n\n[JD 맞춤 리라이트 적용]`,
        projectIntro: `${draft.projectIntro}\n\n[JD 맞춤 리라이트 적용]`
      };
    }
  }
}
