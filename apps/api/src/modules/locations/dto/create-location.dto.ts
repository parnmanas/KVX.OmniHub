import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class CreateLocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  // Default OmniHub for this location. Used when an equipment under this
  // location has no hub assigned. null clears, undefined leaves unchanged.
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsUUID()
  omnihubId?: string | null;
}
