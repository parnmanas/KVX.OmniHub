import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class FromPresetDto {
  @IsUUID()
  locationId!: string;

  /**
   * Preset basename (e.g. "lg-tv", "samsung-tv"). Must match a file in
   * tools/ir-presets/. Constrained to filesystem-safe characters since this
   * eventually resolves to a path inside the presets dir.
   */
  @Matches(/^[a-z0-9][a-z0-9_-]{0,63}$/, {
    message:
      "preset must be lowercase letters, digits, hyphens, underscores (e.g. 'lg-tv')",
  })
  preset!: string;

  /** Display name for the new equipment. Defaults to "{brand} {device}" if omitted. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUUID()
  omnihubId?: string;
}
