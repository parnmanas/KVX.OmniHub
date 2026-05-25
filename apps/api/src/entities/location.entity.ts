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

  // Default hub for this location — used when an equipment in this
  // location has no hub assigned. Overrides the store-level default.
  // Resolution order: Equipment → Location → Store.
  @ManyToOne(() => OmniHubDevice, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn()
  omnihub!: OmniHubDevice | null;

  @Column({ type: "uuid", nullable: true })
  omnihubId!: string | null;

  @OneToMany(() => Equipment, (e) => e.location)
  equipments!: Equipment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
