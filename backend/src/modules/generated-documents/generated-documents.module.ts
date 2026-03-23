import { Module } from "@nestjs/common";
import { LangchainModule } from "../langchain/langchain.module";
import { GeneratedDocumentsController } from "./generated-documents.controller";
import { GeneratedDocumentsService } from "./generated-documents.service";

@Module({
  imports: [LangchainModule],
  controllers: [GeneratedDocumentsController],
  providers: [GeneratedDocumentsService]
})
export class GeneratedDocumentsModule {}
