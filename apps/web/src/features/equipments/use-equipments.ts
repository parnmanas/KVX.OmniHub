import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { locationsKeys } from "@/features/locations/use-locations";
import { omnihubsKeys } from "@/features/omnihubs/use-omnihubs";
import type {
  CreateEquipmentInput,
  Equipment,
  UpdateEquipmentInput,
} from "./types";

export const equipmentsKeys = {
  byLocation: (locationId: string) =>
    ["equipments", "byLocation", locationId] as const,
  detail: (id: string) => ["equipments", id] as const,
};

function invalidateForLocation(
  qc: ReturnType<typeof useQueryClient>,
  locationId: string,
) {
  qc.invalidateQueries({ queryKey: equipmentsKeys.byLocation(locationId) });
  qc.invalidateQueries({ queryKey: locationsKeys.detail(locationId) });
  qc.invalidateQueries({ queryKey: omnihubsKeys.all });
}

export function useEquipments(locationId: string | undefined) {
  return useQuery({
    queryKey: locationId
      ? equipmentsKeys.byLocation(locationId)
      : ["equipments", "none"],
    queryFn: async () => {
      const { data } = await api.get<Equipment[]>("/equipments", {
        params: { locationId },
      });
      return data;
    },
    enabled: Boolean(locationId),
  });
}

export function useEquipment(id: string | undefined) {
  return useQuery({
    queryKey: id ? equipmentsKeys.detail(id) : ["equipments", "none"],
    queryFn: async () => {
      const { data } = await api.get<Equipment>(`/equipments/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEquipmentInput) => {
      const { data } = await api.post<Equipment>("/equipments", input);
      return data;
    },
    onSuccess: (data) => invalidateForLocation(qc, data.locationId),
  });
}

export interface CreateEquipmentFromPresetInput {
  locationId: string;
  preset: string;
  name?: string;
  omnihubId?: string;
}

export function useCreateEquipmentFromPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEquipmentFromPresetInput) => {
      const { data } = await api.post<Equipment>(
        "/equipments/from-preset",
        input,
      );
      return data;
    },
    onSuccess: (data) => invalidateForLocation(qc, data.locationId),
  });
}

export function useUpdateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; input: UpdateEquipmentInput }) => {
      const { data } = await api.patch<Equipment>(
        `/equipments/${vars.id}`,
        vars.input,
      );
      return data;
    },
    onSuccess: (data) => {
      invalidateForLocation(qc, data.locationId);
      qc.invalidateQueries({ queryKey: equipmentsKeys.detail(data.id) });
    },
  });
}

export function useDeleteEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; locationId: string }) => {
      await api.delete(`/equipments/${vars.id}`);
      return vars;
    },
    onSuccess: (vars) => invalidateForLocation(qc, vars.locationId),
  });
}
