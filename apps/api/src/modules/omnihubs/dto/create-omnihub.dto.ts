import { IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";

export class CreateOmnihubDto {
  // MAC address style, case-insensitive, separators : or - allowed
  @Matches(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/, {
    message: "deviceId must look like AA:BB:CC:DD:EE:FF",
  })
  deviceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  // Pinning a location auto-derives storeId (hub physically lives at the
  // location's store). Leave undefined for "store-only" placement.
  @IsOptional()
  @IsUUID()
  locationId?: string;
}
