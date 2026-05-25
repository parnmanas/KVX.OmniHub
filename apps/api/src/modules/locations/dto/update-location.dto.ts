import { PartialType } from "@nestjs/mapped-types";
import { CreateLocationDto } from "./create-location.dto";

// Inherits name + omnihubId from CreateLocationDto, all optional.
export class UpdateLocationDto extends PartialType(CreateLocationDto) {}
