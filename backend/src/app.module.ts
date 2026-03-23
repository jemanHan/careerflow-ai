import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RequestRateLimiterService } from "./common/request-rate-limiter.service";
import { WorkflowExecutionLockService } from "./common/workflow-execution-lock.service";
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
    PrismaModule,
    LangchainModule,
    SourceDocumentsModule,
    AnalysisModule,
    FollowupQuestionsModule,
    GeneratedDocumentsModule,
    InterviewModule
  ],
  providers: [RequestRateLimiterService, WorkflowExecutionLockService]
})
export class AppModule {}
