import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  ControlLog,
  Equipment,
  EquipmentFunction,
  Location,
  OmniHubDevice,
} from "../../entities";
import { GatewaysModule } from "../../gateways/gateways.module";
import { PresetsModule } from "../presets/presets.module";
import { EquipmentsController } from "./equipments.controller";
import { EquipmentsService } from "./equipments.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ControlLog,
      Equipment,
      EquipmentFunction,
      Location,
      OmniHubDevice,
    ]),
    GatewaysModule,
    PresetsModule,
  ],
  controllers: [EquipmentsController],
  providers: [EquipmentsService],
  exports: [EquipmentsService],
})
export class EquipmentsModule {}
