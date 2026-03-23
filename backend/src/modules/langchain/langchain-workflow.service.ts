import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatOpenAI } from "@langchain/openai";
import { runCandidateProfileChain } from "./chains/candidate-profile.chain";
import { runDocumentGenerationChain } from "./chains/document-generation.chain";
import { runFollowUpQuestionsChain } from "./chains/follow-up-questions.chain";
import { runGapDetectionChain } from "./chains/gap-detection.chain";
import { runInterviewQuestionsChain } from "./chains/interview-questions.chain";
import { runJobPostingChain } from "./chains/job-posting.chain";
import { runRewriteTailoringChain } from "./chains/rewrite-tailoring.chain";
import { CandidateProfile, GapAnalysis, GeneratedDraft, JobPostingProfile, RewriteDraft } from "./workflow.types";

@Injectable()
export class LangchainWorkflowService {
  private readonly apiKey?: string;
  private readonly defaultModel: string;
  private readonly highQualityModel: string;
  private readonly temperature: number;
  private readonly llmByModel = new Map<string, ChatOpenAI>();

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("OPENAI_API_KEY")?.trim();
    this.defaultModel = this.configService.get<string>("OPENAI_MODEL") ?? "gpt-4.1-mini";
    this.highQualityModel =
      this.configService.get<string>("OPENAI_HIGH_QUALITY_MODEL") ?? this.defaultModel;
    this.temperature = Number(this.configService.get<string>("OPENAI_TEMPERATURE") ?? "0.2");
  }

  private getModelRouter(stage: "light" | "quality"): ChatOpenAI | undefined {
    if (!this.apiKey) {
      return undefined;
    }
    const modelName = stage === "quality" ? this.highQualityModel : this.defaultModel;
    const existing = this.llmByModel.get(modelName);
    if (existing) {
      return existing;
    }
    const created = new ChatOpenAI({
      apiKey: this.apiKey,
      model: modelName,
      temperature: this.temperature
    });
    this.llmByModel.set(modelName, created);
    return created;
  }

  async extractCandidateProfile(inputText: string): Promise<CandidateProfile> {
    const llm = this.getModelRouter("light");
    if (!llm) {
      return {
        summary: "OPENAI_API_KEY 미설정 상태의 기본 프로필",
        strengths: ["TypeScript", "문제 해결", "제품 중심 사고"],
        experiences: [],
        projects: []
      };
    }
    try {
      return await runCandidateProfileChain(llm, inputText);
    } catch {
      return {
        summary: "OpenAI 호출 실패 시 기본 프로필",
        strengths: ["TypeScript", "문제 해결", "제품 중심 사고"],
        experiences: [],
        projects: []
      };
    }
  }

  async extractJobPosting(jobText: string): Promise<JobPostingProfile> {
    const llm = this.getModelRouter("light");
    if (!llm) {
      return {
        role: "AI/Data Product Engineer",
        requiredSkills: ["TypeScript", "NestJS", "React", "PostgreSQL", "AWS"],
        preferredSkills: ["LangChain", "LLM Product Engineering"],
        responsibilities: ["제품 구현", "배포", "기술 의사결정"],
        evaluationSignals: ["end-to-end ownership", "practical AI problem solving"]
      };
    }
    try {
      return await runJobPostingChain(llm, jobText);
    } catch {
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
    const llm = this.getModelRouter("light");
    if (!llm) {
      return {
        matchedSignals: ["TypeScript 기반 구현 경험"],
        missingSignals: ["AWS 운영 증거", "배포 자동화 증거"],
        weakEvidence: ["정량 성과 지표 부족"]
      };
    }
    try {
      return await runGapDetectionChain(llm, candidate, job);
    } catch {
      return {
        matchedSignals: ["TypeScript 기반 구현 경험"],
        missingSignals: ["AWS 운영 증거", "배포 자동화 증거"],
        weakEvidence: ["정량 성과 지표 부족"]
      };
    }
  }

  async generateFollowUpQuestions(gap: GapAnalysis): Promise<string[]> {
    const llm = this.getModelRouter("light");
    if (!llm) {
      return [
        "배포/운영 경험을 보여줄 수 있는 실제 사례를 알려주세요.",
        "성과를 정량화할 수 있는 수치(시간 절감, 비용 절감)가 있나요?"
      ];
    }
    try {
      return await runFollowUpQuestionsChain(llm, gap);
    } catch {
      return [
        "배포/운영 경험을 보여줄 수 있는 실제 사례를 알려주세요.",
        "성과를 정량화할 수 있는 수치(시간 절감, 비용 절감)가 있나요?"
      ];
    }
  }

  async regenerateCandidateWithFollowUp(
    currentCandidate: CandidateProfile,
    followUpAnswers: string
  ): Promise<CandidateProfile> {
    const mergedInput = [
      "Current candidate profile JSON:",
      JSON.stringify(currentCandidate),
      "New follow-up evidence:",
      followUpAnswers
    ].join("\n");
    return this.extractCandidateProfile(mergedInput);
  }

  async generateDocuments(candidate: CandidateProfile, job: JobPostingProfile): Promise<GeneratedDraft> {
    const llm = this.getModelRouter("quality");
    if (!llm) {
      return {
        coverLetter: `지원 동기와 직무 정합성을 강조한 초안\n${JSON.stringify(candidate)}`,
        careerDescription: `경력 기술 초안\n${JSON.stringify(candidate)}`,
        projectIntro: `프로젝트 소개 초안\n${JSON.stringify(candidate)}`
      };
    }
    try {
      return await runDocumentGenerationChain(llm, candidate, job);
    } catch {
      return {
        coverLetter: `지원 동기와 직무 정합성을 강조한 초안\n${JSON.stringify(candidate)}`,
        careerDescription: `경력 기술 초안\n${JSON.stringify(candidate)}`,
        projectIntro: `프로젝트 소개 초안\n${JSON.stringify(candidate)}`
      };
    }
  }

  async generateInterviewQuestions(candidate: CandidateProfile, job: JobPostingProfile): Promise<string[]> {
    const llm = this.getModelRouter("light");
    if (!llm) {
      return [
        "이 프로젝트에서 문제를 정의하고 해결한 방식을 설명해 주세요.",
        "LLM 워크플로우를 단일 프롬프트가 아닌 체인으로 분리한 이유는 무엇인가요?"
      ];
    }
    try {
      return await runInterviewQuestionsChain(llm, candidate, job);
    } catch {
      return [
        "이 프로젝트에서 문제를 정의하고 해결한 방식을 설명해 주세요.",
        "LLM 워크플로우를 단일 프롬프트가 아닌 체인으로 분리한 이유는 무엇인가요?"
      ];
    }
  }

  async rewriteForTargetJob(draft: GeneratedDraft, job: JobPostingProfile): Promise<RewriteDraft> {
    const llm = this.getModelRouter("quality");
    if (!llm) {
      return {
        coverLetter: `${draft.coverLetter}\n\n[JD 맞춤 리라이트 적용]`,
        careerDescription: `${draft.careerDescription}\n\n[JD 맞춤 리라이트 적용]`,
        projectIntro: `${draft.projectIntro}\n\n[JD 맞춤 리라이트 적용]`
      };
    }
    try {
      return await runRewriteTailoringChain(llm, draft, job);
    } catch {
      return {
        coverLetter: `${draft.coverLetter}\n\n[JD 맞춤 리라이트 적용]`,
        careerDescription: `${draft.careerDescription}\n\n[JD 맞춤 리라이트 적용]`,
        projectIntro: `${draft.projectIntro}\n\n[JD 맞춤 리라이트 적용]`
      };
    }
  }
}
