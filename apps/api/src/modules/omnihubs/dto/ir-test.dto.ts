import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { IrProtocol } from "@omnihub/shared";

class IrDecodedDto {
  @Matches(/^[0-9a-fA-F]{1,16}$/, {
    message: "value must be a hex string (1–16 chars)",
  })
  value!: string;

  @IsInt()
  @Min(1)
  @Max(64)
  bits!: number;
}

class IrPayloadDto {
  @IsEnum(IrProtocol)
  protocol!: IrProtocol;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => IrDecodedDto)
  decoded!: IrDecodedDto | null;

  @IsArray()
  @ArrayMaxSize(800)
  @IsInt({ each: true })
  raw!: number[];
}

export class IrTestDto {
  @IsObject()
  @ValidateNested()
  @Type(() => IrPayloadDto)
  payload!: IrPayloadDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  repeat?: number;
}
