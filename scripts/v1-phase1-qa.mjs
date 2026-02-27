import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const API_URL = process.env.ROBOTOPS_API_URL ?? "http://localhost:4000/api";
const JWT_SECRET = process.env.JWT_SECRET ?? "robotops-dev-secret";
const TENANT_ID = "t1";
const SITE_ID = "s1";
const ROBOT_ID = "r1";

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
      source_id: "qa-edge-1",
      vendor: "qa_vendor",
      protocol: "http"
    },
    entity: {
      entity_type: "robot",
      robot_id: ROBOT_ID
    },
    payload: {
      status: "online",
      battery_percent: 77,
      metrics: {
        battery: 77,
        temp_c: 36.4,
        cpu_percent: 33,
        network_rssi: -60,
        disk_percent: 54
      }
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

async function waitFor(check, timeoutMs = 7000, intervalMs = 300) {
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const done = await check();
    if (done) {
      return;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for asynchronous ingestion side effects");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function run() {
  const token = ownerToken();
  const report = {
    timestamp: new Date().toISOString(),
    checks: []
  };

  const record = (id, ok, details) => report.checks.push({ id, ok, details });

  try {
    // V1P1-QA-001: reject unknown message_type.
    {
      const payload = baseEnvelope({ message_type: "unknown_type" });
      const res = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      assert(res.status >= 400, "Unknown message_type should be rejected.");
      record("V1P1-QA-001A", true, "Rejects unknown message_type.");
    }

    // V1P1-QA-001: reject payload mismatch for declared message_type.
    {
      const payload = baseEnvelope({
        message_type: "robot_state",
        payload: {
          event_type: "bad_shape"
        }
      });
      const res = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      assert(res.status >= 400, "Invalid robot_state payload should be rejected.");
      record("V1P1-QA-001B", true, "Rejects invalid payload for declared message_type.");
    }

    // V1P1-QA-004: reject unsupported schema_version.
    {
      const payload = baseEnvelope({ schema_version: 99 });
      const res = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      assert(res.status >= 400, "Unsupported schema_version should be rejected.");
      record("V1P1-QA-004A", true, "Rejects unsupported schema_version.");
    }

    const incidentsBefore = await request(`/incidents?site_id=${SITE_ID}`, token, { method: "GET" });
    assert(incidentsBefore.status === 200, "Failed to read incidents baseline.");
    const incidentCountBefore = Array.isArray(incidentsBefore.body) ? incidentsBefore.body.length : 0;

    const missionBefore = await request("/missions/m2", token, { method: "GET" });
    assert(missionBefore.status === 200, "Failed to read mission baseline.");
    const missionEventCountBefore = Array.isArray(missionBefore.body?.missionEvents) ? missionBefore.body.missionEvents.length : 0;

    // V1P1-QA-002 + V1P1-QA-003: robot_state accepted, processed, and does not create incidents.
    const stateEnvelope = baseEnvelope({
      message_type: "robot_state",
      payload: {
        status: "online",
        battery_percent: 74,
        metrics: {
          battery: 74,
          cpu_percent: 29,
          temp_c: 35.8
        },
        pose: {
          floorplan_id: "f1",
          x: 41.2,
          y: 22.8,
          heading_degrees: 87
        }
      }
    });

    {
      const res = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(stateEnvelope)
      });
      assert(res.status === 201 || res.status === 200, "Valid robot_state ingest should be accepted.");
      assert(res.body?.accepted === 1, "Valid robot_state ingest should return accepted=1.");
      record("V1P1-QA-002A", true, "Valid robot_state envelope accepted.");
    }

    await waitFor(async () => {
      const incidentsAfterState = await request(`/incidents?site_id=${SITE_ID}`, token, { method: "GET" });
      return Array.isArray(incidentsAfterState.body) && incidentsAfterState.body.length === incidentCountBefore;
    });
    record("V1P1-QA-003", true, "robot_state ingest did not create incident rows.");

    // V1P1-QA-002 + V1P1-QA-009: duplicate message_id deduped.
    {
      const duplicate = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(stateEnvelope)
      });
      assert(duplicate.status === 201 || duplicate.status === 200, "Duplicate ingest should return success payload.");
      assert(duplicate.body?.duplicate === 1, "Duplicate message_id should return duplicate=1.");
      record("V1P1-QA-009", true, "Duplicate message_id is deduped.");
    }

    // V1P1-QA-002 + V1P1-QA-007: robot_event creates incident side effect.
    const eventEnvelope = baseEnvelope({
      message_id: crypto.randomUUID(),
      message_type: "robot_event",
      payload: {
        event_type: "connectivity_drop",
        severity: "warning",
        category: "connectivity",
        title: "QA connectivity event",
        message: "Connection lost for 4 seconds",
        create_incident: true
      }
    });
    {
      const res = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(eventEnvelope)
      });
      assert(res.status === 201 || res.status === 200, "Valid robot_event ingest should be accepted.");
      record("V1P1-QA-002B", true, "Valid robot_event envelope accepted.");
    }

    await waitFor(async () => {
      const incidentsAfterEvent = await request(`/incidents?site_id=${SITE_ID}`, token, { method: "GET" });
      if (!Array.isArray(incidentsAfterEvent.body)) {
        return false;
      }
      return incidentsAfterEvent.body.some((incident) => incident.title === "QA connectivity event");
    });
    record("V1P1-QA-007", true, "robot_event ingest created incident side effect.");

    // V1P1-QA-008: task_status updates mission timeline only.
    const taskEnvelope = baseEnvelope({
      message_id: crypto.randomUUID(),
      message_type: "task_status",
      payload: {
        task_id: "m2",
        state: "running",
        percent_complete: 61,
        message: "QA task status update"
      }
    });
    {
      const res = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(taskEnvelope)
      });
      assert(res.status === 201 || res.status === 200, "Valid task_status ingest should be accepted.");
      record("V1P1-QA-002C", true, "Valid task_status envelope accepted.");
    }

    await waitFor(async () => {
      const missionAfter = await request("/missions/m2", token, { method: "GET" });
      if (missionAfter.status !== 200 || !Array.isArray(missionAfter.body?.missionEvents)) {
        return false;
      }
      return missionAfter.body.missionEvents.length > missionEventCountBefore;
    });
    record("V1P1-QA-008", true, "task_status ingest updated mission timeline.");

    // V1P1-QA-010: tenant isolation enforced on ingest envelope.
    {
      const payload = baseEnvelope({ tenant_id: "t2", message_id: crypto.randomUUID() });
      const res = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      assert(res.status >= 400, "Mismatched tenant_id should be rejected.");
      record("V1P1-QA-010", true, "Tenant isolation enforced on ingest.");
    }

    console.log(JSON.stringify({ ok: true, report }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error), report }, null, 2));
    process.exit(1);
  }
}

void run();
