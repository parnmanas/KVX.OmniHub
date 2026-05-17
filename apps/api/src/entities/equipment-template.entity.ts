import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { EquipmentType } from "@omnihub/shared";
import { TemplateFunction } from "./template-function.entity";

@Entity("equipment_templates")
export class EquipmentTemplate {
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

  @Column({ type: "uuid", nullable: true })
  createdByStoreId!: string | null;

  @Column({ default: true })
  isPublic!: boolean;

  @OneToMany(() => TemplateFunction, (f) => f.template)
  functions!: TemplateFunction[];

  @CreateDateColumn()
  createdAt!: Date;
}
