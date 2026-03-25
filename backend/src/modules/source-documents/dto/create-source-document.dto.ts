import { IsArray, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateSourceDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: "워크플로우 이름은 60자 이하여야 합니다." })
  title?: string;

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
