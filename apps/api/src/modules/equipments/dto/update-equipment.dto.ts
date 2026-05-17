import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { EquipmentType } from "@omnihub/shared";

const EQUIPMENT_TYPES = Object.values(EquipmentType);

export class UpdateEquipmentDto {
  @IsOptional()
  @IsIn(EQUIPMENT_TYPES)
  type?: EquipmentType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  // null clears, undefined leaves unchanged
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsUUID()
  omnihubId?: string | null;
}
