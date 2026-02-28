import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const API_URL = process.env.ROBOTOPS_API_URL ?? "http://localhost:4000/api";
const JWT_SECRET = process.env.JWT_SECRET ?? "robotops-dev-secret";
const TENANT_ID = "t1";
const SITE_ID = "s1";
const ROBOT_ID = "r6";
const MISSION_ID = "m2";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function ownerToken() {
  return jwt.sign(
    {
      sub: "u1",
      email: "owner@demo.com",
      name: "Alice Owner",
      tenantId: TENANT_ID,
      role: "Owner",
      permissions: [],
      scope_version: 2
    },
    JWT_SECRET,
    { expiresIn: "30m" }
  );
}

function baseEnvelope(overrides = {}) {
  return {
    message_id: crypto.randomUUID(),
    schema_version: 1,
    tenant_id: TENANT_ID,
    site_id: SITE_ID,
    message_type: "robot_state",
    timestamp: new Date().toISOString(),
    source: {
      source_type: "edge",
      source_id: "qa-edge-v1p2",
      vendor: "qa_vendor",
      protocol: "http"
    },
    entity: {
      entity_type: "robot",
      robot_id: ROBOT_ID
    },
    payload: {
      status: "online",
      battery_percent: 70
    },
    ...overrides
  };
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
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function waitFor(check, timeoutMs = 9000, intervalMs = 300) {
  const started = Date.now();
  while (true) {
    const done = await check();
    if (done) {
      return;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for read-model updates");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

function extractVendorId(row) {
  if (typeof row?.vendor === "string") {
    return row.vendor;
  }
  if (row?.vendor && typeof row.vendor === "object" && typeof row.vendor.id === "string") {
    return row.vendor.id;
  }
  return null;
}

function extractTags(row) {
  return Array.isArray(row?.tags) ? row.tags : [];
}

async function fetchLastStateByRobot(token, robotId = ROBOT_ID) {
  const res = await request(`/robots/last_state?site_id=${SITE_ID}`, token, { method: "GET" });
  assert(res.status === 200, "Failed to fetch /robots/last_state");
  assert(Array.isArray(res.body), "Expected /robots/last_state response to be an array");
  return res.body.find((row) => row.id === robotId) ?? null;
}

async function run() {
  const token = ownerToken();
  const report = {
    timestamp: new Date().toISOString(),
    checks: []
  };
  const record = (id, ok, details) => report.checks.push({ id, ok, details });

  try {
    {
      const invalid = await request("/robots/last_state?status=invalid_status", token, { method: "GET" });
      assert(invalid.status >= 400, "Invalid status filter should be rejected.");
      record("V1P2-QA-001", true, "Rejects invalid /robots/last_state filters.");
    }

    {
      const filtered = await request("/robots/last_state?site_id=s1&vendor=v1&tag=picker", token, { method: "GET" });
      assert(filtered.status === 200, "Expected filtered /robots/last_state query to succeed.");
      assert(Array.isArray(filtered.body), "Expected filtered response to be an array.");
      assert(filtered.body.length > 0, "Expected at least one filtered robot row.");
      const allMatch = filtered.body.every((row) => extractVendorId(row) === "v1" && extractTags(row).includes("picker"));
      assert(allMatch, "Filtered /robots/last_state rows did not match vendor/tag constraints.");
      record("V1P2-QA-002", true, "site_id/vendor/tag filters return expected subset.");
    }

    const staleEnvelope = baseEnvelope({
      message_type: "robot_state",
      timestamp: new Date(Date.now() - 90_000).toISOString(),
      payload: {
        status: "online",
        battery_percent: 66,
        telemetry: {
          cpu_percent: 28,
          memory_percent: 31,
          disk_percent: 37,
          temp_c: 34,
          network_rssi: -53
        },
        pose: {
          floorplan_id: "f1",
          x: 42.3,
          y: 23.1,
          heading_degrees: 90,
          confidence: 0.91
        }
      }
    });
    {
      const ingest = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(staleEnvelope)
      });
      assert(ingest.status === 201 || ingest.status === 200, "Stale robot_state ingest should be accepted.");
      record("V1P2-QA-003A", true, "robot_state accepted for stale/offline computation scenario.");
    }

    let staleState = null;
    await waitFor(async () => {
      staleState = await fetchLastStateByRobot(token);
      if (!staleState) {
        return false;
      }
      return (
        staleState.status === "offline" &&
        staleState.reported_status === "online" &&
        staleState.is_offline_computed === true &&
        staleState.batteryPercent === 66
      );
    });
    assert(staleState, "Expected stale state row for robot.");
    record("V1P2-QA-003B", true, "Offline status is computed at read time from site timeout.");

    const freshEnvelope = baseEnvelope({
      message_type: "robot_state",
      timestamp: new Date().toISOString(),
      payload: {
        status: "degraded",
        battery_percent: 63,
        telemetry: {
          cpu_percent: 61,
          memory_percent: 58,
          disk_percent: 41,
          temp_c: 44,
          network_rssi: -61
        },
        task: {
          task_id: MISSION_ID,
          state: "running",
          percent_complete: 47
        },
        pose: {
          floorplan_id: "f1",
          x: 39.8,
          y: 21.4,
          heading_degrees: 81,
          confidence: 0.88
        }
      }
    });
    {
      const ingest = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(freshEnvelope)
      });
      assert(ingest.status === 201 || ingest.status === 200, "Fresh robot_state ingest should be accepted.");
      record("V1P2-QA-004A", true, "robot_state upsert accepted for fresh online/degraded scenario.");
    }

    let freshState = null;
    await waitFor(async () => {
      freshState = await fetchLastStateByRobot(token);
      if (!freshState) {
        return false;
      }
      return (
        freshState.status === "degraded" &&
        freshState.reported_status === "degraded" &&
        freshState.is_offline_computed === false &&
        freshState.currentTaskId === MISSION_ID &&
        freshState.currentTaskState === "running" &&
        freshState.currentTaskPercentComplete === 47
      );
    });
    assert(freshState, "Expected fresh state row for robot.");
    const readModelUpdatedAt = freshState.updatedAt;
    record("V1P2-QA-004B", true, "Fresh robot_state updates RobotLastState and task fields.");

    {
      const compatibility = await request(`/robots?site_id=${SITE_ID}&status=degraded`, token, { method: "GET" });
      assert(compatibility.status === 200, "Expected compatibility /robots route to succeed.");
      assert(Array.isArray(compatibility.body), "Expected compatibility /robots response to be an array.");
      assert(compatibility.body.some((robot) => robot.id === ROBOT_ID), "Expected /robots compatibility route to source updated read model.");
      record("V1P2-QA-005", true, "Compatibility /robots route remains functional with read-model source.");
    }

    {
      const robotEvent = baseEnvelope({
        message_type: "robot_event",
        payload: {
          dedupe_key: `v1p2-${Date.now()}-read-model-guard`,
          event_type: "qa_read_model_guard",
          severity: "warning",
          category: "connectivity",
          title: "QA V1P2 Event",
          message: "robot_event should not mutate RobotLastState",
          create_incident: true
        }
      });
      const ingest = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(robotEvent)
      });
      assert(ingest.status === 201 || ingest.status === 200, "robot_event ingest should be accepted.");

      await waitFor(async () => {
        const row = await fetchLastStateByRobot(token);
        return Boolean(row && row.updatedAt === readModelUpdatedAt);
      });
      record("V1P2-QA-006", true, "robot_event does not mutate RobotLastState.");
    }

    {
      const taskStatus = baseEnvelope({
        message_type: "task_status",
        payload: {
          task_id: MISSION_ID,
          state: "running",
          percent_complete: 73,
          message: "task_status should not mutate RobotLastState"
        }
      });
      const ingest = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(taskStatus)
      });
      assert(ingest.status === 201 || ingest.status === 200, "task_status ingest should be accepted.");

      await waitFor(async () => {
        const row = await fetchLastStateByRobot(token);
        return Boolean(row && row.updatedAt === readModelUpdatedAt);
      });
      record("V1P2-QA-007", true, "task_status does not mutate RobotLastState.");
    }

    console.log(JSON.stringify({ ok: true, report }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error), report }, null, 2));
    process.exit(1);
  }
}

void run();
