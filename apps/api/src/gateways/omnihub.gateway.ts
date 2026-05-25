import { randomUUID } from "node:crypto";
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
  DEFAULT_IR_LEARN_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  WS_PATH,
  encodeIrPayload,
  type DeviceToServerMessage,
  type IrPayload,
  type RelayPayload,
  type Rs232Payload,
  type ServerToDeviceMessage,
} from "@omnihub/shared";
import { Repository } from "typeorm";
import type { Server, WebSocket } from "ws";
import { OmniHubDevice } from "../entities";
import { DeviceRegistry } from "./device-registry.service";
import { normalizeMac, verifyToken } from "./pairing.service";

type PendingKind = "ir_learn" | "ir_send" | "relay_set" | "rs232_send";

interface PendingRequest {
  kind: PendingKind;
  deviceId: string;
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

const SEND_ACK_TIMEOUT_MS = 5_000;

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

  private readonly pending = new Map<string, PendingRequest>();

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
      this.rejectPendingForDevice(deviceId, "device disconnected");
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
          this.onAck(msg);
          return;
        case "ir_learned":
          this.onIrLearned(msg);
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
      relations: { equipments: true },
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

    // hello_ack carries a single equipment id for backward compat with
    // older firmware that displayed it on a small OLED. With 1:N now, we
    // just pick the first assigned equipment (or null) — the firmware
    // doesn't make routing decisions based on this field.
    this.send(client, {
      type: "hello_ack",
      assignedEquipmentId: device.equipments?.[0]?.id ?? null,
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

  // ---------- IR control (called from services) ----------

  async requestIrLearn(
    omnihubRowId: string,
    timeoutMs: number = DEFAULT_IR_LEARN_TIMEOUT_MS,
  ): Promise<IrPayload> {
    const { ws, deviceId } = await this.getDeviceSocket(omnihubRowId);
    const requestId = randomUUID();
    return new Promise<IrPayload>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("learn timeout"));
      }, timeoutMs + 1_000); // give device a 1s buffer over its own timer
      this.pending.set(requestId, {
        kind: "ir_learn",
        deviceId,
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });
      this.send(ws, { type: "ir_learn", requestId, timeoutMs });
    });
  }

  async requestIrSend(
    omnihubRowId: string,
    payload: IrPayload,
    repeat?: number,
  ): Promise<void> {
    const { ws, deviceId } = await this.getDeviceSocket(omnihubRowId);
    const requestId = randomUUID();

    // Encode the payload to a raw burst here on the server. This keeps the
    // firmware protocol-agnostic — adding a new IR protocol becomes a pure
    // server-side change, no reflash. If encoding fails (unsupported
    // protocol, no decoded/raw), refuse the send.
    const encoded = encodeIrPayload(payload);
    if (!encoded) {
      throw new Error(
        `cannot encode IR payload: protocol=${payload.protocol}, ` +
          `decoded=${payload.decoded ? "yes" : "no"}, raw=${payload.raw.length}`,
      );
    }

    // Build the wire payload: keep the original protocol/decoded for
    // diagnostics on the firmware side, but ALWAYS provide raw so the
    // firmware can just call sendRaw(buf, n, khz) without a per-protocol
    // switch. Existing firmware that still dispatches on protocol keeps
    // working too — defense in depth during the migration.
    const wirePayload: IrPayload = {
      protocol: payload.protocol,
      decoded: payload.decoded,
      raw: encoded.raw,
    };

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("send ack timeout"));
      }, SEND_ACK_TIMEOUT_MS);
      this.pending.set(requestId, {
        kind: "ir_send",
        deviceId,
        resolve: () => resolve(),
        reject,
        timer,
      });
      this.send(ws, {
        type: "ir_send",
        requestId,
        payload: wirePayload,
        repeat,
        khz: encoded.khz,
      });
    });
  }

  async requestRelaySet(
    omnihubRowId: string,
    payload: RelayPayload,
  ): Promise<void> {
    const { ws, deviceId } = await this.getDeviceSocket(omnihubRowId);
    const requestId = randomUUID();
    // Momentary pulses (durationMs) keep the firmware busy for that span; bump
    // the ack budget to cover the worst case plus a 1s grace.
    const ackTimeout =
      (payload.durationMs ?? 0) > 0
        ? Math.min(payload.durationMs! + 1_000, 30_000)
        : SEND_ACK_TIMEOUT_MS;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("relay ack timeout"));
      }, ackTimeout);
      this.pending.set(requestId, {
        kind: "relay_set",
        deviceId,
        resolve: () => resolve(),
        reject,
        timer,
      });
      this.send(ws, { type: "relay_set", requestId, payload });
    });
  }

  async requestRs232Send(
    omnihubRowId: string,
    payload: Rs232Payload,
  ): Promise<string | null> {
    const { ws, deviceId } = await this.getDeviceSocket(omnihubRowId);
    const requestId = randomUUID();
    // If the preset asks for a response read-back, stretch the ack window
    // to cover that read plus a 1s grace. Otherwise use the default ack
    // timeout — bytes are written synchronously over the UART, fast.
    const ackTimeout =
      (payload.responseTimeoutMs ?? 0) > 0
        ? Math.min(payload.responseTimeoutMs! + 1_000, 15_000)
        : SEND_ACK_TIMEOUT_MS;
    return new Promise<string | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("rs232 ack timeout"));
      }, ackTimeout);
      this.pending.set(requestId, {
        kind: "rs232_send",
        deviceId,
        // resolve receives `string | null` from onAck (the projector's
        // reply as a hex string, or null if no read-back was requested).
        resolve: (v) => resolve((v as string | null) ?? null),
        reject,
        timer,
      });
      this.send(ws, { type: "rs232_send", requestId, payload });
    });
  }

  private async getDeviceSocket(
    omnihubRowId: string,
  ): Promise<{ ws: WebSocket; deviceId: string }> {
    const device = await this.devices.findOne({ where: { id: omnihubRowId } });
    if (!device) throw new Error("omnihub not found");
    const auth = this.registry.get(device.deviceId);
    if (!auth) throw new Error("omnihub offline");
    return { ws: auth.ws, deviceId: device.deviceId };
  }

  private onAck(
    msg: Extract<DeviceToServerMessage, { type: "ack" }>,
  ): void {
    const pending = this.pending.get(msg.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(msg.requestId);
    if (msg.ok) {
      // RS232 may include a response (hex string) — pass it through so the
      // caller can return the projector's status reply to the UI.
      pending.resolve(msg.response ?? null);
    } else {
      pending.reject(new Error(msg.error ?? "device reported failure"));
    }
  }

  private onIrLearned(
    msg: Extract<DeviceToServerMessage, { type: "ir_learned" }>,
  ): void {
    const pending = this.pending.get(msg.requestId);
    if (!pending) {
      this.log.warn(`unmatched ir_learned for requestId=${msg.requestId}`);
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(msg.requestId);
    const payload: IrPayload = {
      protocol: msg.protocol,
      decoded: msg.decoded,
      raw: msg.raw,
    };
    pending.resolve(payload);
  }

  private rejectPendingForDevice(deviceId: string, reason: string): void {
    for (const [id, p] of this.pending) {
      if (p.deviceId !== deviceId) continue;
      clearTimeout(p.timer);
      this.pending.delete(id);
      p.reject(new Error(reason));
    }
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
