import { IsBoolean, IsOptional, IsString } from "class-validator";

export class GenerateDocumentsDto {
  @IsString()
  applicationId!: string;

  @IsOptional()
  @IsBoolean()
  rewriteForJob?: boolean;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
