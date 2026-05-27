import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Location, OmniHubDevice, Store } from "../../entities";
import { GatewaysModule } from "../../gateways/gateways.module";
import { OmnihubsController } from "./omnihubs.controller";
import { OmnihubsService } from "./omnihubs.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([OmniHubDevice, Store, Location]),
    GatewaysModule,
  ],
  controllers: [OmnihubsController],
  providers: [OmnihubsService],
  exports: [OmnihubsService],
})
export class OmnihubsModule {}
