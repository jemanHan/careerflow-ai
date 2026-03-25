import { Body, Controller, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { CreateSourceDocumentDto } from "./dto/create-source-document.dto";
import { UpdateApplicationMetaDto } from "./dto/update-application-meta.dto";
import { UpdateApplicationSourcesDto } from "./dto/update-application-sources.dto";
import { SourceDocumentsService } from "./source-documents.service";

@Controller("source-documents")
export class SourceDocumentsController {
  constructor(private readonly sourceDocumentsService: SourceDocumentsService) {}

  @Post("test-user")
  createTestUser() {
    return this.sourceDocumentsService.createTestUser();
  }

  @Post()
  create(@Body() dto: CreateSourceDocumentDto) {
    return this.sourceDocumentsService.create(dto);
  }

  @Get("by-test-user/:testUserId")
  getByTestUser(
    @Param("testUserId") testUserId: string,
    @Headers("x-test-user-id") activeTestUserId?: string
  ) {
    return this.sourceDocumentsService.listByTestUser(testUserId, activeTestUserId);
  }

  @Post(":id/link-my-workflow")
  linkMyWorkflow(@Param("id") id: string, @Headers("x-test-user-id") activeTestUserId?: string) {
    return this.sourceDocumentsService.linkApplicationToActiveTestUser(Number(id), activeTestUserId);
  }

  @Get(":id")
  getById(@Param("id") id: string, @Headers("x-test-user-id") activeTestUserId?: string) {
    return this.sourceDocumentsService.getById(Number(id), activeTestUserId);
  }

  @Patch(":id")
  patchSources(
    @Param("id") id: string,
    @Body() dto: UpdateApplicationSourcesDto,
    @Headers("x-test-user-id") activeTestUserId?: string
  ) {
    return this.sourceDocumentsService.updateSources(Number(id), dto, activeTestUserId);
  }

  @Patch(":id/meta")
  patchMeta(
    @Param("id") id: string,
    @Body() dto: UpdateApplicationMetaDto,
    @Headers("x-test-user-id") activeTestUserId?: string
  ) {
    return this.sourceDocumentsService.updateMeta(Number(id), dto, activeTestUserId);
  }
}
