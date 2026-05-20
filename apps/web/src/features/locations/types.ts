import type { Equipment } from "@/features/equipments/types";

export interface Location {
  id: string;
  storeId: string;
  name: string;
  store?: { id: string; name: string };
  equipments?: Equipment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationInput {
  name: string;
}

export type UpdateLocationInput = Partial<CreateLocationInput>;
