import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { storesKeys } from "@/features/stores/use-stores";
import type {
  CreateLocationInput,
  Location,
  UpdateLocationInput,
} from "./types";

export const locationsKeys = {
  all: ["locations", "all"] as const,
  byStore: (storeId: string) => ["locations", "byStore", storeId] as const,
  detail: (id: string) => ["locations", id] as const,
};

export function useAllLocations() {
  return useQuery({
    queryKey: locationsKeys.all,
    queryFn: async () => {
      const { data } = await api.get<Location[]>("/locations");
      return data;
    },
  });
}

export function useLocations(storeId: string | undefined) {
  return useQuery({
    queryKey: storeId
      ? locationsKeys.byStore(storeId)
      : ["locations", "none"],
    queryFn: async () => {
      const { data } = await api.get<Location[]>(
        `/stores/${storeId}/locations`,
      );
      return data;
    },
    enabled: Boolean(storeId),
  });
}

export function useLocation(id: string | undefined) {
  return useQuery({
    queryKey: id ? locationsKeys.detail(id) : ["locations", "none"],
    queryFn: async () => {
      const { data } = await api.get<Location>(`/locations/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateLocation(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLocationInput) => {
      const { data } = await api.post<Location>(
        `/stores/${storeId}/locations`,
        input,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationsKeys.byStore(storeId) });
      qc.invalidateQueries({ queryKey: storesKeys.detail(storeId) });
    },
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; input: UpdateLocationInput }) => {
      const { data } = await api.patch<Location>(
        `/locations/${vars.id}`,
        vars.input,
      );
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: locationsKeys.byStore(data.storeId) });
      qc.invalidateQueries({ queryKey: locationsKeys.detail(data.id) });
    },
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; storeId: string }) => {
      await api.delete(`/locations/${vars.id}`);
      return vars;
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: locationsKeys.byStore(vars.storeId) });
      qc.invalidateQueries({ queryKey: storesKeys.detail(vars.storeId) });
    },
  });
}
