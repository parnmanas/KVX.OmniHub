import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ControlLog,
  Equipment,
  EquipmentFunction,
  OmniHubDevice,
  Store,
} from "../../entities";
import { OmnihubGateway } from "../../gateways/omnihub.gateway";
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
    @InjectRepository(ControlLog)
    private readonly controlLogs: Repository<ControlLog>,
    private readonly gateway: OmnihubGateway,
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

  // ---------- IR record / play ----------

  async recordFunction(
    id: string,
    timeoutMs?: number,
  ): Promise<EquipmentFunction> {
    const fn = await this.functions.findOne({ where: { id } });
    if (!fn) throw new NotFoundException(`function not found: ${id}`);
    if (fn.controlType !== "IR") {
      throw new BadRequestException("only IR functions can be recorded");
    }
    const omnihubId = await this.requireOmnihubForFunction(fn);

    let learned;
    try {
      learned = await this.gateway.requestIrLearn(omnihubId, timeoutMs);
    } catch (err) {
      await this.logControl(fn, "fail", (err as Error).message);
      const msg = (err as Error).message;
      if (msg === "omnihub offline") {
        throw new ServiceUnavailableException(msg);
      }
      if (msg === "learn timeout") {
        await this.logControl(fn, "timeout", msg);
        throw new ServiceUnavailableException(msg);
      }
      throw new ServiceUnavailableException(msg);
    }

    fn.payload = { controlType: "IR", data: learned };
    const saved = await this.functions.save(fn);
    await this.logControl(saved, "success", null);
    return saved;
  }

  async playFunction(id: string): Promise<void> {
    const fn = await this.functions.findOne({ where: { id } });
    if (!fn) throw new NotFoundException(`function not found: ${id}`);
    if (fn.controlType !== "IR") {
      throw new BadRequestException("only IR functions are playable yet");
    }
    if (fn.payload.controlType !== "IR") {
      throw new BadRequestException("function payload is not IR");
    }
    const ir = fn.payload.data;
    const hasDecoded = ir.decoded !== null;
    const hasRaw = Array.isArray(ir.raw) && ir.raw.length > 0;
    if (!hasDecoded && !hasRaw) {
      throw new BadRequestException(
        "function has no recorded IR signal — record it first",
      );
    }
    const omnihubId = await this.requireOmnihubForFunction(fn);

    try {
      await this.gateway.requestIrSend(omnihubId, ir);
      await this.logControl(fn, "success", null);
    } catch (err) {
      const msg = (err as Error).message;
      const result = msg.includes("timeout") ? "timeout" : "fail";
      await this.logControl(fn, result, msg);
      throw new ServiceUnavailableException(msg);
    }
  }

  private async requireOmnihubForFunction(
    fn: EquipmentFunction,
  ): Promise<string> {
    const eq = await this.equipments.findOne({ where: { id: fn.equipmentId } });
    if (!eq) {
      throw new NotFoundException(`equipment not found: ${fn.equipmentId}`);
    }
    if (!eq.omnihubId) {
      throw new BadRequestException(
        "equipment has no OmniHub assigned — assign one first",
      );
    }
    return eq.omnihubId;
  }

  private async logControl(
    fn: EquipmentFunction,
    result: "success" | "fail" | "timeout",
    errorMessage: string | null,
  ): Promise<void> {
    await this.controlLogs.save(
      this.controlLogs.create({
        equipmentId: fn.equipmentId,
        functionId: fn.id,
        triggeredBy: "user",
        result,
        errorMessage,
      }),
    );
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
