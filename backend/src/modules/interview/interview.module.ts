import { Module } from "@nestjs/common";
import { LangchainModule } from "../langchain/langchain.module";
import { InterviewController } from "./interview.controller";
import { InterviewService } from "./interview.service";

@Module({
  imports: [LangchainModule],
  controllers: [InterviewController],
  providers: [InterviewService]
})
export class InterviewModule {}
