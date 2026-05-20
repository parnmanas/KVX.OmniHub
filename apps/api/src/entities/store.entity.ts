import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Location } from "./location.entity";
import { OmniHubDevice } from "./omnihub-device.entity";

@Entity("stores")
export class Store {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "text", nullable: true })
  address!: string | null;

  @Column({ type: "text", nullable: true })
  phone!: string | null;

  @OneToMany(() => OmniHubDevice, (d) => d.store)
  devices!: OmniHubDevice[];

  @OneToMany(() => Location, (l) => l.store)
  locations!: Location[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
