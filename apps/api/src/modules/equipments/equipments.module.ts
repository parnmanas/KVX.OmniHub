import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  ControlLog,
  Equipment,
  EquipmentFunction,
  OmniHubDevice,
  Store,
} from "../../entities";
import { GatewaysModule } from "../../gateways/gateways.module";
import { EquipmentsController } from "./equipments.controller";
import { EquipmentsService } from "./equipments.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ControlLog,
      Equipment,
      EquipmentFunction,
      OmniHubDevice,
      Store,
    ]),
    GatewaysModule,
  ],
  controllers: [EquipmentsController],
  providers: [EquipmentsService],
  exports: [EquipmentsService],
})
export class EquipmentsModule {}
