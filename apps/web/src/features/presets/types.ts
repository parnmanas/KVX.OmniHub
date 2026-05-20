import type { IrPayload } from "@omnihub/shared";

export interface IrPresetSummary {
  name: string;
  brand: string;
  device: string;
  commandCount: number;
}

export interface IrPreset {
  brand: string;
  device: string;
  notes?: string[];
  carrier?: number;
  commands: Record<string, IrPayload>;
}
