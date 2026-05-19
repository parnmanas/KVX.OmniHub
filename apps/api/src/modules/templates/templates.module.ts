import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  Equipment,
  EquipmentFunction,
  EquipmentTemplate,
  OmniHubDevice,
  Store,
  TemplateFunction,
} from "../../entities";
import { GatewaysModule } from "../../gateways/gateways.module";
import { TemplatesController } from "./templates.controller";
import { TemplatesService } from "./templates.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EquipmentTemplate,
      TemplateFunction,
      Equipment,
      EquipmentFunction,
      Store,
      OmniHubDevice,
    ]),
    GatewaysModule,
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
