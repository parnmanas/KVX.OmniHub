import type { EquipmentType, FunctionPayload, ControlType } from "@omnihub/shared";

export interface EquipmentFunction {
  id: string;
  equipmentId: string;
  name: string;
  icon: string | null;
  controlType: ControlType;
  payload: FunctionPayload;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Equipment {
  id: string;
  locationId: string;
  location?: {
    id: string;
    name: string;
    storeId: string;
    store?: { id: string; name: string };
  };
  type: EquipmentType;
  manufacturer: string;
  model: string;
  name: string;
  omnihubId: string | null;
  omnihub: {
    id: string;
    deviceId: string;
    name: string | null;
    status: "online" | "offline";
  } | null;
  functions?: EquipmentFunction[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateEquipmentInput {
  locationId: string;
  type: EquipmentType;
  manufacturer: string;
  model: string;
  name: string;
  omnihubId?: string;
}

export interface UpdateEquipmentInput {
  type?: EquipmentType;
  manufacturer?: string;
  model?: string;
  name?: string;
  omnihubId?: string | null;
}
