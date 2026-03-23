import { Module } from "@nestjs/common";
import { LangchainModule } from "../langchain/langchain.module";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";

@Module({
  imports: [LangchainModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService]
})
export class AnalysisModule {}
