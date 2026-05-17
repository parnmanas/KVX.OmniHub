import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
import * as entities from "../entities";
import type { AppConfig } from "../config/configuration";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): TypeOrmModuleOptions => {
        const db = config.get("db", { infer: true });
        const common = {
          entities: Object.values(entities),
          synchronize: true, // dev only; use migrations in prod
          logging: false,
        };
        if (db.type === "sqlite") {
          return { ...common, type: "sqlite", database: db.database };
        }
        return {
          ...common,
          type: db.type,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
