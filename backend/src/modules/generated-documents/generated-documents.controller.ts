import { Body, Controller, Post, Req } from "@nestjs/common";
import { GenerateDocumentsDto } from "./dto/generate-documents.dto";
import { GeneratedDocumentsService } from "./generated-documents.service";

@Controller("generated-documents")
export class GeneratedDocumentsController {
  constructor(private readonly generatedDocumentsService: GeneratedDocumentsService) {}

  @Post("generate")
  generate(@Req() req: { ip?: string }, @Body() dto: GenerateDocumentsDto) {
    return this.generatedDocumentsService.generate(dto, req.ip ?? "unknown");
  }
}
