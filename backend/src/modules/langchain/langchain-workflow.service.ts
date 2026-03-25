import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { finalizeGapAnalysis } from "../../common/fit-analysis.util";
import { localizeGapAnalysisForDisplay, normalizeForStorage } from "../../common/signal-display.util";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
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

export type FitAnalysisRoutingContext = {
  /**
   * true: 공고 대비 분석 파이프라인(후보·JD·갭·후속질문 4단계)에서 `GEMINI_PREMIUM_MODEL` 사용.
   * 재실행·force 포함, 매 분석 실행마다 동일하게 적용(미설정 시 premium 경로 비활성).
   */
  usePremiumFitPass?: boolean;
};

type RouteKind = "light" | "quality" | "premium";
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

const SIMPLE_STOPWORDS = new Set([
  "채용",
  "채용합니다",
  "지원",
  "모집",
  "주요",
  "업무",
  "자격",
  "요건",
  "우대",
  "사항",
  "그리고",
  "또한"
]);

const GENERIC_SIGNAL_TOKENS = new Set([
  "ai",
  "데이터",
  "실제",
  "product",
  "engineer"
]);

const STRONG_SINGLE_TOKENS = new Set([
  "typescript",
  "javascript",
  "nestjs",
  "react",
  "nextjs",
  "postgresql",
  "prisma",
  "aws",
  "docker",
  "kubernetes",
  "langchain",
  "python",
  "sql",
  "figma",
  "ga4",
  "seo",
  "rbac",
  "oauth2"
]);

function cleanLineSignal(value: string): string {
  return value.replace(/^[\-\*\u2022\d\.\)\s]+/, "").replace(/\s+/g, " ").trim();
}

function toActionableSignal(value: string): string {
  const v = cleanLineSignal(value);
  if (/문제를?\s*구조화/i.test(v)) return "문제 구조화 역량";
  if (/기획.*개발|end-?to-?end/i.test(v)) return "엔드투엔드 실행 경험";
  if (/우선순위/i.test(v)) return "우선순위 결정 역량";
  if (/협업|커뮤니케이션/i.test(v)) return "협업 조율 경험";
  if (v.length <= 240) return v;
  return normalizeForStorage(v, 240);
}

function isUiSafeSignalPhrase(value: string): boolean {
  const normalized = toActionableSignal(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  if (normalized.length < 3) return false;
  if (normalized.length > 200) return false;
  if (SIMPLE_STOPWORDS.has(normalized)) return false;
  if (GENERIC_SIGNAL_TOKENS.has(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  // 단일 토큰은 강한 기술 신호일 때만 허용
  if (!normalized.includes(" ") && !STRONG_SINGLE_TOKENS.has(normalized)) return false;
  // 조사/연결어로 끝나는 약한 신호 제거
  if (/(으로|로|와|과|및|또는|등|해|한)$/.test(normalized)) return false;
  return true;
}

function sanitizeSignalsForUi(values: string[], limit: number): string[] {
  return values
    .map((v) => toActionableSignal(v))
    .filter((v) => v.length > 0)
    .filter((v) => isUiSafeSignalPhrase(v))
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .slice(0, limit);
}

function splitLineLevelPhrases(line: string): string[] {
  const cleaned = cleanLineSignal(line);
  if (!cleaned) return [];
  if (cleaned.length <= 120) return [cleaned];
  return cleaned
    .split(/[,;]|\.|。| 및 | 또는 | 그리고 |·/g)
    .map((part) => cleanLineSignal(part))
    .filter((part) => part.length >= 4 && part.length <= 200);
}

function extractFallbackCandidateSignals(inputText: string, limit = 6): string[] {
  const normalized = inputText
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ");
  const dictionary = [
    "typescript",
    "javascript",
    "nestjs",
    "react",
    "next.js",
    "nextjs",
    "postgresql",
    "prisma",
    "aws",
    "docker",
    "kubernetes",
    "langchain",
    "oauth2",
    "rbac",
    "figma",
    "ga4",
    "seo",
    "python",
    "sql"
  ];
  const fromDictionary = dictionary.filter((word) => normalized.includes(word));
  const projectLikeLines = inputText
    .split(/\r?\n/)
    .map((line) => cleanLineSignal(line))
    .filter((line) => line.length >= 5 && line.length <= 50)
    .filter((line) => /프로젝트|project|대시보드|플랫폼|워크플로우|캠페인|리디자인|자동화/i.test(line))
    .slice(0, 4);
  return sanitizeSignalsForUi([...fromDictionary, ...projectLikeLines], limit);
}

function extractFallbackJobSignals(jobText: string): Pick<JobPostingProfile, "requiredSkills" | "preferredSkills" | "responsibilities" | "evaluationSignals"> {
  const lines = jobText.split(/\r?\n/).map((line) => line.trim());
  let section: "required" | "preferred" | "responsibility" | "none" = "none";
  const required: string[] = [];
  const preferred: string[] = [];
  const responsibilities: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    const lower = line.toLowerCase();
    if (line.includes("자격 요건") || lower.includes("requirements")) {
      section = "required";
      continue;
    }
    if (line.includes("우대 사항") || lower.includes("preferred qualifications")) {
      section = "preferred";
      continue;
    }
    if (line.includes("주요 업무") || lower.includes("responsibilities")) {
      section = "responsibility";
      continue;
    }

    const isBulletLike = /^[-*\u2022]/.test(line);
    // 섹션 내부 문장형 라인도 허용하되, 길이 제한으로 과한 문단은 제외
    if (!isBulletLike && section === "none") continue;
    const phrases = splitLineLevelPhrases(line).filter((p) => isUiSafeSignalPhrase(p));
    if (phrases.length === 0) continue;
    if (section === "required") required.push(...phrases);
    else if (section === "preferred") preferred.push(...phrases);
    else responsibilities.push(...phrases);
  }

  const uniq = (arr: string[]) => arr.filter((v, i, a) => a.indexOf(v) === i);
  let requiredSkills = sanitizeSignalsForUi(uniq(required), 6);
  let preferredSkills = sanitizeSignalsForUi(uniq(preferred), 6);
  let responsibilitySignals = sanitizeSignalsForUi(uniq(responsibilities), 6);
  let evaluationSignals = sanitizeSignalsForUi([...requiredSkills.slice(0, 3), ...responsibilitySignals.slice(0, 3)], 6);

  if (requiredSkills.length === 0 && preferredSkills.length === 0 && responsibilitySignals.length === 0) {
    const fallbackLines = jobText
      .split(/\r?\n/)
      .map((line) => cleanLineSignal(line))
      .filter((line) => line.length >= 6 && line.length <= 120)
      .flatMap((line) => splitLineLevelPhrases(line))
      .filter((line) => isUiSafeSignalPhrase(line));
    requiredSkills = sanitizeSignalsForUi(fallbackLines.slice(0, 6), 6);
    responsibilitySignals = sanitizeSignalsForUi(fallbackLines.slice(2, 8), 6);
    evaluationSignals = sanitizeSignalsForUi([...requiredSkills.slice(0, 3), ...responsibilitySignals.slice(0, 3)], 6);
  }

  return {
    requiredSkills,
    preferredSkills,
    responsibilities: responsibilitySignals,
    evaluationSignals
  };
}

function pickTopSignals(job: JobPostingProfile, gap?: GapAnalysis, limit = 3): string[] {
  const merged = [
    ...(job.requiredSkills ?? []),
    ...(job.responsibilities ?? []),
    ...(job.evaluationSignals ?? []),
    ...(gap?.missingSignals ?? []),
    ...(gap?.weakEvidence ?? [])
  ]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v && v.length >= 2))
    .filter((v, idx, arr) => arr.indexOf(v) === idx);
  return merged.slice(0, limit);
}

/** 부족·약한 신호 개수에 맞춰 보완 질문 수(갭이 없을 때만 기본 3개). 상한 15. */
function computeFollowUpQuestionTargetCount(gap: GapAnalysis): number {
  const m = (gap.missingSignals ?? []).filter((s) => String(s ?? "").trim().length > 0).length;
  const w = (gap.weakEvidence ?? []).filter((s) => String(s ?? "").trim().length > 0).length;
  const n = m + w;
  if (n === 0) return 3;
  return Math.min(15, n);
}

function buildFallbackFollowUpQuestions(gap: GapAnalysis, targetCount: number): string[] {
  const missing = sanitizeSignalsForUi(gap.missingSignals ?? [], 12);
  const weak = sanitizeSignalsForUi(gap.weakEvidence ?? [], 12);
  const out: string[] = [];

  for (const signal of missing) {
    if (out.length >= targetCount) break;
    out.push(
      `공고의「${signal}」요구에 대해 직접 경험이 있나요? 있으면 본인 역할·방법·결과를 한 줄로, 없으면 인접 경험이 있다면 범위만 구분해 짧게 적어 주세요.`
    );
  }
  for (const signal of weak) {
    if (out.length >= targetCount) break;
    out.push(
      `「${signal}」는 언급은 있으나 근거가 약합니다. 역할·산출물·검증 방법·수치 중 보강할 수 있는 것을 한 줄로 적어 주세요.`
    );
  }

  const fillers = [
    "이 직무 공고의 핵심 요구 중 본인 경험과 가장 잘 맞는 한 가지를 고르고, 있으면 사례를 한 줄로, 없으면 인접 경험의 범위를 구분해 적어 주세요.",
    "공고에서 반복되는 요구 키워드 중 본인이 실제로 수행해 본 것이 있나요? 있으면 역할·기간을, 없으면 관련 교육·부분 참여만 짧게 적어 주세요.",
    "지원 직무와 직접 연결되는 성과나 산출물이 있다면 한 줄로 적고, 없다면 보완 계획을 한 줄로만 적어 주세요."
  ];
  let fillerIdx = 0;
  while (out.length < targetCount) {
    out.push(fillers[fillerIdx % fillers.length]!);
    fillerIdx += 1;
  }
  return dedupeFollowUpQuestions(out).slice(0, targetCount);
}

function mergeFollowUpToTarget(llmQuestions: string[], gap: GapAnalysis, target: number): string[] {
  const fb = buildFallbackFollowUpQuestions(gap, target);
  return dedupeFollowUpQuestions([...llmQuestions, ...fb]).slice(0, target);
}

function normalizeFollowUpKey(q: string): string {
  return q
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[「」"'“”]/g, "")
    .slice(0, 80);
}

function dedupeFollowUpQuestions(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of items) {
    const k = normalizeFollowUpKey(q);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(q);
  }
  return out;
}

function buildFallbackInterviewReport(
  candidate: CandidateProfile,
  job: JobPostingProfile,
  gap?: GapAnalysis
): InterviewReportItem[] {
  const signals = pickTopSignals(job, gap, 3);
  const s1 = signals[0] ?? "핵심 요구사항";
  const s2 = signals[1] ?? "협업/실행 경험";
  const s3 = signals[2] ?? "성과 근거";

  return [
    {
      section: "core",
      question: `이 직무에서 "${s1}"을 수행한 실제 사례를 설명해 주세요.`,
      whyAsked: "JD 핵심 요구와 제출 서류의 실제 수행 근거를 연결하기 위한 질문입니다.",
      answerPoints: ["상황", "본인 역할", "실행 결과"],
      modelAnswer:
        "유사한 요구가 있었던 프로젝트에서 문제를 정의하고 실행 범위를 정리했습니다.\n제가 담당한 역할과 결정 기준을 명확히 구분해 설명할 수 있습니다.\n실행 후에는 결과를 지표 또는 사용자 반응으로 확인했습니다.",
      caution: "팀 성과를 개인 성과로 과장하지 말고 본인 기여를 분리해 설명하세요."
    },
    {
      section: "core",
      question: `"${s2}" 관련 협업/의사결정에서 본인이 맡은 책임은 무엇이었나요?`,
      whyAsked: "협업 구조와 책임 범위를 확인해 실행 신뢰도를 검증하기 위한 질문입니다.",
      answerPoints: ["협업 대상", "의사결정 기준", "충돌 조정 방식"],
      modelAnswer:
        "협업 파트너와 목표를 먼저 정렬하고, 우선순위를 합의한 뒤 실행했습니다.\n이슈가 생기면 대안 비교와 영향도를 기준으로 의사결정을 내렸습니다.\n결과와 회고를 문서화해 다음 작업에 반영했습니다.",
      caution: "결과만 말하지 말고 판단 근거와 책임 범위를 함께 설명하세요."
    },
    {
      section: "core",
      question: `"${s3}"를 뒷받침할 수 있는 성과 근거를 어떻게 제시하시겠습니까?`,
      whyAsked: "주장 대비 증빙 수준을 확인해 면접 신뢰도를 높이기 위한 질문입니다.",
      answerPoints: ["정량/정성 근거", "비교 기준", "한계와 보완점"],
      modelAnswer:
        "가능한 범위에서 수치 또는 전후 비교 근거를 제시합니다.\n정량 지표가 없으면 사용자 반응, 운영 개선 등 정성 근거를 명확히 제시합니다.\n부족한 부분은 현재 수준과 보완 계획을 구분해 설명합니다.",
      caution: "근거가 불충분하면 단정하지 말고 확인 가능한 사실 중심으로 답변하세요."
    },
    {
      section: "deep",
      question: `이 직무의 "${s1}" 요구를 기준으로, 실패/한계 상황에서 어떻게 대응했는지 말해 주세요.`,
      whyAsked: "리스크 대응과 재발 방지 관점을 확인하기 위한 심화 질문입니다.",
      answerPoints: ["문제 원인", "대응 조치", "재발 방지"],
      modelAnswer:
        "실패 상황을 숨기지 않고 원인을 구조적으로 분해해 설명합니다.\n즉시 조치와 근본 개선을 분리해 실행하고, 재발 방지 기준을 문서화했습니다.\n이후 동일 유형 이슈 발생 빈도를 줄이는 데 집중했습니다."
    },
    {
      section: "deep",
      question: `현재 경력에서 "${s2}"와 관련해 보강이 필요한 부분은 무엇이고, 어떻게 보완할 계획인가요?`,
      whyAsked: "과장 없이 자기 인식과 성장 계획을 설명할 수 있는지 확인하기 위한 질문입니다.",
      answerPoints: ["현재 수준", "보완 계획", "실행 일정"],
      modelAnswer:
        "현재 수준을 과장하지 않고, 부족한 근거를 먼저 인정합니다.\n보완할 활동과 산출물을 구체적으로 정리해 실행 계획을 제시합니다.\n면접에서는 완료된 경험과 진행 중 계획을 명확히 구분해 설명합니다.",
      caution: "지원 직무와 무관한 일반론만 말하면 설득력이 떨어질 수 있습니다."
    }
  ];
}

@Injectable()
export class LangchainWorkflowService {
  private readonly logger = new Logger(LangchainWorkflowService.name);
  private readonly provider: "gemini" | "openai";
  private readonly geminiApiKey?: string;
  private readonly openaiApiKey?: string;
  private readonly defaultModel: string;
  private readonly highQualityModel: string;
  /** 최초 공고 대비 분석 4단계 전용(미설정 시 premium 경로 비활성 → quality와 동일) */
  private readonly geminiPremiumModel: string;
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
    const rawProvider = this.readNonEmpty(
      this.configService.get<string>("LLM_PROVIDER"),
      process.env.LLM_PROVIDER
    )?.toLowerCase();
    this.geminiApiKey = this.readNonEmpty(
      this.configService.get<string>("GEMINI_API_KEY"),
      process.env.GEMINI_API_KEY,
      this.configService.get<string>("GOOGLE_API_KEY"),
      process.env.GOOGLE_API_KEY
    );
    this.openaiApiKey = this.readNonEmpty(
      this.configService.get<string>("OPENAI_API_KEY"),
      process.env.OPENAI_API_KEY
    );
    this.provider = rawProvider === "openai" ? "openai" : "gemini";
    if (this.provider === "gemini") {
      // 역할 기반 라우팅: 경량(기본) vs 고품질은 별도 모델·별도 쿼터. 한 모델로 합치지 않음.
      this.defaultModel =
        this.configService.get<string>("GEMINI_DEFAULT_MODEL") ??
        process.env.GEMINI_DEFAULT_MODEL ??
        "gemini-2.5-flash-lite";
      this.highQualityModel =
        this.configService.get<string>("GEMINI_HIGH_QUALITY_MODEL") ??
        process.env.GEMINI_HIGH_QUALITY_MODEL ??
        "gemini-2.5-flash";
      this.geminiPremiumModel =
        this.configService.get<string>("GEMINI_PREMIUM_MODEL")?.trim() ??
        process.env.GEMINI_PREMIUM_MODEL?.trim() ??
        "";
    } else {
      this.defaultModel =
        this.configService.get<string>("OPENAI_MODEL") ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
      this.highQualityModel =
        this.configService.get<string>("OPENAI_HIGH_QUALITY_MODEL") ??
        process.env.OPENAI_HIGH_QUALITY_MODEL ??
        this.defaultModel;
      this.geminiPremiumModel = "";
    }
    this.temperature = Number(
      this.configService.get<string>("LLM_TEMPERATURE") ??
        process.env.LLM_TEMPERATURE ??
        this.configService.get<string>("OPENAI_TEMPERATURE") ??
        process.env.OPENAI_TEMPERATURE ??
        "0.2"
    );
    this.logger.log(
      `LLM config loaded: provider=${this.provider}, geminiKeyPresent=${Boolean(this.geminiApiKey)}, openaiKeyPresent=${Boolean(this.openaiApiKey)}, defaultModel=${this.defaultModel}, highQualityModel=${this.highQualityModel}, premiumModelConfigured=${this.provider === "gemini" ? Boolean(this.geminiPremiumModel) : false}`
    );
  }

  /**
   * Gemini: 공고 대비 분석 4단계는 optional premium(또는 light), 문서·면접은 quality, 리라이트는 light(보조).
   * OpenAI: 문서·면접만 high, 나머지 light (premium 미사용).
   */
  resolveRouting(step: WorkflowStep, ctx?: FitAnalysisRoutingContext): RoutingInfo {
    if (this.provider === "openai") {
      if (step === "generateDocuments" || step === "generateInterviewQuestions") {
        return { provider: "openai", route: "quality", model: this.highQualityModel };
      }
      return { provider: "openai", route: "light", model: this.defaultModel };
    }

    const fitPipelineSteps: WorkflowStep[] = [
      "extractCandidateProfile",
      "extractJobPosting",
      "detectGaps",
      "generateFollowUpQuestions"
    ];
    const usePremium =
      Boolean(ctx?.usePremiumFitPass) &&
      this.geminiPremiumModel.length > 0 &&
      fitPipelineSteps.includes(step);

    if (usePremium) {
      return { provider: "gemini", route: "premium", model: this.geminiPremiumModel };
    }

    if (step === "generateDocuments" || step === "generateInterviewQuestions") {
      return { provider: "gemini", route: "quality", model: this.highQualityModel };
    }

    if (step === "rewriteForTargetJob") {
      return { provider: "gemini", route: "light", model: this.defaultModel };
    }

    if (fitPipelineSteps.includes(step)) {
      return { provider: "gemini", route: "light", model: this.defaultModel };
    }

    return { provider: "gemini", route: "light", model: this.defaultModel };
  }

  getRoutingInfo(step: WorkflowStep, ctx?: FitAnalysisRoutingContext): RoutingInfo {
    return this.resolveRouting(step, ctx);
  }

  getExecutionDiagnostics(step: WorkflowStep, ctx?: FitAnalysisRoutingContext): ExecutionDiagnostics {
    const cached = this.lastExecutionByStep.get(step);
    if (cached) {
      return cached;
    }
    const route = this.resolveRouting(step, ctx);
    return {
      ...route,
      fallbackUsed: false,
      hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
    };
  }

  private markExecution(
    step: WorkflowStep,
    routing: RoutingInfo,
    data: Omit<ExecutionDiagnostics, "provider" | "route" | "model">
  ): void {
    const payload: ExecutionDiagnostics = {
      ...routing,
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

  private getLlmForModel(modelName: string): BaseChatModel | undefined {
    const key = `${this.provider}:${modelName}`;
    const existing = this.llmByModel.get(key);
    if (existing) {
      return existing;
    }

    if (this.provider === "gemini") {
      if (!this.geminiApiKey) {
        return undefined;
      }
      const created = new ChatGoogleGenerativeAI({
        apiKey: this.geminiApiKey,
        model: modelName,
        temperature: this.temperature,
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
    prioritizedProjectContext?: string,
    ctx?: FitAnalysisRoutingContext
  ): Promise<CandidateProfile> {
    const step: WorkflowStep = "extractCandidateProfile";
    const routing = this.resolveRouting(step, ctx);
    const llm = this.getLlmForModel(routing.model);
    if (!llm) {
      const fallbackStrengths = extractFallbackCandidateSignals(inputText, 6);
      this.markExecution(step, routing, {
        fallbackUsed: true,
        fallbackReason: "missing_api_key_or_provider_unavailable",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        summary: "LLM API 키 미설정 상태의 기본 프로필",
        strengths: fallbackStrengths,
        experiences: [],
        projects: []
      };
    }
    try {
      const result = await runCandidateProfileChain(llm, inputText, prioritizedProjectContext);
      this.markExecution(step, routing, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return result;
    } catch (error) {
      const fallbackStrengths = extractFallbackCandidateSignals(inputText, 6);
      this.markExecution(step, routing, {
        fallbackUsed: true,
        fallbackReason: error instanceof Error ? error.message : "unknown_error",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        summary: "LLM 호출 실패 시 기본 프로필",
        strengths: fallbackStrengths,
        experiences: [],
        projects: []
      };
    }
  }

  async extractJobPosting(jobText: string, ctx?: FitAnalysisRoutingContext): Promise<JobPostingProfile> {
    const step: WorkflowStep = "extractJobPosting";
    const routing = this.resolveRouting(step, ctx);
    const llm = this.getLlmForModel(routing.model);
    if (!llm) {
      const parsed = extractFallbackJobSignals(jobText);
      this.markExecution(step, routing, {
        fallbackUsed: true,
        fallbackReason: "missing_api_key_or_provider_unavailable",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        role: "미분류 직무",
        summary: "JD 파싱 fallback 결과",
        requiredSkills: parsed.requiredSkills,
        preferredSkills: parsed.preferredSkills,
        responsibilities: parsed.responsibilities,
        evaluationSignals: parsed.evaluationSignals,
        domainSignals: [],
        collaborationSignals: [],
        toolSignals: [],
        senioritySignals: [],
        outputExpectations: []
      };
    }
    try {
      const result = await runJobPostingChain(llm, jobText);
      this.markExecution(step, routing, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return result;
    } catch (error) {
      const parsed = extractFallbackJobSignals(jobText);
      this.markExecution(step, routing, {
        fallbackUsed: true,
        fallbackReason: error instanceof Error ? error.message : "unknown_error",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return {
        role: "미분류 직무",
        summary: "JD 파싱 fallback 결과",
        requiredSkills: parsed.requiredSkills,
        preferredSkills: parsed.preferredSkills,
        responsibilities: parsed.responsibilities,
        evaluationSignals: parsed.evaluationSignals,
        domainSignals: [],
        collaborationSignals: [],
        toolSignals: [],
        senioritySignals: [],
        outputExpectations: []
      };
    }
  }

  async detectGaps(
    candidate: CandidateProfile,
    job: JobPostingProfile,
    ctx?: FitAnalysisRoutingContext,
    rawApplicationText?: string
  ): Promise<GapAnalysis> {
    const step: WorkflowStep = "detectGaps";
    const routing = this.resolveRouting(step, ctx);
    const llm = this.getLlmForModel(routing.model);
    if (!llm) {
      this.markExecution(step, routing, {
        fallbackUsed: true,
        fallbackReason: "missing_api_key_or_provider_unavailable",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return localizeGapAnalysisForDisplay(
        finalizeGapAnalysis(
          {
            matchedSignals: [],
            missingSignals: sanitizeSignalsForUi(job.requiredSkills ?? [], 10),
            weakEvidence: sanitizeSignalsForUi(
              [...(job.evaluationSignals ?? []), ...(job.preferredSkills ?? [])],
              10
            )
          },
          candidate,
          rawApplicationText,
          job
        )
      );
    }
    try {
      const result = await runGapDetectionChain(llm, candidate, job);
      const safeResult: GapAnalysis = finalizeGapAnalysis(
        {
          matchedSignals: sanitizeSignalsForUi(result.matchedSignals ?? [], 10),
          missingSignals: sanitizeSignalsForUi(result.missingSignals ?? [], 10),
          weakEvidence: sanitizeSignalsForUi(result.weakEvidence ?? [], 10)
        },
        candidate,
        rawApplicationText,
        job
      );
      this.markExecution(step, routing, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return localizeGapAnalysisForDisplay(safeResult);
    } catch (error) {
      this.markExecution(step, routing, {
        fallbackUsed: true,
        fallbackReason: error instanceof Error ? error.message : "unknown_error",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return localizeGapAnalysisForDisplay(
        finalizeGapAnalysis(
          {
            matchedSignals: [],
            missingSignals: sanitizeSignalsForUi(job.requiredSkills ?? [], 10),
            weakEvidence: sanitizeSignalsForUi(
              [...(job.evaluationSignals ?? []), ...(job.preferredSkills ?? [])],
              10
            )
          },
          candidate,
          rawApplicationText,
          job
        )
      );
    }
  }

  async generateFollowUpQuestions(gap: GapAnalysis, ctx?: FitAnalysisRoutingContext): Promise<string[]> {
    const step: WorkflowStep = "generateFollowUpQuestions";
    const routing = this.resolveRouting(step, ctx);
    const target = computeFollowUpQuestionTargetCount(gap);
    const llm = this.getLlmForModel(routing.model);
    if (!llm) {
      this.markExecution(step, routing, {
        fallbackUsed: true,
        fallbackReason: "missing_api_key_or_provider_unavailable",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return buildFallbackFollowUpQuestions(gap, target);
    }
    try {
      const result = await runFollowUpQuestionsChain(llm, gap, target);
      this.markExecution(step, routing, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return mergeFollowUpToTarget(result, gap, target);
    } catch (error) {
      this.markExecution(step, routing, {
        fallbackUsed: true,
        fallbackReason: error instanceof Error ? error.message : "unknown_error",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return buildFallbackFollowUpQuestions(gap, target);
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
    const routing = this.resolveRouting(step);
    const llm = this.getLlmForModel(routing.model);
    if (!llm) {
      this.markExecution(step, routing, {
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
      this.markExecution(step, routing, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return result;
    } catch (error) {
      this.markExecution(step, routing, {
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
    const routing = this.resolveRouting(step);
    const llm = this.getLlmForModel(routing.model);
    if (!llm) {
      this.markExecution(step, routing, {
        fallbackUsed: true,
        fallbackReason: "missing_api_key_or_provider_unavailable",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return buildFallbackInterviewReport(candidate, job, gapAnalysis);
    }
    try {
      const result = await runInterviewQuestionsChain(llm, candidate, job, prioritizedProjectContext, gapAnalysis);
      this.markExecution(step, routing, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return result;
    } catch (error) {
      this.markExecution(step, routing, {
        fallbackUsed: true,
        fallbackReason: error instanceof Error ? error.message : "unknown_error",
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return buildFallbackInterviewReport(candidate, job, gapAnalysis);
    }
  }

  async rewriteForTargetJob(
    draft: GeneratedDraft,
    job: JobPostingProfile,
    prioritizedProjectContext?: string
  ): Promise<RewriteDraft> {
    const step: WorkflowStep = "rewriteForTargetJob";
    const routing = this.resolveRouting(step);
    const llm = this.getLlmForModel(routing.model);
    if (!llm) {
      this.markExecution(step, routing, {
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
      this.markExecution(step, routing, {
        fallbackUsed: false,
        hasProviderApiKey: this.provider === "gemini" ? Boolean(this.geminiApiKey) : Boolean(this.openaiApiKey)
      });
      return result;
    } catch (error) {
      this.markExecution(step, routing, {
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
