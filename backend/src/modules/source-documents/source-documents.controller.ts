import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CreateSourceDocumentDto } from "./dto/create-source-document.dto";
import { SourceDocumentsService } from "./source-documents.service";

@Controller("source-documents")
export class SourceDocumentsController {
  constructor(private readonly sourceDocumentsService: SourceDocumentsService) {}

  @Post()
  create(@Body() dto: CreateSourceDocumentDto) {
    return this.sourceDocumentsService.create(dto);
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.sourceDocumentsService.getById(Number(id));
  }
}
