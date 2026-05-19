import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ControlType, type FunctionPayload } from "@omnihub/shared";

const CONTROL_TYPES = Object.values(ControlType);

export class CreateTemplateFunctionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsIn(CONTROL_TYPES)
  controlType!: ControlType;

  @IsObject()
  payload!: FunctionPayload;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateTemplateFunctionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsIn(CONTROL_TYPES)
  controlType?: ControlType;

  @IsOptional()
  @IsObject()
  payload?: FunctionPayload;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class InstantiateTemplateDto {
  @IsString()
  storeId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  omnihubId?: string;
}

export class RecordTemplateFunctionDto {
  @IsString()
  omnihubId!: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  timeoutMs?: number;
}
