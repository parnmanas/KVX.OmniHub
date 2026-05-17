import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
