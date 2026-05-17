import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { ControlType, FunctionPayload } from "@omnihub/shared";
import { Equipment } from "./equipment.entity";

@Entity("equipment_functions")
export class EquipmentFunction {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "text", nullable: true })
  icon!: string | null;

  @Column({ type: "varchar" })
  controlType!: ControlType;

  @Column({ type: "simple-json" })
  payload!: FunctionPayload;

  @Column({ type: "int", default: 0 })
  order!: number;

  @ManyToOne(() => Equipment, (e) => e.functions, { onDelete: "CASCADE" })
  equipment!: Equipment;

  @Column({ type: "uuid" })
  equipmentId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
