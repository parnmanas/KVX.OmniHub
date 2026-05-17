import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { ControlType, FunctionPayload } from "@omnihub/shared";
import { EquipmentTemplate } from "./equipment-template.entity";

@Entity("template_functions")
export class TemplateFunction {
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

  @ManyToOne(() => EquipmentTemplate, (t) => t.functions, {
    onDelete: "CASCADE",
  })
  template!: EquipmentTemplate;

  @Column({ type: "uuid" })
  templateId!: string;
}
