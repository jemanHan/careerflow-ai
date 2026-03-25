import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RequestRateLimiterService } from "../../common/request-rate-limiter.service";
import { WORKFLOW_STAGE } from "../../common/workflow-stage.constants";
import { WorkflowExecutionLockService } from "../../common/workflow-execution-lock.service";
import { LangchainWorkflowService } from "../langchain/langchain-workflow.service";
import { CandidateProfile, GapAnalysis, InterviewReportItem, JobPostingProfile } from "../langchain/workflow.types";
import { PrismaService } from "../prisma/prisma.service";
import { GenerateInterviewQuestionsDto } from "./dto/generate-interview-questions.dto";

@Injectable()
export class InterviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: LangchainWorkflowService,
    private readonly limiter: RequestRateLimiterService,
    private readonly lock: WorkflowExecutionLockService
  ) {}

  async generate(dto: GenerateInterviewQuestionsDto, requesterKey: string) {
    this.limiter.checkOrThrow({
      key: `interview:${requesterKey}`,
      maxInWindow: 6,
      windowMs: 60_000
    });
    const applicationId = Number(dto.applicationId);
    const lockKey = `interview:${applicationId}`;
    this.lock.acquireOrThrow(lockKey);
    try {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException("Application not found.");

    const candidate = app.candidateProfileJson as CandidateProfile | null;
    const job = app.jobPostingJson as JobPostingProfile | null;
    const prioritizedProjectContext = app.projectDescriptions?.[0]?.trim() ?? "";
    if (!candidate || !job) throw new NotFoundException("Analysis data not found.");
    const generated = (app.generatedDraftJson ?? {}) as Record<string, unknown>;
    const hasDocDraft =
      (typeof generated.coverLetter === "string" && generated.coverLetter.trim().length > 0) ||
      (typeof generated.careerDescription === "string" && generated.careerDescription.trim().length > 0);
    if (!hasDocDraft) {
      throw new BadRequestException("먼저 문서 생성(2단계)을 완료한 뒤 면접 대비 리포트를 생성해 주세요.");
    }
    const existingQuestions = generated.interviewQuestions;
    const existingReport = generated.interviewReport;
    if (!dto.force && ((Array.isArray(existingQuestions) && existingQuestions.length > 0) || (Array.isArray(existingReport) && existingReport.length > 0))) {
      await this.prisma.workflowRun.create({
        data: {
          applicationId,
          stage: WORKFLOW_STAGE.GENERATE_INTERVIEW,
          errorMessage: "SKIPPED_REUSE_EXISTING_INTERVIEW"
        }
      });
      return app;
    }

    const gapAnalysis = app.gapAnalysisJson as GapAnalysis | null;
    const reportItems = await this.workflow.generateInterviewQuestions(
      candidate,
      job,
      prioritizedProjectContext,
      gapAnalysis ?? undefined
    );
    const questions = reportItems.map((item) => item.question);
    const interviewRoute = this.workflow.getRoutingInfo("generateInterviewQuestions");
    const interviewExecution = this.workflow.getExecutionDiagnostics("generateInterviewQuestions");
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.GENERATE_INTERVIEW,
        inputJson: {
          llmRoute: interviewRoute,
          llmExecution: interviewExecution
        } as unknown as Prisma.InputJsonValue,
        outputJson: { items: reportItems } as unknown as Prisma.InputJsonValue
      }
    });
    return this.prisma.application.update({
      where: { id: applicationId },
      data: {
        generatedDraftJson: {
          ...generated,
          interviewQuestions: questions,
          interviewReport: reportItems as InterviewReportItem[]
        } as unknown as Prisma.InputJsonValue
      }
    });
    } finally {
      this.lock.release(lockKey);
    }
  }
}
