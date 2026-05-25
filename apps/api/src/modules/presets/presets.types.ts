import type {
  ControlType,
  HttpApiPayload,
  IrPayload,
  RelayPayload,
  Rs232Payload,
  WolPayload,
} from "@omnihub/shared";

// A preset is a named collection of commands for a specific equipment
// model. Each file under tools/ir-presets/*.json corresponds to one preset.
//
// `controlType` declares which payload shape `commands.*` use. We keep a
// single field instead of a discriminated union per-command so a preset
// stays homogeneous — mixing IR + RS232 in one preset is almost always a
// mistake (you'd want two presets, one per protocol). controlType is
// optional with default "IR" so the dozens of existing IR preset files
// continue to load unchanged.
export type PresetCommandPayload =
  | IrPayload
  | Rs232Payload
  | RelayPayload
  | WolPayload
  | HttpApiPayload;

export interface Preset {
  brand: string;
  device: string;
  // Human-readable disambiguator when one brand+device has multiple
  // presets — e.g. "Window/Portable (NEC)" vs "Inverter Split (LG2)".
  variant?: string;
  // Defaults to "IR" when missing. Drives both UI (which payload editor to
  // show) and dispatch (which controller transmits it).
  controlType?: ControlType;
  notes?: string[];
  carrier?: number; // IR only
  commands: Record<string, PresetCommandPayload>;
}

export interface PresetSummary {
  name: string;
  brand: string;
  device: string;
  variant?: string;
  controlType: ControlType;
  commandCount: number;
}

// ---- Legacy aliases kept temporarily for callers that still type as
// IrPreset / IrPresetSummary. New code should use Preset / PresetSummary. ----
export type IrPreset = Preset;
export type IrPresetSummary = PresetSummary;
