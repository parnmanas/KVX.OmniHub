import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { equipmentsKeys } from "./use-equipments";
import type { Equipment, EquipmentFunction } from "./types";
import type { ControlType, FunctionPayload } from "@omnihub/shared";

export const equipmentFunctionsKeys = {
  byEquipment: (equipmentId: string) =>
    ["equipment-functions", equipmentId] as const,
};

export interface CreateEquipmentFunctionInput {
  name: string;
  icon?: string;
  controlType: ControlType;
  payload: FunctionPayload;
  order?: number;
}

export interface UpdateEquipmentFunctionInput {
  name?: string;
  icon?: string;
  controlType?: ControlType;
  payload?: FunctionPayload;
  order?: number;
}

export function useEquipmentFunctions(equipmentId: string | undefined) {
  return useQuery({
    queryKey: equipmentId
      ? equipmentFunctionsKeys.byEquipment(equipmentId)
      : ["equipment-functions", "none"],
    queryFn: async () => {
      const { data } = await api.get<EquipmentFunction[]>(
        `/equipments/${equipmentId}/functions`,
      );
      return data;
    },
    enabled: Boolean(equipmentId),
  });
}

function invalidateForEquipment(
  qc: ReturnType<typeof useQueryClient>,
  equipmentId: string,
  locationId?: string,
) {
  qc.invalidateQueries({
    queryKey: equipmentFunctionsKeys.byEquipment(equipmentId),
  });
  qc.invalidateQueries({ queryKey: equipmentsKeys.detail(equipmentId) });
  if (locationId) {
    qc.invalidateQueries({ queryKey: equipmentsKeys.byLocation(locationId) });
  }
}

export function useCreateEquipmentFunction(equipmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEquipmentFunctionInput) => {
      const { data } = await api.post<EquipmentFunction>(
        `/equipments/${equipmentId}/functions`,
        input,
      );
      return data;
    },
    onSuccess: () => invalidateForEquipment(qc, equipmentId),
  });
}

export function useUpdateEquipmentFunction(equipmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      input: UpdateEquipmentFunctionInput;
    }) => {
      const { data } = await api.patch<EquipmentFunction>(
        `/functions/${vars.id}`,
        vars.input,
      );
      return data;
    },
    onSuccess: () => invalidateForEquipment(qc, equipmentId),
  });
}

export function useDeleteEquipmentFunction(equipmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/functions/${id}`);
    },
    onSuccess: () => invalidateForEquipment(qc, equipmentId),
  });
}

export function useRecordEquipmentFunction(equipmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; timeoutMs?: number }) => {
      const { data } = await api.post<EquipmentFunction>(
        `/functions/${vars.id}/record`,
        { timeoutMs: vars.timeoutMs },
      );
      return data;
    },
    onSuccess: () => invalidateForEquipment(qc, equipmentId),
  });
}

export interface PlayResult {
  response: string | null; // hex string when RS232 status query
}

export function usePlayEquipmentFunction() {
  return useMutation({
    mutationFn: async (id: string): Promise<PlayResult> => {
      const { data } = await api.post<PlayResult>(`/functions/${id}/play`);
      return data ?? { response: null };
    },
  });
}

export type { Equipment, EquipmentFunction };
