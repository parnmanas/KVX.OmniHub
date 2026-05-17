import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Equipment } from "./equipment.entity";
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

  @OneToOne(() => Equipment, (e) => e.omnihub, { nullable: true })
  equipment!: Equipment | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
