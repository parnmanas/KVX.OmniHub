import type { Equipment } from "@/features/equipments/types";

export interface Location {
  id: string;
  storeId: string;
  name: string;
  store?: { id: string; name: string };
  equipments?: Equipment[];
  // Hubs physically placed at this location (Hub.locationId → this).
  devices?: {
    id: string;
    deviceId: string;
    name: string | null;
    status: "online" | "offline";
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationInput {
  name: string;
}

export type UpdateLocationInput = Partial<CreateLocationInput>;
