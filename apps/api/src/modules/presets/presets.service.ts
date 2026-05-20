import { existsSync, readFileSync, readdirSync } from "node:fs";
import * as path from "node:path";
import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import type { IrPreset, IrPresetSummary } from "./presets.types";

// Walk up from a starting directory until we find a sentinel file that marks
// the monorepo root. This lets the service load presets regardless of whether
// it's running from src/ (ts-node dev) or dist/ (compiled build).
function findMonorepoRoot(start: string): string {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error(`monorepo root (pnpm-workspace.yaml) not found from ${start}`);
}

function presetsDir(): string {
  // Operator override for non-standard deployments.
  if (process.env.IRPRESETS_DIR) return process.env.IRPRESETS_DIR;
  const root = findMonorepoRoot(__dirname);
  return path.join(root, "tools", "ir-presets");
}

@Injectable()
export class PresetsService implements OnModuleInit {
  private readonly log = new Logger(PresetsService.name);
  private readonly presets = new Map<string, IrPreset>();

  onModuleInit(): void {
    const dir = presetsDir();
    if (!existsSync(dir)) {
      this.log.warn(
        `presets dir not found at ${dir} — IR preset endpoints will return empty`,
      );
      return;
    }
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      const name = f.replace(/\.json$/, "");
      const filePath = path.join(dir, f);
      try {
        const parsed = JSON.parse(readFileSync(filePath, "utf8")) as IrPreset;
        if (!parsed.brand || !parsed.device || !parsed.commands) {
          this.log.warn(
            `skipping ${f}: missing required fields (brand/device/commands)`,
          );
          continue;
        }
        this.presets.set(name, parsed);
      } catch (err) {
        this.log.warn(`failed to parse ${f}: ${(err as Error).message}`);
      }
    }
    this.log.log(
      `loaded ${this.presets.size} IR presets from ${dir} ` +
        `(${Array.from(this.presets.keys()).join(", ")})`,
    );
  }

  list(): IrPresetSummary[] {
    return Array.from(this.presets.entries())
      .map(([name, p]) => ({
        name,
        brand: p.brand,
        device: p.device,
        commandCount: Object.keys(p.commands).length,
      }))
      .sort((a, b) =>
        a.brand === b.brand
          ? a.device.localeCompare(b.device)
          : a.brand.localeCompare(b.brand),
      );
  }

  get(name: string): IrPreset {
    const p = this.presets.get(name);
    if (!p) {
      throw new NotFoundException(`preset not found: ${name}`);
    }
    return p;
  }

  has(name: string): boolean {
    return this.presets.has(name);
  }
}

