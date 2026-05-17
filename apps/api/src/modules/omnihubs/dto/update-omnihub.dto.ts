import { IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from "class-validator";

export class UpdateOmnihubDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  // null clears the assignment; undefined leaves it unchanged
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsUUID()
  storeId?: string | null;
}
