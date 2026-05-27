export interface Omnihub {
  id: string;
  deviceId: string;
  name: string | null;
  status: "online" | "offline";
  lastSeenAt: string | null;
  firmwareVersion: string | null;
  storeId: string | null;
  store: { id: string; name: string } | null;
  // Optional finer-grained placement within the store.
  locationId: string | null;
  location: { id: string; name: string; storeId: string } | null;
  // 1:N — one hub can host many equipments.
  equipments: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOmnihubInput {
  deviceId: string;
  name?: string;
  storeId?: string;
  locationId?: string;
}

export interface UpdateOmnihubInput {
  name?: string;
  storeId?: string | null;
  locationId?: string | null;
}
