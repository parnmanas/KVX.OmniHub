import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { IrPayload } from "@omnihub/shared";
import { api } from "@/lib/api";
import type {
  CreateOmnihubInput,
  Omnihub,
  UpdateOmnihubInput,
} from "./types";

export const omnihubsKeys = {
  all: ["omnihubs"] as const,
  detail: (id: string) => ["omnihubs", id] as const,
};

async function listOmnihubs(): Promise<Omnihub[]> {
  const { data } = await api.get<Omnihub[]>("/omnihubs");
  return data;
}

export function useOmnihubs() {
  return useQuery({ queryKey: omnihubsKeys.all, queryFn: listOmnihubs });
}

export function useOmnihub(id: string | undefined) {
  return useQuery({
    queryKey: id ? omnihubsKeys.detail(id) : ["omnihubs", "none"],
    queryFn: async () => {
      const { data } = await api.get<Omnihub>(`/omnihubs/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateOmnihub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOmnihubInput) => {
      const { data } = await api.post<Omnihub>("/omnihubs", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: omnihubsKeys.all }),
  });
}

export function useUpdateOmnihub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; input: UpdateOmnihubInput }) => {
      const { data } = await api.patch<Omnihub>(
        `/omnihubs/${vars.id}`,
        vars.input,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: omnihubsKeys.all }),
  });
}

export function useDeleteOmnihub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/omnihubs/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: omnihubsKeys.all }),
  });
}

export interface IrTestInput {
  omnihubId: string;
  payload: IrPayload;
  repeat?: number;
}

// Normalize the IR payload before sending to /ir-test so the server validator
// (which only accepts hex chars, no "0x" prefix) doesn't reject legacy data.
function normalizeIrPayload(payload: IrPayload): IrPayload {
  if (payload.decoded) {
    const value = payload.decoded.value.replace(/^0x/i, "");
    return {
      ...payload,
      decoded: { ...payload.decoded, value },
    };
  }
  return payload;
}

export function useIrTest() {
  return useMutation({
    mutationFn: async (vars: IrTestInput) => {
      await api.post(`/omnihubs/${vars.omnihubId}/ir-test`, {
        payload: normalizeIrPayload(vars.payload),
        repeat: vars.repeat,
      });
    },
  });
}
