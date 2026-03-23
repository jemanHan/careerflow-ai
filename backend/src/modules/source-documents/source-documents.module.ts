import { Module } from "@nestjs/common";
import { SourceDocumentsController } from "./source-documents.controller";
import { SourceDocumentsService } from "./source-documents.service";

@Module({
  controllers: [SourceDocumentsController],
  providers: [SourceDocumentsService],
  exports: [SourceDocumentsService]
})
export class SourceDocumentsModule {}
