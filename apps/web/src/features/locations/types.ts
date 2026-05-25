import type { Equipment } from "@/features/equipments/types";

export interface Location {
  id: string;
  storeId: string;
  name: string;
  // Default hub for this location (overrides store-level, overridden by
  // per-equipment assignment). See Equipment → Location → Store fallback.
  omnihubId: string | null;
  omnihub?: {
    id: string;
    deviceId: string;
    name: string | null;
    status: "online" | "offline";
  } | null;
  store?: { id: string; name: string };
  equipments?: Equipment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationInput {
  name: string;
  omnihubId?: string | null;
}

export type UpdateLocationInput = Partial<CreateLocationInput>;
