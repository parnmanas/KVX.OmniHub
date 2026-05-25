import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OmniHubDevice, Store } from "../../entities";
import type { CreateOmnihubDto } from "./dto/create-omnihub.dto";
import type { UpdateOmnihubDto } from "./dto/update-omnihub.dto";

function normalizeMac(raw: string): string {
  return raw.replace(/-/g, ":").toUpperCase();
}

@Injectable()
export class OmnihubsService {
  constructor(
    @InjectRepository(OmniHubDevice)
    private readonly devices: Repository<OmniHubDevice>,
    @InjectRepository(Store)
    private readonly stores: Repository<Store>,
  ) {}

  list(): Promise<OmniHubDevice[]> {
    return this.devices.find({
      order: { createdAt: "ASC" },
      relations: { store: true, equipments: true },
    });
  }

  async get(id: string): Promise<OmniHubDevice> {
    const device = await this.devices.findOne({
      where: { id },
      relations: { store: true, equipments: true },
    });
    if (!device) throw new NotFoundException(`omnihub not found: ${id}`);
    return device;
  }

  async create(dto: CreateOmnihubDto): Promise<OmniHubDevice> {
    const deviceId = normalizeMac(dto.deviceId);
    const existing = await this.devices.findOne({ where: { deviceId } });
    if (existing) {
      throw new ConflictException(`deviceId already registered: ${deviceId}`);
    }
    if (dto.storeId) {
      const storeExists = await this.stores.exists({
        where: { id: dto.storeId },
      });
      if (!storeExists) {
        throw new BadRequestException(`store not found: ${dto.storeId}`);
      }
    }
    return this.devices.save(
      this.devices.create({
        deviceId,
        name: dto.name ?? null,
        storeId: dto.storeId ?? null,
        status: "offline",
      }),
    );
  }

  async update(id: string, dto: UpdateOmnihubDto): Promise<OmniHubDevice> {
    const device = await this.devices.findOne({ where: { id } });
    if (!device) throw new NotFoundException(`omnihub not found: ${id}`);
    if (dto.name !== undefined) device.name = dto.name ?? null;
    if (dto.storeId !== undefined) {
      if (dto.storeId !== null) {
        const storeExists = await this.stores.exists({
          where: { id: dto.storeId },
        });
        if (!storeExists) {
          throw new BadRequestException(`store not found: ${dto.storeId}`);
        }
      }
      device.storeId = dto.storeId;
    }
    return this.devices.save(device);
  }

  async remove(id: string): Promise<void> {
    const result = await this.devices.delete(id);
    if (!result.affected) throw new NotFoundException(`omnihub not found: ${id}`);
  }
}
