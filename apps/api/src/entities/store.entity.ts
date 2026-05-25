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

  // Default hub for this store — used as the IR-send target for any
  // equipment under this store that has no hub assigned at the equipment
  // or location level. Resolution order: Equipment → Location → Store.
  // Distinct from OmniHub.storeId (which tracks physical membership);
  // this is operational fallback.
  @ManyToOne(() => OmniHubDevice, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn()
  omnihub!: OmniHubDevice | null;

  @Column({ type: "uuid", nullable: true })
  omnihubId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
