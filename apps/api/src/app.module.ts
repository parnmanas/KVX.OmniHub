import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { loadConfig } from "./config/configuration";
import { DatabaseModule } from "./database/database.module";
import { GatewaysModule } from "./gateways/gateways.module";
import { AuthModule } from "./modules/auth/auth.module";
import { EquipmentsModule } from "./modules/equipments/equipments.module";
import { LocationsModule } from "./modules/locations/locations.module";
import { OmnihubsModule } from "./modules/omnihubs/omnihubs.module";
import { PresetsModule } from "./modules/presets/presets.module";
import { StoresModule } from "./modules/stores/stores.module";
import { TemplatesModule } from "./modules/templates/templates.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule,
    GatewaysModule,
    AuthModule,
    StoresModule,
    LocationsModule,
    OmnihubsModule,
    PresetsModule,
    TemplatesModule,
    EquipmentsModule,
  ],
})
export class AppModule {}
