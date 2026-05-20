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
  UseGuards,
} from "@nestjs/common";
import { Location } from "../../entities";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateLocationDto } from "./dto/create-location.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { LocationsService } from "./locations.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @Get("stores/:storeId/locations")
  listForStore(
    @Param("storeId", ParseUUIDPipe) storeId: string,
  ): Promise<Location[]> {
    return this.service.listForStore(storeId);
  }

  @Post("stores/:storeId/locations")
  create(
    @Param("storeId", ParseUUIDPipe) storeId: string,
    @Body() dto: CreateLocationDto,
  ): Promise<Location> {
    return this.service.create(storeId, dto);
  }

  @Get("locations/:id")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<Location> {
    return this.service.get(id);
  }

  @Patch("locations/:id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<Location> {
    return this.service.update(id, dto);
  }

  @Delete("locations/:id")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
