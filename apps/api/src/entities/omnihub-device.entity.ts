import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Equipment } from "./equipment.entity";
import { Location } from "./location.entity";
import { Store } from "./store.entity";

export type DeviceStatus = "online" | "offline";

@Entity("omnihub_devices")
export class OmniHubDevice {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column()
  deviceId!: string; // MAC address

  @Column({ type: "text", nullable: true })
  name!: string | null;

  @Column({ type: "text", nullable: true })
  pairingCode!: string | null;

  @Column({ type: "text", nullable: true })
  authTokenHash!: string | null;

  @Column({ type: "varchar", default: "offline" })
  status!: DeviceStatus;

  @Column({ type: "datetime", nullable: true })
  lastSeenAt!: Date | null;

  @Column({ type: "text", nullable: true })
  firmwareVersion!: string | null;

  @ManyToOne(() => Store, (s) => s.devices, {
    nullable: true,
    onDelete: "SET NULL",
  })
  store!: Store | null;

  @Column({ type: "uuid", nullable: true })
  storeId!: string | null;

  // Optional finer-grained placement: if set, this hub specifically lives
  // at this location within the store. Fallback resolution prefers a hub
  // matching the equipment's locationId; only if none, it falls back to
  // a hub with locationId IS NULL at the same storeId.
  @ManyToOne(() => Location, (l) => l.devices, {
    nullable: true,
    onDelete: "SET NULL",
  })
  location!: Location | null;

  @Column({ type: "uuid", nullable: true })
  locationId!: string | null;

  // One hub can host many equipments (1:N) — a single IR blaster in a
  // room controls all the IR devices in that room.
  @OneToMany(() => Equipment, (e) => e.omnihub)
  equipments!: Equipment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
