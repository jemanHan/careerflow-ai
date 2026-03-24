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
import { CandidateProfile, GapAnalysis, GeneratedDraft, JobPostingProfile, RewriteDraft } from "./workflow.types";

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
      this.defaultModel =
        this.configService.get<string>("GEMINI_DEFAULT_MODEL") ??
        parsedDotenv.GEMINI_DEFAULT_MODEL ??
        "gemini-2.5-flash-lite";
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
        temperature: this.temperature
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
      temperature: this.temperature
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
        "배포/운영 경험을 보여줄 수 있는 실제 사례를 알려주세요.",
        "성과를 정량화할 수 있는 수치(시간 절감, 비용 절감)가 있나요?",
        "기술 스택 선택에서 본인이 주도적으로 결정한 사례가 있나요?",
        "문서화 또는 협업 프로세스를 개선한 경험이 있나요?",
        "배포 이후 개선한 사용자 피드백 사례가 있나요?"
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
        "배포/운영 경험을 보여줄 수 있는 실제 사례를 알려주세요.",
        "성과를 정량화할 수 있는 수치(시간 절감, 비용 절감)가 있나요?",
        "기술 스택 선택에서 본인이 주도적으로 결정한 사례가 있나요?",
        "문서화 또는 협업 프로세스를 개선한 경험이 있나요?",
        "배포 이후 개선한 사용자 피드백 사례가 있나요?"
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
    prioritizedProjectContext?: string
  ): Promise<string[]> {
    const step: WorkflowStep = "generateInterviewQuestions";
    const llm = this.getModelRouter(this.routeOf(step));
    if (!llm) {
      this.markExecution(step, {
        fallbackUsed: true,
        fallbackReason: "missing_api_key_or_provider_unavailable",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return [
        "이 프로젝트에서 문제를 정의하고 해결한 방식을 설명해 주세요.",
        "LLM 워크플로우를 단일 프롬프트가 아닌 체인으로 분리한 이유는 무엇인가요?"
      ];
    }
    try {
      const result = await runInterviewQuestionsChain(llm, candidate, job, prioritizedProjectContext);
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
        "이 프로젝트에서 문제를 정의하고 해결한 방식을 설명해 주세요.",
        "LLM 워크플로우를 단일 프롬프트가 아닌 체인으로 분리한 이유는 무엇인가요?"
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
