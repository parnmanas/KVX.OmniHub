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
import { Store } from "../../entities";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateStoreDto } from "./dto/create-store.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";
import { StoresService } from "./stores.service";

@Controller("stores")
@UseGuards(JwtAuthGuard)
export class StoresController {
  constructor(private readonly service: StoresService) {}

  @Get()
  list(): Promise<Store[]> {
    return this.service.list();
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<Store> {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: CreateStoreDto): Promise<Store> {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoreDto,
  ): Promise<Store> {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
