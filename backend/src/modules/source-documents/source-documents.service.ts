import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSourceDocumentDto } from "./dto/create-source-document.dto";

@Injectable()
export class SourceDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSourceDocumentDto) {
    return this.prisma.application.create({
      data: {
        status: "CREATED",
        resumeText: dto.resumeText,
        portfolioText: dto.portfolioText,
        projectDescriptions: dto.projectDescriptions ?? [],
        targetJobPostingText: dto.targetJobPostingText
      }
    });
  }

  async getById(id: number) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        workflowRuns: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!application) {
      throw new NotFoundException("Application not found.");
    }
    return application;
  }
}
