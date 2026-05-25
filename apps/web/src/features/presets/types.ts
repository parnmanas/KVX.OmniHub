import type {
  ControlType,
  HttpApiPayload,
  IrPayload,
  RelayPayload,
  Rs232Payload,
  WolPayload,
} from "@omnihub/shared";

export interface IrPresetSummary {
  name: string;
  brand: string;
  device: string;
  variant?: string;
  // Always present after server defaults old IR-only presets to "IR".
  controlType: ControlType;
  commandCount: number;
}

export type PresetCommandPayload =
  | IrPayload
  | Rs232Payload
  | RelayPayload
  | WolPayload
  | HttpApiPayload;

export interface IrPreset {
  brand: string;
  device: string;
  variant?: string;
  controlType?: ControlType;
  notes?: string[];
  carrier?: number;
  commands: Record<string, PresetCommandPayload>;
}
