import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PresetsService } from "./presets.service";
import type { IrPreset, IrPresetSummary } from "./presets.types";

@Controller("presets")
@UseGuards(JwtAuthGuard)
export class PresetsController {
  constructor(private readonly service: PresetsService) {}

  /** Browse the catalog. Returns one summary per preset file. */
  @Get()
  list(): IrPresetSummary[] {
    return this.service.list();
  }

  /** Full preset (all commands) for a given name (e.g. "lg-tv"). */
  @Get(":name")
  get(@Param("name") name: string): IrPreset {
    return this.service.get(name);
  }
}
