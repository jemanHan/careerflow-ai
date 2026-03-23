import { Body, Controller, Post, Req } from "@nestjs/common";
import { GenerateInterviewQuestionsDto } from "./dto/generate-interview-questions.dto";
import { InterviewService } from "./interview.service";

@Controller("interview")
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Post("generate")
  generate(@Req() req: { ip?: string }, @Body() dto: GenerateInterviewQuestionsDto) {
    return this.interviewService.generate(dto, req.ip ?? "unknown");
  }
}
