import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

export class PairDto {
  @Matches(/^[A-Za-z0-9]{4,10}$/, {
    message: "pairingCode must be 4-10 alphanumeric characters",
  })
  pairingCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}
