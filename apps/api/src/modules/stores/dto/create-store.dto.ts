import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class CreateStoreDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  // Default OmniHub for this store. null clears, undefined leaves unchanged.
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsUUID()
  omnihubId?: string | null;
}
