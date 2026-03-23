import { IsBoolean, IsOptional, IsString } from "class-validator";

export class GenerateInterviewQuestionsDto {
  @IsString()
  applicationId!: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
