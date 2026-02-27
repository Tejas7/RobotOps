import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { NatsJetStreamService } from "./nats-jetstream.service";
import { PrismaService } from "./prisma.service";

@Injectable()
export class InfrastructureService {
  private readonly logger = new Logger(InfrastructureService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NatsJetStreamService) private readonly nats: NatsJetStreamService
  ) {}

  async runStartupChecks() {
    const [timescale, nats] = await Promise.all([this.getTimescaleStatus(), Promise.resolve(this.nats.getStatus())]);

    if (!timescale.extensionAvailable) {
      this.logger.warn("TimescaleDB extension not detected. Falling back to standard PostgreSQL telemetry queries.");
    }
    if (!nats.connected) {
      this.logger.warn("NATS not reachable. Ingestion will run in local queued mode.");
    }
  }

  async getTimescaleStatus() {
    try {
      const extensionRows = await this.prisma.$queryRaw<Array<{ available: boolean }>>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
        ) AS available
      `);
      const hypertableRows = await this.prisma.$queryRaw<Array<{ ready: boolean }>>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM timescaledb_information.hypertables
          WHERE hypertable_name = 'TelemetryPoint'
        ) AS ready
      `);
      const caggRows = await this.prisma.$queryRaw<Array<{ view_name: string }>>(Prisma.sql`
        SELECT view_name
        FROM timescaledb_information.continuous_aggregates
        WHERE view_name IN ('telemetry_rollup_5m', 'telemetry_rollup_1h')
      `);

      return {
        extensionAvailable: Boolean(extensionRows[0]?.available),
        hypertableReady: Boolean(hypertableRows[0]?.ready),
        continuousAggregates: caggRows.map((row) => row.view_name)
      };
    } catch {
      // Gracefully support local PostgreSQL without timescaledb catalog tables.
      return {
        extensionAvailable: false,
        hypertableReady: false,
        continuousAggregates: [] as string[]
      };
    }
  }
}
