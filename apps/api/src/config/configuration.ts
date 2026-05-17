export interface AppConfig {
  port: number;
  host: string;
  corsOrigin: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  admin: {
    username: string;
    password: string;
  };
  db: DbConfig;
}

export type DbConfig =
  | {
      type: "sqlite";
      database: string;
    }
  | {
      type: "postgres" | "mysql" | "mariadb" | "mssql";
      host: string;
      port: number;
      username: string;
      password: string;
      database: string;
    };

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const dbType = process.env.DB_TYPE ?? "sqlite";

  let db: DbConfig;
  if (dbType === "sqlite") {
    db = {
      type: "sqlite",
      database: process.env.DB_DATABASE ?? "./data/omnihub.sqlite",
    };
  } else if (
    dbType === "postgres" ||
    dbType === "mysql" ||
    dbType === "mariadb" ||
    dbType === "mssql"
  ) {
    db = {
      type: dbType,
      host: required("DB_HOST", process.env.DB_HOST),
      port: parseInt(required("DB_PORT", process.env.DB_PORT), 10),
      username: required("DB_USERNAME", process.env.DB_USERNAME),
      password: required("DB_PASSWORD", process.env.DB_PASSWORD),
      database: required("DB_DATABASE", process.env.DB_DATABASE),
    };
  } else {
    throw new Error(`Unsupported DB_TYPE: ${dbType}`);
  }

  return {
    port: parseInt(process.env.PORT ?? "3000", 10),
    host: process.env.HOST ?? "0.0.0.0",
    corsOrigin: process.env.CORS_ORIGIN ?? "*",
    jwt: {
      secret: required("JWT_SECRET", process.env.JWT_SECRET),
      expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
    },
    admin: {
      username: process.env.ADMIN_USERNAME ?? "admin",
      password: process.env.ADMIN_PASSWORD ?? "admin1234",
    },
    db,
  };
}
