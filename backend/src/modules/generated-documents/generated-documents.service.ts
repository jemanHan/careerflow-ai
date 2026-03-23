import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RequestRateLimiterService } from "../../common/request-rate-limiter.service";
import { WORKFLOW_STAGE } from "../../common/workflow-stage.constants";
import { WorkflowExecutionLockService } from "../../common/workflow-execution-lock.service";
import { LangchainWorkflowService } from "../langchain/langchain-workflow.service";
import { CandidateProfile, JobPostingProfile } from "../langchain/workflow.types";
import { PrismaService } from "../prisma/prisma.service";
import { GenerateDocumentsDto } from "./dto/generate-documents.dto";

@Injectable()
export class GeneratedDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: LangchainWorkflowService,
    private readonly limiter: RequestRateLimiterService,
    private readonly lock: WorkflowExecutionLockService
  ) {}

  async generate(dto: GenerateDocumentsDto, requesterKey: string) {
    this.limiter.checkOrThrow({
      key: `documents:${requesterKey}`,
      maxInWindow: 5,
      windowMs: 60_000
    });
    const applicationId = Number(dto.applicationId);
    const lockKey = `documents:${applicationId}`;
    this.lock.acquireOrThrow(lockKey);
    try {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException("Application not found.");

    const candidate = app.candidateProfileJson as CandidateProfile | null;
    const job = app.jobPostingJson as JobPostingProfile | null;
    if (!candidate || !job) throw new NotFoundException("Analysis data not found.");

    if (!dto.force && app.generatedDraftJson) {
      await this.prisma.workflowRun.create({
        data: {
          applicationId,
          stage: WORKFLOW_STAGE.GENERATE_DRAFTS,
          errorMessage: "SKIPPED_REUSE_EXISTING_DOCUMENTS"
        }
      });
      return app;
    }

    const generated = await this.workflow.generateDocuments(candidate, job);
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.GENERATE_DRAFTS,
        outputJson: generated as unknown as Prisma.InputJsonValue
      }
    });
    const rewritten = dto.rewriteForJob ? await this.workflow.rewriteForTargetJob(generated, job) : undefined;
    if (rewritten) {
      await this.prisma.workflowRun.create({
        data: {
          applicationId,
          stage: WORKFLOW_STAGE.REWRITE_FOR_JOB,
          outputJson: rewritten as unknown as Prisma.InputJsonValue
        }
      });
    }

    return this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "DOCUMENTS_GENERATED",
        generatedDraftJson: generated as unknown as Prisma.InputJsonValue,
        rewrittenDraftJson: rewritten as unknown as Prisma.InputJsonValue
      }
    });
    } finally {
      this.lock.release(lockKey);
    }
  }
}
