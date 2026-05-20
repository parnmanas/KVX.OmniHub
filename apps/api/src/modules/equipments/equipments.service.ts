import { createSocket } from "node:dgram";
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
  Location,
  OmniHubDevice,
} from "../../entities";
import { OmnihubGateway } from "../../gateways/omnihub.gateway";
import { PresetsService } from "../presets/presets.service";
import type { CreateEquipmentDto } from "./dto/create-equipment.dto";
import type { FromPresetDto } from "./dto/from-preset.dto";
import type { UpdateEquipmentDto } from "./dto/update-equipment.dto";
import type {
  CreateFunctionDto,
  UpdateFunctionDto,
} from "./dto/function.dto";
import type { EquipmentType } from "@omnihub/shared";

// Hard ceiling for HTTP_API outbound calls. Local IoT (Hue/Shelly/Tasmota)
// always responds in <1s; cloud APIs (Tuya/SmartThings) usually <3s. 10s
// covers both with margin while bounding worst-case latency.
const HTTP_API_TIMEOUT_MS = 10_000;

/**
 * Map preset.device strings to our EquipmentType enum. Unknown devices
 * (soundbars, set-top boxes, etc. — anything not in the enum yet) fall back
 * to OTHER. When the enum grows, just add the case here.
 */
function mapDeviceToType(device: string): EquipmentType {
  const upper = device.toUpperCase();
  switch (upper) {
    case "TV":
    case "PROJECTOR":
    case "AC":
    case "LIGHT":
    case "DOOR_LOCK":
    case "PC":
      return upper as EquipmentType;
    default:
      return "OTHER" as EquipmentType;
  }
}

@Injectable()
export class EquipmentsService {
  constructor(
    @InjectRepository(Equipment)
    private readonly equipments: Repository<Equipment>,
    @InjectRepository(EquipmentFunction)
    private readonly functions: Repository<EquipmentFunction>,
    @InjectRepository(Location)
    private readonly locations: Repository<Location>,
    @InjectRepository(OmniHubDevice)
    private readonly devices: Repository<OmniHubDevice>,
    @InjectRepository(ControlLog)
    private readonly controlLogs: Repository<ControlLog>,
    private readonly gateway: OmnihubGateway,
    private readonly presets: PresetsService,
  ) {}

  // ---------- equipments ----------

  list(locationId?: string, storeId?: string): Promise<Equipment[]> {
    if (locationId) {
      return this.equipments.find({
        where: { locationId },
        order: { createdAt: "ASC" },
        relations: { omnihub: true, functions: true },
      });
    }
    if (storeId) {
      // All equipments across all locations of this store.
      return this.equipments
        .createQueryBuilder("eq")
        .leftJoinAndSelect("eq.omnihub", "omnihub")
        .leftJoinAndSelect("eq.functions", "functions")
        .leftJoin("eq.location", "location")
        .where("location.storeId = :storeId", { storeId })
        .orderBy("eq.createdAt", "ASC")
        .getMany();
    }
    return this.equipments.find({
      order: { createdAt: "ASC" },
      relations: { omnihub: true, functions: true },
    });
  }

  async get(id: string): Promise<Equipment> {
    const eq = await this.equipments.findOne({
      where: { id },
      relations: {
        location: { store: true },
        omnihub: true,
        functions: true,
      },
    });
    if (!eq) throw new NotFoundException(`equipment not found: ${id}`);
    return eq;
  }

  async create(dto: CreateEquipmentDto): Promise<Equipment> {
    const locationExists = await this.locations.exists({
      where: { id: dto.locationId },
    });
    if (!locationExists) {
      throw new BadRequestException(`location not found: ${dto.locationId}`);
    }
    if (dto.omnihubId) {
      await this.assertOmnihubAvailable(dto.omnihubId, null);
    }
    return this.equipments.save(
      this.equipments.create({
        locationId: dto.locationId,
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

  /**
   * Create an Equipment + all its IR functions in one call from a named
   * preset. Bypasses the template flow — convenient for "I just want to add
   * a known device fast" scenarios. Equipment metadata (type/manufacturer/
   * model) is derived from the preset, function name == command name in the
   * preset.
   *
   * If any function insert fails the whole operation rolls back so we never
   * leave a half-populated equipment behind.
   */
  async createFromPreset(dto: FromPresetDto): Promise<Equipment> {
    const locationExists = await this.locations.exists({
      where: { id: dto.locationId },
    });
    if (!locationExists) {
      throw new BadRequestException(`location not found: ${dto.locationId}`);
    }
    if (dto.omnihubId) {
      await this.assertOmnihubAvailable(dto.omnihubId, null);
    }
    const preset = this.presets.get(dto.preset); // throws NotFound if missing

    // Map preset.device → our EquipmentType enum. Unknown devices fall back
    // to OTHER so soundbars etc. don't get rejected.
    const type = mapDeviceToType(preset.device);
    const equipment = await this.equipments.save(
      this.equipments.create({
        locationId: dto.locationId,
        type,
        manufacturer: preset.brand,
        model: `${preset.brand} ${preset.device} (preset:${dto.preset})`,
        name: dto.name ?? `${preset.brand} ${preset.device}`,
        omnihubId: dto.omnihubId ?? null,
      }),
    );

    // Insert each command as a function. Order preserves preset iteration.
    const entries = Object.entries(preset.commands);
    try {
      const rows = entries.map(([cmdName, payload], idx) =>
        this.functions.create({
          equipmentId: equipment.id,
          name: cmdName,
          icon: null,
          controlType: "IR",
          payload: { controlType: "IR", data: payload },
          order: idx,
        }),
      );
      await this.functions.save(rows);
    } catch (err) {
      // Roll back the equipment so we never leave a half-built row behind.
      await this.equipments.delete(equipment.id).catch(() => undefined);
      throw err;
    }

    // Return the equipment with functions populated.
    return this.get(equipment.id);
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
    if (fn.payload.controlType !== fn.controlType) {
      throw new BadRequestException(
        "function payload type does not match controlType",
      );
    }
    try {
      switch (fn.controlType) {
        case "IR":
          await this.dispatchIr(fn);
          break;
        case "HTTP_API":
          await this.dispatchHttpApi(fn);
          break;
        case "WOL":
          await this.dispatchWol(fn);
          break;
        case "RELAY":
          await this.dispatchRelay(fn);
          break;
        default: {
          // exhaustiveness check at compile time
          const _exhaustive: never = fn.controlType;
          throw new BadRequestException(
            `unsupported controlType: ${String(_exhaustive)}`,
          );
        }
      }
      await this.logControl(fn, "success", null);
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        // Don't log validation failures as control failures.
        throw err;
      }
      const msg = (err as Error).message;
      const result = msg.includes("timeout") ? "timeout" : "fail";
      await this.logControl(fn, result, msg);
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException(msg);
    }
  }

  // ---------- dispatchers (one per control type) ----------

  private async dispatchIr(fn: EquipmentFunction): Promise<void> {
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
    await this.gateway.requestIrSend(omnihubId, ir);
  }

  /**
   * HTTP_API: fire an HTTP request from the API server (not via the device).
   * Used to control IP-reachable IoT (Hue/Shelly/Tasmota/Home Assistant/etc.).
   *
   * Timeout: hard 10s ceiling. Aborts via AbortController.
   * Body handling: if `body` is an object, JSON-stringified and Content-Type
   * defaults to application/json. If string, sent as-is.
   * Response: any 2xx is success. 4xx/5xx surface as ServiceUnavailable with
   * the upstream status text for diagnosis.
   */
  private async dispatchHttpApi(fn: EquipmentFunction): Promise<void> {
    if (fn.payload.controlType !== "HTTP_API") {
      throw new BadRequestException("function payload is not HTTP_API");
    }
    const p = fn.payload.data;
    if (!p.url || !/^https?:\/\//i.test(p.url)) {
      throw new BadRequestException("payload.url must be http(s) URL");
    }
    if (!["GET", "POST", "PUT", "DELETE"].includes(p.method)) {
      throw new BadRequestException(
        `payload.method must be GET|POST|PUT|DELETE (got ${p.method})`,
      );
    }

    const headers: Record<string, string> = { ...(p.headers ?? {}) };
    let body: string | undefined;
    if (p.body !== undefined && p.body !== null) {
      if (typeof p.body === "string") {
        body = p.body;
      } else {
        body = JSON.stringify(p.body);
        if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
          headers["Content-Type"] = "application/json";
        }
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_API_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(p.url, {
        method: p.method,
        headers,
        body: p.method === "GET" || p.method === "DELETE" ? undefined : body,
        signal: controller.signal,
      });
    } catch (err) {
      const msg = (err as Error).message || "fetch failed";
      if ((err as Error).name === "AbortError") {
        throw new ServiceUnavailableException(`http_api timeout (${HTTP_API_TIMEOUT_MS}ms)`);
      }
      throw new ServiceUnavailableException(`http_api error: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      // Read up to 256 chars of the response body for log context.
      const snippet = await res
        .text()
        .then((t) => t.slice(0, 256))
        .catch(() => "");
      throw new ServiceUnavailableException(
        `http_api ${res.status} ${res.statusText}: ${snippet}`,
      );
    }
  }

  /**
   * WOL: send a Wake-on-LAN magic packet from the API server.
   *
   * Magic packet = 6 bytes of 0xFF + target MAC repeated 16 times (102 bytes
   * total). Sent as UDP broadcast on port 9. The API host must be on (or
   * reachable from) the target's broadcast domain — i.e., same LAN. For
   * routed environments specify `broadcastIp` (e.g., the subnet's directed
   * broadcast like 192.168.1.255).
   */
  private async dispatchWol(fn: EquipmentFunction): Promise<void> {
    if (fn.payload.controlType !== "WOL") {
      throw new BadRequestException("function payload is not WOL");
    }
    const p = fn.payload.data;
    const macClean = (p.mac ?? "").replace(/[-:]/g, "").toUpperCase();
    if (!/^[0-9A-F]{12}$/.test(macClean)) {
      throw new BadRequestException(
        `payload.mac must be 6 hex bytes (got ${p.mac})`,
      );
    }
    const macBytes = Buffer.from(macClean, "hex");
    // Magic packet: 6×0xFF + MAC×16
    const packet = Buffer.alloc(6 + 16 * 6);
    packet.fill(0xff, 0, 6);
    for (let i = 0; i < 16; i++) {
      macBytes.copy(packet, 6 + i * 6);
    }
    const target = p.broadcastIp ?? "255.255.255.255";
    const port = 9; // discard service; some BIOSes prefer 7. 9 is the modern default.

    await new Promise<void>((resolve, reject) => {
      const socket = createSocket("udp4");
      const timer = setTimeout(() => {
        socket.close();
        reject(new ServiceUnavailableException("wol send timeout (3s)"));
      }, 3_000);
      socket.once("error", (err) => {
        clearTimeout(timer);
        socket.close();
        reject(new ServiceUnavailableException(`wol socket: ${err.message}`));
      });
      socket.bind(() => {
        try {
          socket.setBroadcast(true);
        } catch (err) {
          clearTimeout(timer);
          socket.close();
          reject(
            new ServiceUnavailableException(
              `wol setBroadcast: ${(err as Error).message}`,
            ),
          );
          return;
        }
        socket.send(packet, port, target, (err) => {
          clearTimeout(timer);
          socket.close();
          if (err) {
            reject(
              new ServiceUnavailableException(
                `wol send: ${err.message} (target=${target}:${port})`,
              ),
            );
          } else {
            resolve();
          }
        });
      });
    });
  }

  /**
   * RELAY: switch a GPIO-driven relay on the OmniHub device.
   *
   * payload.channel — 0-based relay index on the device (max depends on
   * firmware PIN_RELAY_COUNT, currently 4).
   * payload.state   — ON / OFF / TOGGLE.
   * payload.durationMs — optional momentary mode: pulse ON for this many ms
   * then return to OFF. Useful for door releases and button-press emulation.
   * Caps at 30s to avoid stranded outputs if the request hangs.
   */
  private async dispatchRelay(fn: EquipmentFunction): Promise<void> {
    if (fn.payload.controlType !== "RELAY") {
      throw new BadRequestException("function payload is not RELAY");
    }
    const p = fn.payload.data;
    if (!Number.isInteger(p.channel) || p.channel < 0 || p.channel > 15) {
      throw new BadRequestException(
        `payload.channel must be an integer 0..15 (got ${p.channel})`,
      );
    }
    if (!["ON", "OFF", "TOGGLE"].includes(p.state)) {
      throw new BadRequestException(
        `payload.state must be ON|OFF|TOGGLE (got ${p.state})`,
      );
    }
    if (
      p.durationMs !== undefined &&
      (!Number.isInteger(p.durationMs) ||
        p.durationMs < 0 ||
        p.durationMs > 30_000)
    ) {
      throw new BadRequestException(
        `payload.durationMs must be 0..30000 if set (got ${p.durationMs})`,
      );
    }
    const omnihubId = await this.requireOmnihubForFunction(fn);
    await this.gateway.requestRelaySet(omnihubId, p);
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
