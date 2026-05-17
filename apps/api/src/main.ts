import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { WsAdapter } from "@nestjs/platform-ws";
import cookieParser from "cookie-parser";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AppModule } from "./app.module";
import type { AppConfig } from "./config/configuration";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });
  const config = app.get(ConfigService<AppConfig, true>);

  // Ensure SQLite data dir exists (TypeORM auto-creates the file but not the dir)
  const db = config.get("db", { infer: true });
  if (db.type === "sqlite") {
    const dir = dirname(resolve(db.database));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  app.use(cookieParser());
  app.useWebSocketAdapter(new WsAdapter(app));
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const corsOrigin = config.get("corsOrigin", { infer: true });
  app.enableCors({
    // "*" => reflect request origin (works with credentialed cookies on LAN dev)
    origin: corsOrigin === "*" ? true : corsOrigin,
    credentials: true,
  });

  const port = config.get("port", { infer: true });
  const host = config.get("host", { infer: true });
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://${host}:${port}`);
}

void bootstrap();
