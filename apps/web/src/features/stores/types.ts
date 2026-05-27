import type { EquipmentType } from "@omnihub/shared";

export interface Store {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  // Hubs physically placed at this store (Hub.storeId → this).
  devices?: OmnihubLite[];
  equipments?: EquipmentLite[];
}

export interface OmnihubLite {
  id: string;
  deviceId: string;
  name: string | null;
  status: "online" | "offline";
  storeId?: string | null;
  locationId?: string | null;
  location?: { id: string; name: string } | null;
}

export interface EquipmentLite {
  id: string;
  type: EquipmentType;
  name: string;
  manufacturer: string;
  model: string;
}

export interface CreateStoreInput {
  name: string;
  address?: string;
  phone?: string;
}

export type UpdateStoreInput = Partial<CreateStoreInput>;
