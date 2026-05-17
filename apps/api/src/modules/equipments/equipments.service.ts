import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Equipment,
  EquipmentFunction,
  OmniHubDevice,
  Store,
} from "../../entities";
import type { CreateEquipmentDto } from "./dto/create-equipment.dto";
import type { UpdateEquipmentDto } from "./dto/update-equipment.dto";
import type {
  CreateFunctionDto,
  UpdateFunctionDto,
} from "./dto/function.dto";

@Injectable()
export class EquipmentsService {
  constructor(
    @InjectRepository(Equipment)
    private readonly equipments: Repository<Equipment>,
    @InjectRepository(EquipmentFunction)
    private readonly functions: Repository<EquipmentFunction>,
    @InjectRepository(Store)
    private readonly stores: Repository<Store>,
    @InjectRepository(OmniHubDevice)
    private readonly devices: Repository<OmniHubDevice>,
  ) {}

  // ---------- equipments ----------

  list(storeId?: string): Promise<Equipment[]> {
    return this.equipments.find({
      where: storeId ? { storeId } : {},
      order: { createdAt: "ASC" },
      relations: { omnihub: true, functions: true },
    });
  }

  async get(id: string): Promise<Equipment> {
    const eq = await this.equipments.findOne({
      where: { id },
      relations: { store: true, omnihub: true, functions: true },
    });
    if (!eq) throw new NotFoundException(`equipment not found: ${id}`);
    return eq;
  }

  async create(dto: CreateEquipmentDto): Promise<Equipment> {
    const storeExists = await this.stores.exists({
      where: { id: dto.storeId },
    });
    if (!storeExists) {
      throw new BadRequestException(`store not found: ${dto.storeId}`);
    }
    if (dto.omnihubId) {
      await this.assertOmnihubAvailable(dto.omnihubId, null);
    }
    return this.equipments.save(
      this.equipments.create({
        storeId: dto.storeId,
        type: dto.type,
        manufacturer: dto.manufacturer,
        model: dto.model,
        name: dto.name,
        omnihubId: dto.omnihubId ?? null,
      }),
    );
  }

  async update(id: string, dto: UpdateEquipmentDto): Promise<Equipment> {
    const eq = await this.equipments.findOne({ where: { id } });
    if (!eq) throw new NotFoundException(`equipment not found: ${id}`);
    if (dto.type !== undefined) eq.type = dto.type;
    if (dto.manufacturer !== undefined) eq.manufacturer = dto.manufacturer;
    if (dto.model !== undefined) eq.model = dto.model;
    if (dto.name !== undefined) eq.name = dto.name;
    if (dto.omnihubId !== undefined) {
      if (dto.omnihubId !== null) {
        await this.assertOmnihubAvailable(dto.omnihubId, id);
      }
      eq.omnihubId = dto.omnihubId;
    }
    return this.equipments.save(eq);
  }

  async remove(id: string): Promise<void> {
    const result = await this.equipments.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`equipment not found: ${id}`);
    }
  }

  // ---------- functions ----------

  listFunctions(equipmentId: string): Promise<EquipmentFunction[]> {
    return this.functions.find({
      where: { equipmentId },
      order: { order: "ASC", createdAt: "ASC" },
    });
  }

  async createFunction(
    equipmentId: string,
    dto: CreateFunctionDto,
  ): Promise<EquipmentFunction> {
    const eqExists = await this.equipments.exists({
      where: { id: equipmentId },
    });
    if (!eqExists) {
      throw new NotFoundException(`equipment not found: ${equipmentId}`);
    }
    if (dto.payload.controlType !== dto.controlType) {
      throw new BadRequestException(
        "payload.controlType must match controlType",
      );
    }
    return this.functions.save(
      this.functions.create({
        equipmentId,
        name: dto.name,
        icon: dto.icon ?? null,
        controlType: dto.controlType,
        payload: dto.payload,
        order: dto.order ?? 0,
      }),
    );
  }

  async updateFunction(
    id: string,
    dto: UpdateFunctionDto,
  ): Promise<EquipmentFunction> {
    const fn = await this.functions.findOne({ where: { id } });
    if (!fn) throw new NotFoundException(`function not found: ${id}`);
    if (dto.name !== undefined) fn.name = dto.name;
    if (dto.icon !== undefined) fn.icon = dto.icon ?? null;
    if (dto.controlType !== undefined) fn.controlType = dto.controlType;
    if (dto.payload !== undefined) fn.payload = dto.payload;
    if (dto.order !== undefined) fn.order = dto.order;
    if (
      dto.payload &&
      dto.controlType &&
      dto.payload.controlType !== dto.controlType
    ) {
      throw new BadRequestException(
        "payload.controlType must match controlType",
      );
    }
    return this.functions.save(fn);
  }

  async removeFunction(id: string): Promise<void> {
    const result = await this.functions.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`function not found: ${id}`);
    }
  }

  // ---------- helpers ----------

  private async assertOmnihubAvailable(
    omnihubId: string,
    selfEquipmentId: string | null,
  ): Promise<void> {
    const device = await this.devices.findOne({
      where: { id: omnihubId },
      relations: { equipment: true },
    });
    if (!device) {
      throw new BadRequestException(`omnihub not found: ${omnihubId}`);
    }
    if (device.equipment && device.equipment.id !== selfEquipmentId) {
      throw new ConflictException(
        `omnihub already assigned to equipment ${device.equipment.id}`,
      );
    }
  }
}
