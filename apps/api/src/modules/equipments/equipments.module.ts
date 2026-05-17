import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  Equipment,
  EquipmentFunction,
  OmniHubDevice,
  Store,
} from "../../entities";
import { EquipmentsController } from "./equipments.controller";
import { EquipmentsService } from "./equipments.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Equipment, EquipmentFunction, OmniHubDevice, Store]),
  ],
  controllers: [EquipmentsController],
  providers: [EquipmentsService],
  exports: [EquipmentsService],
})
export class EquipmentsModule {}
