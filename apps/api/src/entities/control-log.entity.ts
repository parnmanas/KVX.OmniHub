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

  // For RS232 status queries: the projector's reply bytes as a hex string.
  // null for IR/RELAY/WOL/HTTP/etc. or when the command didn't request a
  // read-back. Stored so future "status history" UI can graph lamp hours
  // over time without re-running queries.
  @Column({ type: "text", nullable: true })
  response!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
