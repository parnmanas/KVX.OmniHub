import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Location, Store } from "../../entities";
import type { CreateLocationDto } from "./dto/create-location.dto";
import type { UpdateLocationDto } from "./dto/update-location.dto";

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly repo: Repository<Location>,
    @InjectRepository(Store)
    private readonly stores: Repository<Store>,
  ) {}

  listForStore(storeId: string): Promise<Location[]> {
    return this.repo.find({
      where: { storeId },
      order: { createdAt: "ASC" },
      relations: { equipments: true, devices: true },
    });
  }

  listAll(): Promise<Location[]> {
    return this.repo.find({
      order: { storeId: "ASC", createdAt: "ASC" },
      relations: { store: true },
    });
  }

  async get(id: string): Promise<Location> {
    const location = await this.repo.findOne({
      where: { id },
      relations: {
        store: true,
        equipments: { omnihub: true },
        devices: true,
      },
    });
    if (!location) throw new NotFoundException(`location not found: ${id}`);
    return location;
  }

  async create(storeId: string, dto: CreateLocationDto): Promise<Location> {
    const storeExists = await this.stores.exists({ where: { id: storeId } });
    if (!storeExists) {
      throw new BadRequestException(`store not found: ${storeId}`);
    }
    return this.repo.save(
      this.repo.create({
        storeId,
        name: dto.name,
      }),
    );
  }

  async update(id: string, dto: UpdateLocationDto): Promise<Location> {
    const location = await this.repo.findOne({ where: { id } });
    if (!location) throw new NotFoundException(`location not found: ${id}`);
    if (dto.name !== undefined) location.name = dto.name;
    return this.repo.save(location);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`location not found: ${id}`);
    }
  }
}
