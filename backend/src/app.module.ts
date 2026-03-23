import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CommonModule } from "./common/common.module";
import { AnalysisModule } from "./modules/analysis/analysis.module";
import { FollowupQuestionsModule } from "./modules/followup-questions/followup-questions.module";
import { GeneratedDocumentsModule } from "./modules/generated-documents/generated-documents.module";
import { InterviewModule } from "./modules/interview/interview.module";
import { LangchainModule } from "./modules/langchain/langchain.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { SourceDocumentsModule } from "./modules/source-documents/source-documents.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    PrismaModule,
    LangchainModule,
    SourceDocumentsModule,
    AnalysisModule,
    FollowupQuestionsModule,
    GeneratedDocumentsModule,
    InterviewModule
  ]
})
export class AppModule {}
