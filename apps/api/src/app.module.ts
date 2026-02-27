import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./controllers/app.controller";
import { AuthModule } from "./auth/auth.module";
import { OpsController } from "./controllers/ops.controller";
import { CopilotController } from "./controllers/copilot.controller";
import { PrismaService } from "./services/prisma.service";
import { OpsService } from "./services/ops.service";
import { CopilotService } from "./services/copilot.service";
import { AuditService } from "./services/audit.service";
import { NatsJetStreamService } from "./services/nats-jetstream.service";
import { InfrastructureService } from "./services/infrastructure.service";
import { Phase3Service } from "./services/phase3.service";
import { LiveGateway } from "./realtime/live.gateway";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
  controllers: [AppController, OpsController, CopilotController],
  providers: [
    PrismaService,
    OpsService,
    CopilotService,
    AuditService,
    NatsJetStreamService,
    InfrastructureService,
    Phase3Service,
    LiveGateway
  ]
})
export class AppModule {}
