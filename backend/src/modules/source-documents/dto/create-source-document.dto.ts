import { IsArray, IsOptional, IsString, MinLength } from "class-validator";

export class CreateSourceDocumentDto {
  @IsString()
  @MinLength(20)
  resumeText!: string;

  @IsString()
  @MinLength(20)
  portfolioText!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  projectDescriptions?: string[];

  @IsString()
  @MinLength(20)
  targetJobPostingText!: string;

  @IsOptional()
  @IsString()
  testUserId?: string;
}
