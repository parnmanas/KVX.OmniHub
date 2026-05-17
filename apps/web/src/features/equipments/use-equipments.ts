import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { storesKeys } from "@/features/stores/use-stores";
import { omnihubsKeys } from "@/features/omnihubs/use-omnihubs";
import type {
  CreateEquipmentInput,
  Equipment,
  UpdateEquipmentInput,
} from "./types";

export const equipmentsKeys = {
  byStore: (storeId: string) => ["equipments", "byStore", storeId] as const,
  detail: (id: string) => ["equipments", id] as const,
};

export function useEquipments(storeId: string | undefined) {
  return useQuery({
    queryKey: storeId ? equipmentsKeys.byStore(storeId) : ["equipments", "none"],
    queryFn: async () => {
      const { data } = await api.get<Equipment[]>("/equipments", {
        params: { storeId },
      });
      return data;
    },
    enabled: Boolean(storeId),
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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: equipmentsKeys.byStore(data.storeId) });
      qc.invalidateQueries({ queryKey: storesKeys.detail(data.storeId) });
      qc.invalidateQueries({ queryKey: omnihubsKeys.all });
    },
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
      qc.invalidateQueries({ queryKey: equipmentsKeys.byStore(data.storeId) });
      qc.invalidateQueries({ queryKey: equipmentsKeys.detail(data.id) });
      qc.invalidateQueries({ queryKey: storesKeys.detail(data.storeId) });
      qc.invalidateQueries({ queryKey: omnihubsKeys.all });
    },
  });
}

export function useDeleteEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; storeId: string }) => {
      await api.delete(`/equipments/${vars.id}`);
      return vars;
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: equipmentsKeys.byStore(vars.storeId) });
      qc.invalidateQueries({ queryKey: storesKeys.detail(vars.storeId) });
      qc.invalidateQueries({ queryKey: omnihubsKeys.all });
    },
  });
}
