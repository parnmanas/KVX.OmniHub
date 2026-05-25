export const EquipmentType = {
  AC: "AC",
  PROJECTOR: "PROJECTOR",
  TV: "TV",
  LIGHT: "LIGHT",
  DOOR_LOCK: "DOOR_LOCK",
  PC: "PC",
  OTHER: "OTHER",
} as const;
export type EquipmentType = (typeof EquipmentType)[keyof typeof EquipmentType];

export const ControlType = {
  IR: "IR",
  WOL: "WOL",
  HTTP_API: "HTTP_API",
  RELAY: "RELAY",
  // RS232 serial control — used by projectors, AV receivers, professional
  // displays. The OmniHub firmware needs a MAX3232 transceiver wired to
  // Serial2 (default GPIO 16 RX / 17 TX) to drive real ±12V RS232 levels;
  // TTL-only output won't reach most projectors reliably.
  RS232: "RS232",
} as const;
export type ControlType = (typeof ControlType)[keyof typeof ControlType];

export const IrProtocol = {
  NEC: "NEC",
  SONY: "SONY",
  RC5: "RC5",
  RC6: "RC6",
  SAMSUNG: "SAMSUNG",
  LG: "LG",
  // LG variant 2 — used by modern LG inverter ACs (Whisen / Therma V series).
  // Same wire format as LG 28/32-bit but different header timing; the AC
  // sends a full-state packet per button press (stateful), so each captured
  // value encodes the complete AC state (mode + temp + fan + swing).
  LG2: "LG2",
  // Stateful LG AC packet. Wire-format-wise identical to LG2 (sent via
  // sendLG2), but semantically: each value is a complete state snapshot.
  // Use this when you have known full-state codes (e.g. "power on, cool,
  // 24°C, fan auto") rather than per-button deltas.
  LG_AC: "LG_AC",
  UNKNOWN: "UNKNOWN",
} as const;
export type IrProtocol = (typeof IrProtocol)[keyof typeof IrProtocol];

export interface IrPayload {
  protocol: IrProtocol;
  decoded: { value: string; bits: number } | null;
  raw: number[]; // microseconds
}

export interface WolPayload {
  mac: string;
  broadcastIp?: string;
}

export interface HttpApiPayload {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface RelayPayload {
  channel: number;
  state: "ON" | "OFF" | "TOGGLE";
  durationMs?: number;
}

export type Rs232Parity = "none" | "even" | "odd";

export interface Rs232Payload {
  // Serial line configuration. Projector manuals state these in the spec,
  // e.g. 9600 8N1, 19200 8N1, 38400 8E1. Defaults below match the most
  // common projector setting (9600 8N1).
  baud: number;
  dataBits: 7 | 8;
  parity: Rs232Parity;
  stopBits: 1 | 2;
  // The command itself as a byte array (0..255 per element). The shared
  // server-side encoder formats brand-specific wrappers (STX/ETX, checksums,
  // header bytes) into raw bytes that the firmware writes verbatim to UART.
  bytes: number[];
  // Some projectors echo or send an ACK byte; firmware reads up to this
  // many ms for a response and surfaces it for diagnostics. Optional.
  responseTimeoutMs?: number;
}

export type FunctionPayload =
  | { controlType: "IR"; data: IrPayload }
  | { controlType: "WOL"; data: WolPayload }
  | { controlType: "HTTP_API"; data: HttpApiPayload }
  | { controlType: "RELAY"; data: RelayPayload }
  | { controlType: "RS232"; data: Rs232Payload };
