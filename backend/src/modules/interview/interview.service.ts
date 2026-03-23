import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RequestRateLimiterService } from "../../common/request-rate-limiter.service";
import { WORKFLOW_STAGE } from "../../common/workflow-stage.constants";
import { WorkflowExecutionLockService } from "../../common/workflow-execution-lock.service";
import { LangchainWorkflowService } from "../langchain/langchain-workflow.service";
import { CandidateProfile, JobPostingProfile } from "../langchain/workflow.types";
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
    if (!candidate || !job) throw new NotFoundException("Analysis data not found.");
    const generated = (app.generatedDraftJson ?? {}) as Record<string, unknown>;
    const existingQuestions = generated.interviewQuestions;
    if (!dto.force && Array.isArray(existingQuestions) && existingQuestions.length > 0) {
      await this.prisma.workflowRun.create({
        data: {
          applicationId,
          stage: WORKFLOW_STAGE.GENERATE_INTERVIEW,
          errorMessage: "SKIPPED_REUSE_EXISTING_INTERVIEW"
        }
      });
      return app;
    }

    const questions = await this.workflow.generateInterviewQuestions(candidate, job);
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.GENERATE_INTERVIEW,
        outputJson: { questions } as unknown as Prisma.InputJsonValue
      }
    });
    return this.prisma.application.update({
      where: { id: applicationId },
      data: {
        generatedDraftJson: {
          ...generated,
          interviewQuestions: questions
        } as unknown as Prisma.InputJsonValue
      }
    });
    } finally {
      this.lock.release(lockKey);
    }
  }
}
