import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { EquipmentType } from "@omnihub/shared";
import { EquipmentFunction } from "./equipment-function.entity";
import { OmniHubDevice } from "./omnihub-device.entity";
import { Store } from "./store.entity";

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

  @ManyToOne(() => Store, (s) => s.equipments, { onDelete: "CASCADE" })
  store!: Store;

  @Column({ type: "uuid" })
  storeId!: string;

  @OneToOne(() => OmniHubDevice, (d) => d.equipment, { nullable: true })
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
