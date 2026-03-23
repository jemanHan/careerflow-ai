import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { WORKFLOW_STAGE } from "../../common/workflow-stage.constants";
import { RequestRateLimiterService } from "../../common/request-rate-limiter.service";
import { WorkflowExecutionLockService } from "../../common/workflow-execution-lock.service";
import { LangchainWorkflowService } from "../langchain/langchain-workflow.service";
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
      app.followUpQuestions.length > 0
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

    const sourceText = [app.resumeText, app.portfolioText, ...app.projectDescriptions].join("\n\n");
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.PARSE_SOURCE,
        outputJson: { sourceTextLength: sourceText.length } as unknown as Prisma.InputJsonValue
      }
    });

    const candidate = await this.workflow.extractCandidateProfile(sourceText);
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.EXTRACT_CANDIDATE,
        outputJson: candidate as unknown as Prisma.InputJsonValue
      }
    });

    const job = await this.workflow.extractJobPosting(app.targetJobPostingText);
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.EXTRACT_JOB,
        outputJson: job as unknown as Prisma.InputJsonValue
      }
    });

    const gap = await this.workflow.detectGaps(candidate, job);
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.DETECT_GAP,
        outputJson: gap as unknown as Prisma.InputJsonValue
      }
    });

    const questions = await this.workflow.generateFollowUpQuestions(gap);
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.GENERATE_FOLLOW_UP,
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
        followUpQuestions: questions
      }
    });
    } finally {
      this.lock.release(lockKey);
    }
  }
}
