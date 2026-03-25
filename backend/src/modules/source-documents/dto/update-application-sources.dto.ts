import { IsArray, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateApplicationSourcesDto {
  @IsOptional()
  @IsString()
  @MinLength(20, { message: "이력서 텍스트는 20자 이상이어야 합니다." })
  resumeText?: string;

  @IsOptional()
  @IsString()
  @MinLength(20, { message: "포트폴리오 텍스트는 20자 이상이어야 합니다." })
  portfolioText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  projectDescriptions?: string[];

  @IsOptional()
  @IsString()
  @MinLength(20, { message: "채용공고 텍스트는 20자 이상이어야 합니다." })
  targetJobPostingText?: string;
}
