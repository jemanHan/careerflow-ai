import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { WORKFLOW_STAGE } from "../../common/workflow-stage.constants";
import { RequestRateLimiterService } from "../../common/request-rate-limiter.service";
import { WorkflowExecutionLockService } from "../../common/workflow-execution-lock.service";
import { computeFitAnalysisSnapshot } from "../../common/fit-analysis.util";
import { GapAnalysis } from "../langchain/workflow.types";
import {
  LangchainWorkflowService,
  type FitAnalysisRoutingContext
} from "../langchain/langchain-workflow.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: LangchainWorkflowService,
    private readonly limiter: RequestRateLimiterService,
    private readonly lock: WorkflowExecutionLockService
  ) {}

  async run(applicationId: number, force: boolean, requesterKey: string) {
    this.limiter.checkOrThrow({
      key: `analysis:${requesterKey}`,
      maxInWindow: 5,
      windowMs: 60_000
    });
    const lockKey = `analysis:${applicationId}`;
    this.lock.acquireOrThrow(lockKey);
    try {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException("Application not found.");

    if (
      !force &&
      app.status === "ANALYZED" &&
      app.candidateProfileJson &&
      app.jobPostingJson &&
      app.gapAnalysisJson &&
      app.followUpQuestions.length > 0 &&
      app.fitAnalysisJson != null
    ) {
      await this.prisma.workflowRun.create({
        data: {
          applicationId,
          stage: WORKFLOW_STAGE.PARSE_SOURCE,
          errorMessage: "SKIPPED_REUSE_EXISTING_ANALYSIS"
        }
      });
      return app;
    }

    const prioritizedProjectContext = app.projectDescriptions?.[0]?.trim() ?? "";
    const otherProjects = app.projectDescriptions.slice(1);
    const sourceText = [
      app.resumeText,
      app.portfolioText,
      prioritizedProjectContext ? `Highlighted project (highest priority):\n${prioritizedProjectContext}` : "",
      ...otherProjects
    ]
      .filter(Boolean)
      .join("\n\n");
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.PARSE_SOURCE,
        outputJson: { sourceTextLength: sourceText.length } as unknown as Prisma.InputJsonValue
      }
    });

    // 공고 대비 장·단점 파이프라인 4단계: 매 분석 실행마다 GEMINI_PREMIUM_MODEL 사용(설정 시). 재실행·force 동일.
    const initialFitCtx: FitAnalysisRoutingContext = {
      usePremiumFitPass: true
    };

    const candidate = await this.workflow.extractCandidateProfile(
      sourceText,
      prioritizedProjectContext,
      initialFitCtx
    );
    const extractCandidateRoute = this.workflow.getRoutingInfo("extractCandidateProfile", initialFitCtx);
    const extractCandidateExecution = this.workflow.getExecutionDiagnostics("extractCandidateProfile", initialFitCtx);
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.EXTRACT_CANDIDATE,
        inputJson: {
          llmRoute: extractCandidateRoute,
          llmExecution: extractCandidateExecution
        } as unknown as Prisma.InputJsonValue,
        outputJson: candidate as unknown as Prisma.InputJsonValue
      }
    });

    const job = await this.workflow.extractJobPosting(app.targetJobPostingText, initialFitCtx);
    const extractJobRoute = this.workflow.getRoutingInfo("extractJobPosting", initialFitCtx);
    const extractJobExecution = this.workflow.getExecutionDiagnostics("extractJobPosting", initialFitCtx);
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.EXTRACT_JOB,
        inputJson: {
          llmRoute: extractJobRoute,
          llmExecution: extractJobExecution
        } as unknown as Prisma.InputJsonValue,
        outputJson: job as unknown as Prisma.InputJsonValue
      }
    });

    const gap = await this.workflow.detectGaps(candidate, job, initialFitCtx, sourceText);
    const gapRoute = this.workflow.getRoutingInfo("detectGaps", initialFitCtx);
    const gapExecution = this.workflow.getExecutionDiagnostics("detectGaps", initialFitCtx);
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.DETECT_GAP,
        inputJson: {
          llmRoute: gapRoute,
          llmExecution: gapExecution
        } as unknown as Prisma.InputJsonValue,
        outputJson: gap as unknown as Prisma.InputJsonValue
      }
    });

    const fitAnalysis = computeFitAnalysisSnapshot(gap as GapAnalysis, candidate, job, sourceText);
    const isLimitedQuality =
      (extractCandidateExecution.fallbackUsed || extractJobExecution.fallbackUsed || gapExecution.fallbackUsed) &&
      (gap.matchedSignals?.length ?? 0) === 0 &&
      (gap.missingSignals?.length ?? 0) === 0 &&
      (gap.weakEvidence?.length ?? 0) === 0;
    const fitAnalysisWithQuality = isLimitedQuality
      ? {
          ...fitAnalysis,
          analysisQuality: "limited",
          qualityReason: "LLM fallback 경로에서 유효 신호가 부족해 분석 품질이 제한되었습니다."
        }
      : fitAnalysis;

    const questions = await this.workflow.generateFollowUpQuestions(gap, initialFitCtx);
    const followUpRoute = this.workflow.getRoutingInfo("generateFollowUpQuestions", initialFitCtx);
    const followUpExecution = this.workflow.getExecutionDiagnostics("generateFollowUpQuestions", initialFitCtx);
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.GENERATE_FOLLOW_UP,
        inputJson: {
          llmRoute: followUpRoute,
          llmExecution: followUpExecution
        } as unknown as Prisma.InputJsonValue,
        outputJson: { questions } as unknown as Prisma.InputJsonValue
      }
    });

    return this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "ANALYZED",
        candidateProfileJson: candidate as unknown as Prisma.InputJsonValue,
        jobPostingJson: job as unknown as Prisma.InputJsonValue,
        gapAnalysisJson: gap as unknown as Prisma.InputJsonValue,
        fitAnalysisJson: fitAnalysisWithQuality as unknown as Prisma.InputJsonValue,
        followUpQuestions: questions
      }
    });
    } finally {
      this.lock.release(lockKey);
    }
  }
}
