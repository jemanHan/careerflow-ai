import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSourceDocumentDto } from "./dto/create-source-document.dto";
import { UpdateApplicationMetaDto } from "./dto/update-application-meta.dto";
import { UpdateApplicationSourcesDto } from "./dto/update-application-sources.dto";

const TEST_USER_ID_REGEX = /^\d{3}$/;

@Injectable()
export class SourceDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTestUser() {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const id = this.generateReadableTestUserId();
      try {
        return await this.prisma.testUser.create({ data: { id } });
      } catch (error) {
        // Unique collision: retry with a new id.
        if (this.isUniqueConstraintError(error)) {
          continue;
        }
        throw error;
      }
    }
    throw new Error("Failed to allocate a unique test user id.");
  }

  async create(dto: CreateSourceDocumentDto) {
    const rawTestUserId = dto.testUserId?.trim();
    const testUserId = rawTestUserId && rawTestUserId.length > 0 ? rawTestUserId : undefined;
    if (testUserId) {
      this.assertValidTestUserId(testUserId);
      await this.prisma.testUser.upsert({
        where: { id: testUserId },
        update: {},
        create: { id: testUserId }
      });
    }
    return this.prisma.application.create({
      data: {
        status: "CREATED",
        testUserId,
        title: dto.title?.trim() ? dto.title.trim() : undefined,
        resumeText: dto.resumeText,
        portfolioText: dto.portfolioText,
        projectDescriptions: dto.projectDescriptions ?? [],
        targetJobPostingText: dto.targetJobPostingText
      }
    });
  }

  async listByTestUser(testUserId: string, activeTestUserId?: string) {
    this.assertSameActiveTestUser(testUserId, activeTestUserId);
    const user = await this.prisma.testUser.findUnique({
      where: { id: testUserId },
      include: {
        applications: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            targetJobPostingText: true,
            fitAnalysisJson: true,
            generatedDraftJson: true
          }
        }
      }
    });
    if (!user) {
      throw new NotFoundException("Test user not found.");
    }
    const applications = user.applications.map(({ generatedDraftJson, ...rest }) => ({
      ...rest,
      ...this.summarizeDraftFlags(generatedDraftJson)
    }));
    return { id: user.id, applications };
  }

  async linkApplicationToActiveTestUser(applicationId: number, activeTestUserId?: string) {
    if (!activeTestUserId?.trim()) {
      throw new ForbiddenException("Active test user id is required.");
    }
    this.assertValidTestUserId(activeTestUserId);
    await this.prisma.testUser.upsert({
      where: { id: activeTestUserId },
      update: {},
      create: { id: activeTestUserId }
    });
    const application = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) {
      throw new NotFoundException("Application not found.");
    }
    if (application.testUserId && application.testUserId !== activeTestUserId) {
      throw new ForbiddenException("This workflow is already linked to another test user id.");
    }
    if (application.testUserId === activeTestUserId) {
      return this.getById(applicationId, activeTestUserId);
    }
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { testUserId: activeTestUserId }
    });
    return this.getById(applicationId, activeTestUserId);
  }

  private summarizeDraftFlags(draft: unknown): { hasDocumentDraft: boolean; hasInterviewPrep: boolean } {
    const d = draft as Record<string, unknown> | null | undefined;
    const hasDocumentDraft = Boolean(
      (typeof d?.coverLetter === "string" && d.coverLetter.trim().length > 0) ||
        (typeof d?.careerDescription === "string" && d.careerDescription.trim().length > 0)
    );
    const ir = d?.interviewReport;
    const iq = d?.interviewQuestions;
    const hasInterviewPrep = Boolean(
      (Array.isArray(ir) && ir.length > 0) || (Array.isArray(iq) && iq.length > 0)
    );
    return { hasDocumentDraft, hasInterviewPrep };
  }

  async getById(id: number, activeTestUserId?: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        workflowRuns: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!application) {
      throw new NotFoundException("Application not found.");
    }
    if (application.testUserId) {
      this.assertSameActiveTestUser(application.testUserId, activeTestUserId);
    }
    return application;
  }

  async updateSources(id: number, dto: UpdateApplicationSourcesDto, activeTestUserId?: string) {
    await this.getById(id, activeTestUserId);
    const data: {
      resumeText?: string;
      portfolioText?: string;
      projectDescriptions?: string[];
      targetJobPostingText?: string;
    } = {};
    if (dto.resumeText !== undefined) data.resumeText = dto.resumeText;
    if (dto.portfolioText !== undefined) data.portfolioText = dto.portfolioText;
    if (dto.projectDescriptions !== undefined) data.projectDescriptions = dto.projectDescriptions;
    if (dto.targetJobPostingText !== undefined) data.targetJobPostingText = dto.targetJobPostingText;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException("수정할 필드를 한 개 이상 보내 주세요.");
    }
    return this.prisma.application.update({
      where: { id },
      data,
      include: { workflowRuns: { orderBy: { createdAt: "asc" } } }
    });
  }

  async updateMeta(id: number, dto: UpdateApplicationMetaDto, activeTestUserId?: string) {
    await this.getById(id, activeTestUserId);
    const data: Prisma.ApplicationUpdateInput = {};

    if (dto.title !== undefined) {
      const t = dto.title.trim();
      data.title = t.length > 0 ? t : null;
    }
    if (dto.interviewNotesJson !== undefined) {
      data.interviewNotesJson = dto.interviewNotesJson as unknown as Prisma.InputJsonValue;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException("수정할 필드를 한 개 이상 보내 주세요.");
    }
    return this.prisma.application.update({
      where: { id },
      data,
      include: { workflowRuns: { orderBy: { createdAt: "asc" } } }
    });
  }

  private generateReadableTestUserId() {
    return Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
  }

  private assertValidTestUserId(id: string) {
    if (!TEST_USER_ID_REGEX.test(id)) {
      throw new ForbiddenException("Invalid test user id format.");
    }
  }

  private assertSameActiveTestUser(targetTestUserId: string, activeTestUserId?: string) {
    if (!activeTestUserId) {
      throw new ForbiddenException("Active test user id is required.");
    }
    this.assertValidTestUserId(activeTestUserId);
    if (targetTestUserId !== activeTestUserId) {
      throw new ForbiddenException("You can only access workflows for your active test id.");
    }
  }

  private isUniqueConstraintError(error: unknown) {
    if (!(error instanceof Error)) {
      return false;
    }
    return error.message.includes("Unique constraint failed");
  }
}
