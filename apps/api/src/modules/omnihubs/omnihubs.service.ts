import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Location, OmniHubDevice, Store } from "../../entities";
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
    @InjectRepository(Location)
    private readonly locations: Repository<Location>,
  ) {}

  list(): Promise<OmniHubDevice[]> {
    return this.devices.find({
      order: { createdAt: "ASC" },
      relations: { store: true, location: true, equipments: true },
    });
  }

  async get(id: string): Promise<OmniHubDevice> {
    const device = await this.devices.findOne({
      where: { id },
      relations: { store: true, location: true, equipments: true },
    });
    if (!device) throw new NotFoundException(`omnihub not found: ${id}`);
    return device;
  }

  /** Look up a location's store. Throws if location missing. */
  private async storeIdForLocation(locationId: string): Promise<string> {
    const loc = await this.locations.findOne({ where: { id: locationId } });
    if (!loc) {
      throw new BadRequestException(`location not found: ${locationId}`);
    }
    return loc.storeId;
  }

  async create(dto: CreateOmnihubDto): Promise<OmniHubDevice> {
    const deviceId = normalizeMac(dto.deviceId);
    const existing = await this.devices.findOne({ where: { deviceId } });
    if (existing) {
      throw new ConflictException(`deviceId already registered: ${deviceId}`);
    }
    let storeId = dto.storeId ?? null;
    let locationId = dto.locationId ?? null;
    if (locationId) {
      storeId = await this.storeIdForLocation(locationId);
    } else if (storeId) {
      const storeExists = await this.stores.exists({ where: { id: storeId } });
      if (!storeExists) {
        throw new BadRequestException(`store not found: ${storeId}`);
      }
    }
    return this.devices.save(
      this.devices.create({
        deviceId,
        name: dto.name ?? null,
        storeId,
        locationId,
        status: "offline",
      }),
    );
  }

  async update(id: string, dto: UpdateOmnihubDto): Promise<OmniHubDevice> {
    const device = await this.devices.findOne({ where: { id } });
    if (!device) throw new NotFoundException(`omnihub not found: ${id}`);
    if (dto.name !== undefined) device.name = dto.name ?? null;

    // Location wins: setting locationId auto-syncs storeId from its store.
    // Clearing locationId leaves the existing storeId alone (the caller can
    // also touch storeId in the same patch to override).
    if (dto.locationId !== undefined) {
      if (dto.locationId !== null) {
        device.storeId = await this.storeIdForLocation(dto.locationId);
      }
      device.locationId = dto.locationId;
    }

    if (dto.storeId !== undefined) {
      if (dto.storeId !== null) {
        const storeExists = await this.stores.exists({
          where: { id: dto.storeId },
        });
        if (!storeExists) {
          throw new BadRequestException(`store not found: ${dto.storeId}`);
        }
      }
      // If the new store no longer matches the current location's store,
      // drop the location to preserve the invariant.
      if (
        device.locationId &&
        dto.locationId === undefined &&
        dto.storeId !== null
      ) {
        const stillMatches = await this.locations.exists({
          where: { id: device.locationId, storeId: dto.storeId },
        });
        if (!stillMatches) device.locationId = null;
      }
      if (dto.storeId === null) {
        // No store → no location either.
        device.locationId = null;
      }
      device.storeId = dto.storeId;
    }
    return this.devices.save(device);
  }

  async remove(id: string): Promise<void> {
    // Equipment.omnihub has onDelete: SET NULL — referencing equipments
    // automatically detach when this row is deleted, so a bare delete is safe.
    const result = await this.devices.delete(id);
    if (!result.affected) throw new NotFoundException(`omnihub not found: ${id}`);
  }
}
