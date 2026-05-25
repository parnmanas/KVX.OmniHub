export interface Omnihub {
  id: string;
  deviceId: string;
  name: string | null;
  status: "online" | "offline";
  lastSeenAt: string | null;
  firmwareVersion: string | null;
  storeId: string | null;
  store: { id: string; name: string } | null;
  // 1:N — one hub can host many equipments.
  equipments: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOmnihubInput {
  deviceId: string;
  name?: string;
  storeId?: string;
}

export interface UpdateOmnihubInput {
  name?: string;
  storeId?: string | null;
}
