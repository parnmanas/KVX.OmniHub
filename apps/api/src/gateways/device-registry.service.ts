import { Injectable, Logger } from "@nestjs/common";
import type { WebSocket } from "ws";

interface AuthenticatedDevice {
  deviceId: string; // normalized MAC
  ws: WebSocket;
  lastSeenAt: number;
  lastPongAt: number;
}

interface PendingPairing {
  pairingCode: string;
  deviceId: string;
  fw: string;
  ws: WebSocket;
  createdAt: number;
}

@Injectable()
export class DeviceRegistry {
  private readonly log = new Logger(DeviceRegistry.name);
  private readonly devices = new Map<string, AuthenticatedDevice>();
  private readonly pendings = new Map<string, PendingPairing>(); // by pairingCode

  // ---------- authenticated devices ----------

  addAuthenticated(deviceId: string, ws: WebSocket): void {
    const existing = this.devices.get(deviceId);
    if (existing && existing.ws !== ws) {
      this.log.warn(`evicting previous socket for ${deviceId}`);
      try {
        existing.ws.close(4001, "replaced");
      } catch {
        /* ignore */
      }
    }
    const now = Date.now();
    this.devices.set(deviceId, {
      deviceId,
      ws,
      lastSeenAt: now,
      lastPongAt: now,
    });
  }

  removeBySocket(ws: WebSocket): string | null {
    for (const [id, dev] of this.devices) {
      if (dev.ws === ws) {
        this.devices.delete(id);
        return id;
      }
    }
    return null;
  }

  get(deviceId: string): AuthenticatedDevice | undefined {
    return this.devices.get(deviceId);
  }

  touch(deviceId: string): void {
    const dev = this.devices.get(deviceId);
    if (dev) dev.lastSeenAt = Date.now();
  }

  markPong(deviceId: string): void {
    const dev = this.devices.get(deviceId);
    if (dev) {
      const now = Date.now();
      dev.lastPongAt = now;
      dev.lastSeenAt = now;
    }
  }

  listAuthenticated(): AuthenticatedDevice[] {
    return [...this.devices.values()];
  }

  // ---------- pending pairings ----------

  addPending(p: Omit<PendingPairing, "createdAt">): void {
    // remove any prior pending with same deviceId
    for (const [code, pending] of this.pendings) {
      if (pending.deviceId === p.deviceId) this.pendings.delete(code);
    }
    this.pendings.set(p.pairingCode, { ...p, createdAt: Date.now() });
  }

  removePending(pairingCode: string): PendingPairing | undefined {
    const p = this.pendings.get(pairingCode);
    if (p) this.pendings.delete(pairingCode);
    return p;
  }

  removePendingBySocket(ws: WebSocket): void {
    for (const [code, pending] of this.pendings) {
      if (pending.ws === ws) this.pendings.delete(code);
    }
  }

  listPending(): PendingPairing[] {
    return [...this.pendings.values()];
  }
}
