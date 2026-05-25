import type {
  EquipmentType,
  FunctionPayload,
  ControlType,
  EquipmentCapability,
} from "@omnihub/shared";

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

// Hub source: which level supplied the hub used to drive this equipment.
// "equipment" = hub assigned directly on the equipment row.
// "location"  = inherited from the location's default hub.
// "store"     = inherited from the store's default hub.
// null        = no hub at any level → controls are disabled.
export type ResolvedOmnihubSource = "equipment" | "location" | "store" | null;

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
  // The hub that the server will actually use when this equipment's
  // functions are played. Computed server-side as Equipment → Location →
  // Store fallback so the UI doesn't need to know about the hierarchy.
  resolvedOmnihub: {
    id: string;
    deviceId: string;
    name: string | null;
    status: "online" | "offline";
  } | null;
  resolvedOmnihubSource: ResolvedOmnihubSource;
  // High-level controls inferred from the function list (server-side).
  // Empty array when the equipment has no functions. UI uses this to
  // render unified widgets — see CapabilityPanel.
  capabilities: EquipmentCapability[];
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
