import { Module } from "@nestjs/common";
import { LangchainModule } from "../langchain/langchain.module";
import { FollowupQuestionsController } from "./followup-questions.controller";
import { FollowupQuestionsService } from "./followup-questions.service";

@Module({
  imports: [LangchainModule],
  controllers: [FollowupQuestionsController],
  providers: [FollowupQuestionsService]
})
export class FollowupQuestionsModule {}
