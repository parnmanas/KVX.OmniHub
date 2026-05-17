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
} as const;
export type ControlType = (typeof ControlType)[keyof typeof ControlType];

export const IrProtocol = {
  NEC: "NEC",
  SONY: "SONY",
  RC5: "RC5",
  RC6: "RC6",
  SAMSUNG: "SAMSUNG",
  LG: "LG",
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

export type FunctionPayload =
  | { controlType: "IR"; data: IrPayload }
  | { controlType: "WOL"; data: WolPayload }
  | { controlType: "HTTP_API"; data: HttpApiPayload }
  | { controlType: "RELAY"; data: RelayPayload };
