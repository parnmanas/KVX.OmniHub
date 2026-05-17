import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { OmniHubDevice } from "../../entities";
import { DeviceRegistry } from "../../gateways/device-registry.service";
import { OmnihubGateway } from "../../gateways/omnihub.gateway";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateOmnihubDto } from "./dto/create-omnihub.dto";
import { PairDto } from "./dto/pair.dto";
import { UpdateOmnihubDto } from "./dto/update-omnihub.dto";
import { OmnihubsService } from "./omnihubs.service";

export interface PendingPairingRow {
  pairingCode: string;
  deviceId: string;
  waitingSeconds: number;
}

export interface PairResponse {
  id: string;
  deviceId: string;
  name: string | null;
  storeId: string | null;
  status: string;
}

@Controller("omnihubs")
@UseGuards(JwtAuthGuard)
export class OmnihubsController {
  constructor(
    private readonly service: OmnihubsService,
    private readonly registry: DeviceRegistry,
    private readonly gateway: OmnihubGateway,
  ) {}

  @Get()
  list(): Promise<OmniHubDevice[]> {
    return this.service.list();
  }

  @Get("pending")
  listPending(): PendingPairingRow[] {
    const now = Date.now();
    return this.registry.listPending().map((p) => ({
      pairingCode: p.pairingCode,
      deviceId: p.deviceId,
      waitingSeconds: Math.floor((now - p.createdAt) / 1000),
    }));
  }

  @Post("pair")
  async pair(@Body() dto: PairDto): Promise<PairResponse> {
    try {
      const { device } = await this.gateway.claimPairing(dto.pairingCode, {
        storeId: dto.storeId ?? null,
        name: dto.name ?? null,
      });
      return {
        id: device.id,
        deviceId: device.deviceId,
        name: device.name,
        storeId: device.storeId,
        status: device.status,
      };
    } catch (err) {
      const code = (err as Error).message;
      if (code === "PAIRING_NOT_FOUND") {
        throw new NotFoundException(
          "no device is waiting with that pairing code",
        );
      }
      if (code === "DEVICE_ROW_MISSING") {
        throw new BadRequestException(
          "device row missing, retry pairing from device",
        );
      }
      throw err;
    }
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<OmniHubDevice> {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: CreateOmnihubDto): Promise<OmniHubDevice> {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateOmnihubDto,
  ): Promise<OmniHubDevice> {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
