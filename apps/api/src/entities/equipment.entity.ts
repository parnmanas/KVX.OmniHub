import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { EquipmentType } from "@omnihub/shared";
import { EquipmentFunction } from "./equipment-function.entity";
import { Location } from "./location.entity";
import { OmniHubDevice } from "./omnihub-device.entity";

@Entity("equipments")
export class Equipment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  type!: EquipmentType;

  @Column()
  manufacturer!: string;

  @Column()
  model!: string;

  @Column()
  name!: string;

  @ManyToOne(() => Location, (l) => l.equipments, { onDelete: "CASCADE" })
  location!: Location;

  @Column({ type: "uuid" })
  locationId!: string;

  // Many equipments can share one OmniHub — one IR blaster in a room
  // typically controls several devices (TV + AC + projector).
  @ManyToOne(() => OmniHubDevice, (d) => d.equipments, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn()
  omnihub!: OmniHubDevice | null;

  @Column({ type: "uuid", nullable: true })
  omnihubId!: string | null;

  @OneToMany(() => EquipmentFunction, (f) => f.equipment)
  functions!: EquipmentFunction[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
