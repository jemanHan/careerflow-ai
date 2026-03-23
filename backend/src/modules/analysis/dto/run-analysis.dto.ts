import { IsBoolean, IsInt, IsOptional } from "class-validator";

export class RunAnalysisDto {
  @IsInt()
  applicationId!: number;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
