import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { IrPreset, IrPresetSummary } from "./types";

export const presetsKeys = {
  all: ["presets"] as const,
  detail: (name: string) => ["presets", name] as const,
};

export function usePresets() {
  return useQuery({
    queryKey: presetsKeys.all,
    queryFn: async () => {
      const { data } = await api.get<IrPresetSummary[]>("/presets");
      return data;
    },
    staleTime: 5 * 60_000, // presets are static config-as-data, cache 5 min
  });
}

export function usePreset(name: string | null) {
  return useQuery({
    queryKey: name ? presetsKeys.detail(name) : ["presets", "none"],
    queryFn: async () => {
      const { data } = await api.get<IrPreset>(`/presets/${name}`);
      return data;
    },
    enabled: Boolean(name),
    staleTime: 5 * 60_000,
  });
}
