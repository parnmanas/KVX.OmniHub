import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { EquipmentType } from "@omnihub/shared";

const EQUIPMENT_TYPES = Object.values(EquipmentType);

export class CreateEquipmentDto {
  @IsUUID()
  storeId!: string;

  @IsIn(EQUIPMENT_TYPES)
  type!: EquipmentType;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  manufacturer!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  model!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsUUID()
  omnihubId?: string;
}
