import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { EquipmentType } from "@omnihub/shared";

const EQUIPMENT_TYPES = Object.values(EquipmentType);

export class CreateTemplateDto {
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
  @IsBoolean()
  isPublic?: boolean;
}
