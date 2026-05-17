import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import {
  Equipment,
  EquipmentFunction,
  EquipmentTemplate,
  OmniHubDevice,
  Store,
  TemplateFunction,
} from "../../entities";
import type { CreateTemplateDto } from "./dto/create-template.dto";
import type {
  CreateTemplateFunctionDto,
  InstantiateTemplateDto,
  UpdateTemplateFunctionDto,
} from "./dto/template-function.dto";
import type { UpdateTemplateDto } from "./dto/update-template.dto";

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(EquipmentTemplate)
    private readonly templates: Repository<EquipmentTemplate>,
    @InjectRepository(TemplateFunction)
    private readonly templateFunctions: Repository<TemplateFunction>,
    @InjectRepository(Equipment)
    private readonly equipments: Repository<Equipment>,
    @InjectRepository(EquipmentFunction)
    private readonly equipmentFunctions: Repository<EquipmentFunction>,
    @InjectRepository(Store)
    private readonly stores: Repository<Store>,
    @InjectRepository(OmniHubDevice)
    private readonly devices: Repository<OmniHubDevice>,
    private readonly dataSource: DataSource,
  ) {}

  // ---------- templates ----------

  list(): Promise<EquipmentTemplate[]> {
    return this.templates.find({
      order: { type: "ASC", manufacturer: "ASC", model: "ASC" },
      relations: { functions: true },
    });
  }

  async get(id: string): Promise<EquipmentTemplate> {
    const tpl = await this.templates.findOne({
      where: { id },
      relations: { functions: true },
    });
    if (!tpl) throw new NotFoundException(`template not found: ${id}`);
    return tpl;
  }

  create(dto: CreateTemplateDto): Promise<EquipmentTemplate> {
    return this.templates.save(
      this.templates.create({
        type: dto.type,
        manufacturer: dto.manufacturer,
        model: dto.model,
        name: dto.name,
        isPublic: dto.isPublic ?? true,
      }),
    );
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<EquipmentTemplate> {
    const tpl = await this.templates.findOne({ where: { id } });
    if (!tpl) throw new NotFoundException(`template not found: ${id}`);
    if (dto.type !== undefined) tpl.type = dto.type;
    if (dto.manufacturer !== undefined) tpl.manufacturer = dto.manufacturer;
    if (dto.model !== undefined) tpl.model = dto.model;
    if (dto.name !== undefined) tpl.name = dto.name;
    if (dto.isPublic !== undefined) tpl.isPublic = dto.isPublic;
    return this.templates.save(tpl);
  }

  async remove(id: string): Promise<void> {
    const result = await this.templates.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`template not found: ${id}`);
    }
  }

  // ---------- template functions ----------

  listFunctions(templateId: string): Promise<TemplateFunction[]> {
    return this.templateFunctions.find({
      where: { templateId },
      order: { order: "ASC" },
    });
  }

  async createFunction(
    templateId: string,
    dto: CreateTemplateFunctionDto,
  ): Promise<TemplateFunction> {
    const exists = await this.templates.exists({ where: { id: templateId } });
    if (!exists) {
      throw new NotFoundException(`template not found: ${templateId}`);
    }
    if (dto.payload.controlType !== dto.controlType) {
      throw new BadRequestException(
        "payload.controlType must match controlType",
      );
    }
    return this.templateFunctions.save(
      this.templateFunctions.create({
        templateId,
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
    dto: UpdateTemplateFunctionDto,
  ): Promise<TemplateFunction> {
    const fn = await this.templateFunctions.findOne({ where: { id } });
    if (!fn) throw new NotFoundException(`template function not found: ${id}`);
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
    return this.templateFunctions.save(fn);
  }

  async removeFunction(id: string): Promise<void> {
    const result = await this.templateFunctions.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`template function not found: ${id}`);
    }
  }

  // ---------- instantiate ----------

  async instantiate(
    templateId: string,
    dto: InstantiateTemplateDto,
  ): Promise<Equipment> {
    const tpl = await this.templates.findOne({
      where: { id: templateId },
      relations: { functions: true },
    });
    if (!tpl) throw new NotFoundException(`template not found: ${templateId}`);

    const storeExists = await this.stores.exists({
      where: { id: dto.storeId },
    });
    if (!storeExists) {
      throw new BadRequestException(`store not found: ${dto.storeId}`);
    }

    if (dto.omnihubId) {
      const device = await this.devices.findOne({
        where: { id: dto.omnihubId },
        relations: { equipment: true },
      });
      if (!device) {
        throw new BadRequestException(`omnihub not found: ${dto.omnihubId}`);
      }
      if (device.equipment) {
        throw new ConflictException(
          `omnihub already assigned to equipment ${device.equipment.id}`,
        );
      }
    }

    return this.dataSource.transaction(async (trx) => {
      const eq = await trx.save(
        trx.create(Equipment, {
          storeId: dto.storeId,
          type: tpl.type,
          manufacturer: tpl.manufacturer,
          model: tpl.model,
          name: dto.name,
          omnihubId: dto.omnihubId ?? null,
        }),
      );

      if (tpl.functions && tpl.functions.length > 0) {
        const fns = tpl.functions.map((f) =>
          trx.create(EquipmentFunction, {
            equipmentId: eq.id,
            name: f.name,
            icon: f.icon,
            controlType: f.controlType,
            payload: f.payload,
            order: f.order,
          }),
        );
        await trx.save(fns);
      }

      const reloaded = await trx.findOne(Equipment, {
        where: { id: eq.id },
        relations: { functions: true, omnihub: true },
      });
      return reloaded ?? eq;
    });
  }
}
