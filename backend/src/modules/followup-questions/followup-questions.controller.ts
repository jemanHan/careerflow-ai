import { Body, Controller, Post, Req } from "@nestjs/common";
import { SubmitFollowupAnswersDto } from "./dto/submit-followup-answers.dto";
import { FollowupQuestionsService } from "./followup-questions.service";

@Controller("followup-questions")
export class FollowupQuestionsController {
  constructor(private readonly followupQuestionsService: FollowupQuestionsService) {}

  @Post("submit")
  submit(@Req() req: { ip?: string }, @Body() dto: SubmitFollowupAnswersDto) {
    return this.followupQuestionsService.submit(dto, req.ip ?? "unknown");
  }
}
