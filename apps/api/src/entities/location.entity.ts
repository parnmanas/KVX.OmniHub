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

  @OneToMany(() => Equipment, (e) => e.location)
  equipments!: Equipment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
