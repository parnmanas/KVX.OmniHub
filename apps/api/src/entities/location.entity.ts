import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Equipment } from "./equipment.entity";
import { OmniHubDevice } from "./omnihub-device.entity";
import { Store } from "./store.entity";

@Entity("locations")
export class Location {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Store, (s) => s.locations, { onDelete: "CASCADE" })
  store!: Store;

  @Column({ type: "uuid" })
  storeId!: string;

  @Column()
  name!: string;

  // Hubs physically placed at this location (Hub.locationId → here).
  // Fallback resolution treats any of these as a candidate for equipments
  // under this location that don't pin their own hub.
  @OneToMany(() => OmniHubDevice, (d) => d.location)
  devices!: OmniHubDevice[];

  @OneToMany(() => Equipment, (e) => e.location)
  equipments!: Equipment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
