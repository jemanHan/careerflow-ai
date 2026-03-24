import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSourceDocumentDto } from "./dto/create-source-document.dto";

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
            status: true,
            createdAt: true,
            updatedAt: true,
            targetJobPostingText: true,
            fitAnalysisJson: true
          }
        }
      }
    });
    if (!user) {
      throw new NotFoundException("Test user not found.");
    }
    return user;
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
