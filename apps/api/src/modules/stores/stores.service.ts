import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Store } from "../../entities";
import type { CreateStoreDto } from "./dto/create-store.dto";
import type { UpdateStoreDto } from "./dto/update-store.dto";

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store)
    private readonly repo: Repository<Store>,
  ) {}

  list(): Promise<Store[]> {
    return this.repo.find({
      order: { createdAt: "ASC" },
      relations: { omnihub: true },
    });
  }

  async get(id: string): Promise<Store> {
    const store = await this.repo.findOne({
      where: { id },
      relations: { devices: true, locations: true, omnihub: true },
    });
    if (!store) throw new NotFoundException(`store not found: ${id}`);
    return store;
  }

  create(dto: CreateStoreDto): Promise<Store> {
    return this.repo.save(this.repo.create({
      name: dto.name,
      address: dto.address ?? null,
      phone: dto.phone ?? null,
      omnihubId: dto.omnihubId ?? null,
    }));
  }

  async update(id: string, dto: UpdateStoreDto): Promise<Store> {
    const store = await this.repo.findOne({ where: { id } });
    if (!store) throw new NotFoundException(`store not found: ${id}`);
    if (dto.name !== undefined) store.name = dto.name;
    if (dto.address !== undefined) store.address = dto.address ?? null;
    if (dto.phone !== undefined) store.phone = dto.phone ?? null;
    if (dto.omnihubId !== undefined) store.omnihubId = dto.omnihubId;
    return this.repo.save(store);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException(`store not found: ${id}`);
  }
}
