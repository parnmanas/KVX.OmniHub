import type {
  IrPayload,
  IrProtocol,
  RelayPayload,
  Rs232Payload,
} from "./equipment.js";

// ============================================================================
// OmniHub <-> Server WebSocket protocol
// All messages are JSON. Every message has a `type` discriminator.
// requestId (when present) lets server correlate request/response.
// ============================================================================

// ---------- ESP32 -> Server ----------

export interface HelloMessage {
  type: "hello";
  deviceId: string; // MAC address, e.g. "AA:BB:CC:DD:EE:FF"
  token?: string; // omit on first pairing
  fw: string; // firmware version
}

export interface PairRequestMessage {
  type: "pair_request";
  deviceId: string;
  pairingCode: string; // 6-digit code shown on device
}

export interface PongMessage {
  type: "pong";
}

export interface AckMessage {
  type: "ack";
  requestId: string;
  ok: boolean;
  error?: string;
  // RS232 status queries return the projector's reply bytes here as a hex
  // string (e.g. "2A504F573D4F4E23" for *POW=ON#). Only present when the
  // command requested a response read-back via responseTimeoutMs.
  response?: string;
}

export interface IrLearnedMessage {
  type: "ir_learned";
  requestId: string;
  protocol: IrProtocol;
  decoded: { value: string; bits: number } | null;
  raw: number[];
}

export type DeviceToServerMessage =
  | HelloMessage
  | PairRequestMessage
  | PongMessage
  | AckMessage
  | IrLearnedMessage;

// ---------- Server -> ESP32 ----------

export interface HelloAckMessage {
  type: "hello_ack";
  assignedEquipmentId: string | null;
  // optional initial config the device should know about
}

export interface PairAckMessage {
  type: "pair_ack";
  token: string;
}

export interface PingMessage {
  type: "ping";
}

export interface IrLearnRequest {
  type: "ir_learn";
  requestId: string;
  timeoutMs: number;
}

export interface IrSendRequest {
  type: "ir_send";
  requestId: string;
  payload: IrPayload;
  repeat?: number;
  // Carrier kHz hint for raw transmission. Server fills this in after
  // encoding (NEC/SAMSUNG/LG/LG2 = 38, SONY = 40, RC5/RC6 = 36). Firmware
  // uses it when payload.raw is the transmit source. Optional for
  // backward-compatible captures (omit = 38).
  khz?: number;
}

export interface RelaySetRequest {
  type: "relay_set";
  requestId: string;
  payload: RelayPayload;
}

export interface Rs232SendRequest {
  type: "rs232_send";
  requestId: string;
  payload: Rs232Payload;
}

export interface ErrorMessage {
  type: "error";
  requestId?: string;
  code: string;
  message: string;
}

export type ServerToDeviceMessage =
  | HelloAckMessage
  | PairAckMessage
  | PingMessage
  | IrLearnRequest
  | IrSendRequest
  | RelaySetRequest
  | Rs232SendRequest
  | ErrorMessage;

// ---------- Constants ----------

export const HEARTBEAT_INTERVAL_MS = 30_000;
export const HEARTBEAT_TIMEOUT_MS = 60_000;
export const DEFAULT_IR_LEARN_TIMEOUT_MS = 10_000;
export const WS_PATH = "/ws";
