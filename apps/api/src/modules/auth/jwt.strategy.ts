import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AppConfig } from "../../config/configuration";
import type { JwtPayload } from "./auth.service";

export const AUTH_COOKIE_NAME = "omnihub_token";

function cookieExtractor(req: Request): string | null {
  if (!req || !req.cookies) return null;
  const token = req.cookies[AUTH_COOKIE_NAME];
  return typeof token === "string" ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get("jwt", { infer: true }).secret,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
