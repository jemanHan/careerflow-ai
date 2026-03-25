import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateApplicationMetaDto {
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: "워크플로우 이름은 60자 이하여야 합니다." })
  title?: string;

  @IsOptional()
  @IsObject({ message: "면접 메모는 객체 형태여야 합니다." })
  interviewNotesJson?: Record<string, string>;
}

