import { Body, Controller, Post, Req } from "@nestjs/common";
import { RunAnalysisDto } from "./dto/run-analysis.dto";
import { AnalysisService } from "./analysis.service";

@Controller("analysis")
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post("run")
  run(@Req() req: { ip?: string }, @Body() dto: RunAnalysisDto) {
    return this.analysisService.run(dto.applicationId, dto.force ?? false, req.ip ?? "unknown");
  }
}
