import { Injectable, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { Repository } from "typeorm";
import type { AppConfig } from "../../config/configuration";
import { AdminUser } from "../../entities";

export interface JwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(AdminUser)
    private readonly admins: Repository<AdminUser>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.admins.count();
    if (count > 0) return;
    const { username, password } = this.config.get("admin", { infer: true });
    const passwordHash = await argon2.hash(password);
    await this.admins.save({ username, passwordHash });
    // eslint-disable-next-line no-console
    console.log(`[auth] seeded default admin "${username}"`);
  }

  async validate(username: string, password: string): Promise<AdminUser> {
    const user = await this.admins.findOne({ where: { username } });
    if (!user) throw new UnauthorizedException("invalid credentials");
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException("invalid credentials");
    return user;
  }

  signToken(user: AdminUser): string {
    const payload: JwtPayload = { sub: user.id, username: user.username };
    return this.jwt.sign(payload);
  }
}
