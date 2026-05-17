import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OmniHubDevice } from "../entities";
import { DeviceRegistry } from "./device-registry.service";
import { OmnihubGateway } from "./omnihub.gateway";

@Module({
  imports: [TypeOrmModule.forFeature([OmniHubDevice])],
  providers: [DeviceRegistry, OmnihubGateway],
  exports: [DeviceRegistry, OmnihubGateway],
})
export class GatewaysModule {}
