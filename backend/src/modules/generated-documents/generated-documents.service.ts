import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RequestRateLimiterService } from "../../common/request-rate-limiter.service";
import { WORKFLOW_STAGE } from "../../common/workflow-stage.constants";
import { WorkflowExecutionLockService } from "../../common/workflow-execution-lock.service";
import { LangchainWorkflowService } from "../langchain/langchain-workflow.service";
import { CandidateProfile, JobPostingProfile } from "../langchain/workflow.types";
import { hasStoredFitAnalysis } from "../../common/fit-analysis.util";
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
    const prioritizedProjectContext = app.projectDescriptions?.[0]?.trim() ?? "";
    if (!candidate || !job) throw new NotFoundException("Analysis data not found.");
    if (!hasStoredFitAnalysis(app.fitAnalysisJson)) {
      throw new BadRequestException("먼저 공고 대상 장·단점 분석(1단계)을 완료한 뒤 문서 생성을 진행해 주세요.");
    }

    const existingDraft = (app.generatedDraftJson ?? {}) as Record<string, unknown>;
    const hasExistingDocuments =
      typeof existingDraft.coverLetter === "string" &&
      existingDraft.coverLetter.trim().length > 0 &&
      typeof existingDraft.careerDescription === "string" &&
      existingDraft.careerDescription.trim().length > 0 &&
      typeof existingDraft.projectIntro === "string" &&
      existingDraft.projectIntro.trim().length > 0;

    if (!dto.force && hasExistingDocuments) {
      await this.prisma.workflowRun.create({
        data: {
          applicationId,
          stage: WORKFLOW_STAGE.GENERATE_DRAFTS,
          errorMessage: "SKIPPED_REUSE_EXISTING_DOCUMENTS"
        }
      });
      return app;
    }

    const generated = await this.workflow.generateDocuments(candidate, job, prioritizedProjectContext);
    const generateRoute = this.workflow.getRoutingInfo("generateDocuments");
    const generateExecution = this.workflow.getExecutionDiagnostics("generateDocuments");
    await this.prisma.workflowRun.create({
      data: {
        applicationId,
        stage: WORKFLOW_STAGE.GENERATE_DRAFTS,
        inputJson: {
          llmRoute: generateRoute,
          llmExecution: generateExecution
        } as unknown as Prisma.InputJsonValue,
        outputJson: generated as unknown as Prisma.InputJsonValue
      }
    });
    const rewritten = dto.rewriteForJob
      ? await this.workflow.rewriteForTargetJob(generated, job, prioritizedProjectContext)
      : undefined;
    if (rewritten) {
      const rewriteRoute = this.workflow.getRoutingInfo("rewriteForTargetJob");
      const rewriteExecution = this.workflow.getExecutionDiagnostics("rewriteForTargetJob");
      await this.prisma.workflowRun.create({
        data: {
          applicationId,
          stage: WORKFLOW_STAGE.REWRITE_FOR_JOB,
          inputJson: {
            llmRoute: rewriteRoute,
            llmExecution: rewriteExecution
          } as unknown as Prisma.InputJsonValue,
          outputJson: rewritten as unknown as Prisma.InputJsonValue
        }
      });
    }

    return this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "DOCUMENTS_GENERATED",
        generatedDraftJson: {
          ...(existingDraft as Record<string, unknown>),
          ...generated
        } as unknown as Prisma.InputJsonValue,
        rewrittenDraftJson: rewritten as unknown as Prisma.InputJsonValue
      }
    });
    } finally {
      this.lock.release(lockKey);
    }
  }
}
