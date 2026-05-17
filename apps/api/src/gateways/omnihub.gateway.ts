import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { InjectRepository } from "@nestjs/typeorm";
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  WS_PATH,
  type DeviceToServerMessage,
  type ServerToDeviceMessage,
} from "@omnihub/shared";
import { Repository } from "typeorm";
import type { Server, WebSocket } from "ws";
import { OmniHubDevice } from "../entities";
import { DeviceRegistry } from "./device-registry.service";
import { normalizeMac, verifyToken } from "./pairing.service";

@Injectable()
@WebSocketGateway({ path: WS_PATH })
export class OmnihubGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  private readonly log = new Logger(OmnihubGateway.name);

  @WebSocketServer()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  server!: Server;

  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(OmniHubDevice)
    private readonly devices: Repository<OmniHubDevice>,
    private readonly registry: DeviceRegistry,
  ) {}

  onModuleInit(): void {
    this.heartbeatTimer = setInterval(
      () => this.runHeartbeat(),
      HEARTBEAT_INTERVAL_MS,
    );
  }

  onModuleDestroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ---------- ws lifecycle ----------

  handleConnection(client: WebSocket): void {
    this.log.log("device socket connected");
    client.on("message", (raw) => {
      void this.onMessage(client, raw);
    });
  }

  async handleDisconnect(client: WebSocket): Promise<void> {
    this.registry.removePendingBySocket(client);
    const deviceId = this.registry.removeBySocket(client);
    if (deviceId) {
      this.log.log(`device ${deviceId} disconnected`);
      await this.devices.update({ deviceId }, { status: "offline" });
    }
  }

  // ---------- message routing ----------

  private async onMessage(
    client: WebSocket,
    raw: unknown,
  ): Promise<void> {
    let msg: DeviceToServerMessage;
    try {
      const text =
        typeof raw === "string"
          ? raw
          : Buffer.isBuffer(raw)
            ? raw.toString("utf8")
            : String(raw);
      msg = JSON.parse(text) as DeviceToServerMessage;
    } catch (err) {
      this.log.warn(`invalid JSON from device: ${(err as Error).message}`);
      this.sendError(client, "bad_json", "could not parse message");
      return;
    }
    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") {
      this.sendError(client, "bad_message", "missing type");
      return;
    }

    try {
      switch (msg.type) {
        case "hello":
          await this.onHello(client, msg);
          return;
        case "pair_request":
          await this.onPairRequest(client, msg);
          return;
        case "pong":
          this.onPong(client);
          return;
        case "ack":
          // forwarded to caller via pending promise (Phase 5)
          return;
        case "ir_learned":
          // handled in Phase 5
          return;
        default: {
          const unknown = msg as { type: string };
          this.sendError(
            client,
            "unknown_type",
            `unknown type: ${unknown.type}`,
          );
        }
      }
    } catch (err) {
      this.log.error(
        `error handling ${msg.type}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      this.sendError(client, "internal", "server error");
    }
  }

  private async onHello(
    client: WebSocket,
    msg: Extract<DeviceToServerMessage, { type: "hello" }>,
  ): Promise<void> {
    const deviceId = normalizeMac(msg.deviceId);
    const device = await this.devices.findOne({
      where: { deviceId },
      relations: { equipment: true },
    });

    // No token yet — device must run pair_request flow
    if (!msg.token) {
      this.sendError(
        client,
        "pairing_required",
        "device must send pair_request first",
      );
      return;
    }

    if (!device || !device.authTokenHash) {
      this.sendError(client, "unknown_device", "device not registered");
      return;
    }

    if (!verifyToken(msg.token, device.authTokenHash)) {
      this.sendError(client, "invalid_token", "token rejected");
      return;
    }

    // Auth OK
    this.registry.addAuthenticated(deviceId, client);
    await this.devices.update(
      { deviceId },
      {
        status: "online",
        lastSeenAt: new Date(),
        firmwareVersion: msg.fw,
      },
    );

    this.send(client, {
      type: "hello_ack",
      assignedEquipmentId: device.equipment?.id ?? null,
    });
    this.log.log(`device ${deviceId} authenticated`);
  }

  private async onPairRequest(
    client: WebSocket,
    msg: Extract<DeviceToServerMessage, { type: "pair_request" }>,
  ): Promise<void> {
    const deviceId = normalizeMac(msg.deviceId);
    const code = msg.pairingCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(code)) {
      this.sendError(client, "bad_pairing_code", "invalid pairing code format");
      return;
    }

    // If already registered with token, reject (device should send hello instead)
    const existing = await this.devices.findOne({ where: { deviceId } });
    if (existing && existing.authTokenHash) {
      this.sendError(
        client,
        "already_paired",
        "device already paired; reset to re-pair",
      );
      return;
    }

    // Upsert as pending in DB so admin can see it in /omnihubs
    if (existing) {
      existing.pairingCode = code;
      await this.devices.save(existing);
    } else {
      await this.devices.save(
        this.devices.create({
          deviceId,
          pairingCode: code,
          status: "offline",
        }),
      );
    }

    this.registry.addPending({
      pairingCode: code,
      deviceId,
      fw: "",
      ws: client,
    });
    this.log.log(`pair_request ${deviceId} code=${code}`);
    // No ack yet — admin must claim, then we'll push pair_ack
  }

  private onPong(client: WebSocket): void {
    for (const dev of this.registry.listAuthenticated()) {
      if (dev.ws === client) {
        this.registry.markPong(dev.deviceId);
        return;
      }
    }
  }

  // ---------- send helpers ----------

  private send(client: WebSocket, msg: ServerToDeviceMessage): void {
    try {
      client.send(JSON.stringify(msg));
    } catch (err) {
      this.log.warn(`send failed: ${(err as Error).message}`);
    }
  }

  private sendError(
    client: WebSocket,
    code: string,
    message: string,
    requestId?: string,
  ): void {
    this.send(client, { type: "error", code, message, requestId });
  }

  // ---------- pair claim (called from controller) ----------

  async claimPairing(
    pairingCode: string,
    opts: { storeId?: string | null; name?: string | null },
  ): Promise<{ device: OmniHubDevice; token: string }> {
    const normalized = pairingCode.trim().toUpperCase();
    const pending = this.registry.removePending(normalized);
    if (!pending) {
      throw new Error("PAIRING_NOT_FOUND");
    }

    const { generateAuthToken, hashToken } = await import("./pairing.service");
    const token = generateAuthToken();
    const hash = hashToken(token);

    const device = await this.devices.findOne({
      where: { deviceId: pending.deviceId },
    });
    if (!device) throw new Error("DEVICE_ROW_MISSING");

    device.authTokenHash = hash;
    device.pairingCode = null;
    if (opts.storeId !== undefined) device.storeId = opts.storeId;
    if (opts.name !== undefined) device.name = opts.name;
    device.status = "online";
    device.lastSeenAt = new Date();
    await this.devices.save(device);

    this.registry.addAuthenticated(device.deviceId, pending.ws);
    this.send(pending.ws, { type: "pair_ack", token });

    return { device, token };
  }

  // ---------- heartbeat ----------

  private runHeartbeat(): void {
    const now = Date.now();
    for (const dev of this.registry.listAuthenticated()) {
      // Silence too long → close socket, will be removed in handleDisconnect
      if (now - dev.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
        this.log.warn(`device ${dev.deviceId} timed out, closing`);
        try {
          dev.ws.close(4002, "heartbeat timeout");
        } catch {
          /* ignore */
        }
        continue;
      }
      this.send(dev.ws, { type: "ping" });
    }
  }
}
