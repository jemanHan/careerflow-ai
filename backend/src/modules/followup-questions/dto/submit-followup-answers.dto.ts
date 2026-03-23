import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from "class-validator";

class FollowUpAnswerDto {
  @IsString()
  questionId!: string;

  @IsString()
  answer!: string;
}

export class SubmitFollowupAnswersDto {
  @IsString()
  applicationId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FollowUpAnswerDto)
  answers!: FollowUpAnswerDto[];

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
