import net from "node:net";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

interface BusMessage {
  subject: string;
  payload: unknown;
  publishedAt: string;
}

@Injectable()
export class NatsJetStreamService implements OnModuleInit, OnModuleDestroy {
  private connected = false;
  private readonly stream = process.env.NATS_STREAM ?? "ROBOTOPS_STREAM";
  private readonly telemetrySubject = process.env.NATS_SUBJECT_TELEMETRY ?? "ingest.telemetry.v1";
  private messages: BusMessage[] = [];
  private probeTimer?: NodeJS.Timeout;
  private publishedCount = 0;
  private publishErrors = 0;

  async onModuleInit() {
    await this.probeConnectivity();
    this.probeTimer = setInterval(() => {
      void this.probeConnectivity();
    }, 10_000);
  }

  onModuleDestroy() {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
    }
  }

  isConnected() {
    return this.connected;
  }

  getStream() {
    return this.stream;
  }

  getTelemetrySubject() {
    return this.telemetrySubject;
  }

  getStatus() {
    return {
      connected: this.connected,
      stream: this.stream,
      subject: this.telemetrySubject,
      publishedCount: this.publishedCount,
      publishErrors: this.publishErrors,
      queuedMessages: this.messages.length
    };
  }

  async publishTelemetry(payload: unknown) {
    return this.publish(this.telemetrySubject, payload);
  }

  async publish(subject: string, payload: unknown) {
    try {
      this.messages.push({
        subject,
        payload,
        publishedAt: new Date().toISOString()
      });
      this.publishedCount += 1;
      return { accepted: true, connected: this.connected };
    } catch {
      this.publishErrors += 1;
      return { accepted: false, connected: this.connected };
    }
  }

  pull(subject: string, limit: number) {
    const picked: BusMessage[] = [];
    const retained: BusMessage[] = [];

    for (const message of this.messages) {
      if (picked.length < limit && message.subject === subject) {
        picked.push(message);
      } else {
        retained.push(message);
      }
    }

    this.messages = retained;
    return picked;
  }

  private async probeConnectivity() {
    const url = process.env.NATS_URL ?? "nats://localhost:4222";
    try {
      const parsed = new URL(url);
      const host = parsed.hostname || "localhost";
      const port = Number(parsed.port || 4222);

      const reachable = await new Promise<boolean>((resolve) => {
        const socket = net.connect({ host, port, timeout: 800 }, () => {
          socket.destroy();
          resolve(true);
        });

        socket.on("error", () => {
          socket.destroy();
          resolve(false);
        });
        socket.on("timeout", () => {
          socket.destroy();
          resolve(false);
        });
      });

      this.connected = reachable;
    } catch {
      this.connected = false;
    }
  }
}
