import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RequestRateLimiterService } from "../../common/request-rate-limiter.service";
import { WORKFLOW_STAGE } from "../../common/workflow-stage.constants";
import { WorkflowExecutionLockService } from "../../common/workflow-execution-lock.service";
import { LangchainWorkflowService } from "../langchain/langchain-workflow.service";
import { CandidateProfile } from "../langchain/workflow.types";
import { PrismaService } from "../prisma/prisma.service";
import { SubmitFollowupAnswersDto } from "./dto/submit-followup-answers.dto";

@Injectable()
export class FollowupQuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: LangchainWorkflowService,
    private readonly limiter: RequestRateLimiterService,
    private readonly lock: WorkflowExecutionLockService
  ) {}

  async submit(dto: SubmitFollowupAnswersDto, requesterKey: string) {
    this.limiter.checkOrThrow({
      key: `followup:${requesterKey}`,
      maxInWindow: 8,
      windowMs: 60_000
    });
    const applicationId = Number(dto.applicationId);
    const lockKey = `followup:${applicationId}`;
    this.lock.acquireOrThrow(lockKey);
    try {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException("Application not found.");

    if (!dto.force && JSON.stringify(app.followUpAnswersJson ?? []) === JSON.stringify(dto.answers)) {
      await this.prisma.workflowRun.create({
        data: {
          applicationId,
          stage: WORKFLOW_STAGE.REGENERATE_CANDIDATE,
          errorMessage: "SKIPPED_DUPLICATE_FOLLOWUP_ANSWERS"
        }
      });
      return app;
    }

    const candidate = (app.candidateProfileJson ?? {
      summary: "",
      strengths: [],
      experiences: [],
      projects: []
    }) as CandidateProfile;
    const prioritizedProjectContext = app.projectDescriptions?.[0]?.trim() ?? "";
    const evidence = dto.answers.map((a) => `${a.questionId}: ${a.answer}`).join("\n");
    const updated = await this.workflow.regenerateCandidateWithFollowUp(
      candidate,
      evidence,
      prioritizedProjectContext
    );
    const regenerateRoute = this.workflow.getRoutingInfo("extractCandidateProfile");
    const regenerateExecution = this.workflow.getExecutionDiagnostics("extractCandidateProfile");
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.REGENERATE_CANDIDATE,
        inputJson: {
          answers: dto.answers,
          llmRoute: regenerateRoute,
          llmExecution: regenerateExecution
        } as unknown as Prisma.InputJsonValue,
        outputJson: updated as unknown as Prisma.InputJsonValue
      }
    });

    return this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "FOLLOW_UP_COMPLETED",
        followUpAnswersJson: dto.answers as unknown as Prisma.InputJsonValue,
        candidateProfileJson: updated as unknown as Prisma.InputJsonValue
      }
    });
    } finally {
      this.lock.release(lockKey);
    }
  }
}
