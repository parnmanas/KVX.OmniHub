import { api } from "@/lib/api";
import type { CreateStoreInput, Store, UpdateStoreInput } from "./types";

export async function listStores(): Promise<Store[]> {
  const { data } = await api.get<Store[]>("/stores");
  return data;
}

export async function getStore(id: string): Promise<Store> {
  const { data } = await api.get<Store>(`/stores/${id}`);
  return data;
}

export async function createStore(input: CreateStoreInput): Promise<Store> {
  const { data } = await api.post<Store>("/stores", input);
  return data;
}

export async function updateStore(
  id: string,
  input: UpdateStoreInput,
): Promise<Store> {
  const { data } = await api.patch<Store>(`/stores/${id}`, input);
  return data;
}

export async function deleteStore(id: string): Promise<void> {
  await api.delete(`/stores/${id}`);
}
