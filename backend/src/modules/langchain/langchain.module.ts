import { Module } from "@nestjs/common";
import { LangchainWorkflowService } from "./langchain-workflow.service";

@Module({
  providers: [LangchainWorkflowService],
  exports: [LangchainWorkflowService]
})
export class LangchainModule {}
