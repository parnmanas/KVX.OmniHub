import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Equipment, EquipmentFunction } from "../../entities";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateEquipmentDto } from "./dto/create-equipment.dto";
import { UpdateEquipmentDto } from "./dto/update-equipment.dto";
import {
  CreateFunctionDto,
  UpdateFunctionDto,
} from "./dto/function.dto";
import { EquipmentsService } from "./equipments.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class EquipmentsController {
  constructor(private readonly service: EquipmentsService) {}

  // ---------- equipments ----------

  @Get("equipments")
  list(@Query("storeId") storeId?: string): Promise<Equipment[]> {
    return this.service.list(storeId);
  }

  @Get("equipments/:id")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<Equipment> {
    return this.service.get(id);
  }

  @Post("equipments")
  create(@Body() dto: CreateEquipmentDto): Promise<Equipment> {
    return this.service.create(dto);
  }

  @Patch("equipments/:id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateEquipmentDto,
  ): Promise<Equipment> {
    return this.service.update(id, dto);
  }

  @Delete("equipments/:id")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  // ---------- functions (nested) ----------

  @Get("equipments/:id/functions")
  listFunctions(
    @Param("id", ParseUUIDPipe) equipmentId: string,
  ): Promise<EquipmentFunction[]> {
    return this.service.listFunctions(equipmentId);
  }

  @Post("equipments/:id/functions")
  createFunction(
    @Param("id", ParseUUIDPipe) equipmentId: string,
    @Body() dto: CreateFunctionDto,
  ): Promise<EquipmentFunction> {
    return this.service.createFunction(equipmentId, dto);
  }

  @Patch("functions/:id")
  updateFunction(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateFunctionDto,
  ): Promise<EquipmentFunction> {
    return this.service.updateFunction(id, dto);
  }

  @Delete("functions/:id")
  @HttpCode(204)
  removeFunction(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.removeFunction(id);
  }

  // ---------- IR record / play ----------

  @Post("functions/:id/record")
  recordFunction(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { timeoutMs?: number },
  ): Promise<EquipmentFunction> {
    return this.service.recordFunction(id, body?.timeoutMs);
  }

  @Post("functions/:id/play")
  @HttpCode(204)
  playFunction(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.playFunction(id);
  }
}
