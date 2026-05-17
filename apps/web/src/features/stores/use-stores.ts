import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createStore,
  deleteStore,
  getStore,
  listStores,
  updateStore,
} from "./stores-api";
import type { CreateStoreInput, UpdateStoreInput } from "./types";

export const storesKeys = {
  all: ["stores"] as const,
  detail: (id: string) => ["stores", id] as const,
};

export function useStores() {
  return useQuery({ queryKey: storesKeys.all, queryFn: listStores });
}

export function useStore(id: string | undefined) {
  return useQuery({
    queryKey: id ? storesKeys.detail(id) : ["stores", "none"],
    queryFn: () => getStore(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStoreInput) => createStore(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storesKeys.all });
    },
  });
}

export function useUpdateStore(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStoreInput) => updateStore(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storesKeys.all });
      qc.invalidateQueries({ queryKey: storesKeys.detail(id) });
    },
  });
}

export function useDeleteStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storesKeys.all });
    },
  });
}
