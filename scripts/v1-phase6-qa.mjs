import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { io } from "socket.io-client";

const API_URL = process.env.ROBOTOPS_API_URL ?? "http://localhost:4000/api";
const SOCKET_URL = process.env.ROBOTOPS_SOCKET_URL ?? "http://localhost:4000";
const JWT_SECRET = process.env.JWT_SECRET ?? "robotops-dev-secret";
const TENANT_ID = "t1";
const SITE_ID = "s1";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function issueToken({ role = "Owner", permissions = [] } = {}) {
  return jwt.sign(
    {
      sub: `qa-${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@demo.com`,
      name: `${role} QA`,
      tenantId: TENANT_ID,
      role,
      permissions,
      scope_version: 2
    },
    JWT_SECRET,
    { expiresIn: "30m" }
  );
}

async function request(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    }
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: response.status, body };
}

function connectSocket(token) {
  const socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    extraHeaders: {
      Origin: "http://localhost:3000"
    },
    auth: { token },
    reconnection: false
  });

  return socket;
}

function waitForEvent(socket, event, { timeoutMs = 12000, filter } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    const handler = (payload) => {
      if (filter && !filter(payload)) {
        return;
      }
      cleanup();
      resolve(payload);
    };

    function cleanup() {
      clearTimeout(timer);
      socket.off(event, handler);
    }

    socket.on(event, handler);
  });
}

function waitForNoEvent(socket, event, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(true);
    }, timeoutMs);

    const handler = () => {
      cleanup();
      reject(new Error(`Unexpected ${event} received`));
    };

    function cleanup() {
      clearTimeout(timer);
      socket.off(event, handler);
    }

    socket.on(event, handler);
  });
}

async function waitForConnect(socket, timeoutMs = 12000) {
  if (socket.connected) {
    return;
  }

  await waitForEvent(socket, "connect", { timeoutMs });
}

async function run() {
  const report = { timestamp: new Date().toISOString(), checks: [] };
  const record = (id, ok, details) => report.checks.push({ id, ok, details });

  let primarySocket = null;
  let legacySocket = null;

  try {
    const ownerToken = issueToken({
      role: "Owner",
      permissions: ["robots.read", "missions.read", "incidents.read", "telemetry.ingest", "config.read"]
    });

    // V1P6-QA-001: tenant mismatch rejection.
    primarySocket = connectSocket(ownerToken);
    await waitForConnect(primarySocket);
    primarySocket.emit("subscribe", {
      tenant_id: "wrong-tenant",
      site_id: SITE_ID,
      streams: ["robot_last_state"]
    });
    const tenantMismatch = await waitForEvent(primarySocket, "subscribe.error", {
      filter: (payload) => payload?.code === "tenant_mismatch"
    });
    assert(tenantMismatch.code === "tenant_mismatch", "Expected tenant mismatch subscribe error.");
    record("V1P6-QA-001", true, "subscribe rejects payload tenant mismatch.");

    // V1P6-QA-002: unauthorized stream rejection.
    const robotsOnlyToken = issueToken({ role: "Engineer", permissions: ["robots.read"] });
    const unauthorizedSocket = connectSocket(robotsOnlyToken);
    await waitForConnect(unauthorizedSocket);
    unauthorizedSocket.emit("subscribe", {
      site_id: SITE_ID,
      streams: ["robot_last_state", "incidents"]
    });
    const unauthorizedError = await waitForEvent(unauthorizedSocket, "subscribe.error", {
      filter: (payload) => payload?.code === "forbidden_streams"
    });
    assert(Array.isArray(unauthorizedError.streams) && unauthorizedError.streams.includes("incidents"), "Expected incidents to be rejected for unauthorized stream subscription.");
    unauthorizedSocket.disconnect();
    record("V1P6-QA-002", true, "subscribe rejects unauthorized streams.");

    // V1P6-QA-003: valid subscribe + snapshot delta.
    const subscribedPromise = waitForEvent(primarySocket, "subscribed", {
      filter: (payload) => Array.isArray(payload?.streams) && payload.streams.includes("robot_last_state")
    });
    const snapshotPromise = waitForEvent(primarySocket, "delta", {
      filter: (payload) => payload?.stream === "robot_last_state" && payload?.snapshot === true
    });
    primarySocket.emit("subscribe", {
      site_id: SITE_ID,
      streams: ["robot_last_state"]
    });
    await subscribedPromise;
    const snapshot = await snapshotPromise;
    assert(typeof snapshot.cursor === "string" && snapshot.cursor.length > 0, "Expected snapshot cursor on initial subscribe.");
    record("V1P6-QA-003", true, "subscribe receives initial snapshot delta batch.");

    // V1P6-QA-004: robot_state ingest emits robot_last_state delta upsert.
    const robotsRes = await request(`/robots/last_state?site_id=${SITE_ID}`, ownerToken, { method: "GET" });
    assert(robotsRes.status === 200, "Expected robots/last_state query to succeed.");
    const robot = Array.isArray(robotsRes.body) ? robotsRes.body[0] : null;
    assert(robot?.id, "Expected at least one robot for ingest verification.");
    const robotLastSeenMs = new Date(String(robot.lastSeenAt)).getTime();
    const ingestTimestampMs = Math.max(Date.now() + 3000, robotLastSeenMs + 6000);

    const ingestRes = await request("/ingest/telemetry", ownerToken, {
      method: "POST",
      body: JSON.stringify({
        message_id: crypto.randomUUID(),
        schema_version: 1,
        tenant_id: TENANT_ID,
        site_id: SITE_ID,
        message_type: "robot_state",
        timestamp: new Date(ingestTimestampMs).toISOString(),
        source: {
          source_type: "simulator",
          source_id: "qa-phase6",
          vendor: "vendor_acme",
          protocol: "http"
        },
        entity: {
          entity_type: "robot",
          robot_id: robot.id
        },
        payload: {
          status: "online",
          battery_percent: 88,
          metrics: {
            battery: 88
          },
          pose: {
            floorplan_id: robot.floorplanId,
            x: robot.x,
            y: robot.y,
            heading_degrees: 0,
            confidence: 1
          }
        }
      })
    });
    assert(ingestRes.status === 200 || ingestRes.status === 201, "Expected canonical ingest to accept robot_state payload.");

    const updateDelta = await waitForEvent(primarySocket, "delta", {
      timeoutMs: 15000,
      filter: (payload) =>
        payload?.stream === "robot_last_state" &&
        payload?.snapshot === false &&
        Array.isArray(payload?.upserts) &&
        payload.upserts.some((row) => row?.id === robot.id)
    });
    assert(typeof updateDelta.cursor === "string" && updateDelta.cursor.length > 0, "Expected non-empty delta cursor for robot update.");
    record("V1P6-QA-004", true, "robot_state ingest produces robot_last_state delta upsert.");

    // V1P6-QA-005: legacy compatibility behavior by mode.
    legacySocket = connectSocket(ownerToken);
    await waitForConnect(legacySocket);
    legacySocket.emit("live.subscribe", { channels: ["robots.live"] });

    const pipelineStatus = await request("/system/pipeline-status", ownerToken, { method: "GET" });
    assert(pipelineStatus.status === 200, "Expected /system/pipeline-status response.");
    const mode = pipelineStatus.body?.live?.mode;
    assert(mode === "dual" || mode === "delta_only", "Expected live mode in pipeline status.");

    if (mode === "dual") {
      const legacyEvent = await waitForEvent(legacySocket, "robots.live", { timeoutMs: 12000 });
      assert(Array.isArray(legacyEvent?.data), "Expected legacy robots.live full-array payload in dual mode.");
      record("V1P6-QA-005", true, "legacy live.subscribe remains functional in dual mode.");
    } else {
      await waitForNoEvent(legacySocket, "robots.live", 8000);
      record("V1P6-QA-005", true, "delta_only mode suppresses legacy full-array broadcasts.");
    }

    // V1P6-QA-006: pipeline status includes live metrics counters.
    const pipelineAfter = await request("/system/pipeline-status", ownerToken, { method: "GET" });
    assert(pipelineAfter.status === 200, "Expected /system/pipeline-status follow-up response.");
    assert(typeof pipelineAfter.body?.live?.connected_clients === "number", "Expected live connected_clients metric.");
    assert(typeof pipelineAfter.body?.live?.subscribed_clients === "number", "Expected live subscribed_clients metric.");
    assert(typeof pipelineAfter.body?.live?.delta_messages_sent === "number", "Expected live delta_messages_sent metric.");
    assert(typeof pipelineAfter.body?.live?.delta_bytes_sent === "number", "Expected live delta_bytes_sent metric.");
    assert(typeof pipelineAfter.body?.live?.legacy_messages_sent === "number", "Expected live legacy_messages_sent metric.");
    record("V1P6-QA-006", true, "pipeline status exposes Phase 6 live transport metrics.");
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    try {
      primarySocket?.disconnect();
    } catch {
      // no-op
    }
    try {
      legacySocket?.disconnect();
    } catch {
      // no-op
    }
  }

  const failed = report.checks.filter((check) => !check.ok);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (report.error || failed.length > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  process.stderr.write(`V1 Phase 6 QA failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
