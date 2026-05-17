import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type ControlResult = "success" | "fail" | "timeout";
export type TriggerSource = "user" | "schedule" | "api";

@Entity("control_logs")
export class ControlLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "uuid" })
  equipmentId!: string;

  @Column({ type: "uuid" })
  functionId!: string;

  @Column({ type: "varchar" })
  triggeredBy!: TriggerSource;

  @Column({ type: "varchar" })
  result!: ControlResult;

  @Column({ type: "text", nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
