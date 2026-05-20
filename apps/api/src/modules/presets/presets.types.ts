import type { IrPayload } from "@omnihub/shared";

// Shape of each *.json file in tools/ir-presets/. Matches the format
// documented in tools/ir-presets/README.md.
export interface IrPreset {
  brand: string;
  device: string;
  notes?: string[];
  carrier?: number;
  commands: Record<string, IrPayload>;
}

export interface IrPresetSummary {
  name: string;
  brand: string;
  device: string;
  commandCount: number;
}
