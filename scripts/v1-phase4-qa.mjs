import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const API_URL = process.env.ROBOTOPS_API_URL ?? "http://localhost:4000/api";
const JWT_SECRET = process.env.JWT_SECRET ?? "robotops-dev-secret";
const TENANT_ID = "t1";
const SITE_ID = "s1";
const ROBOT_ID = "r1";
const MISSION_ID = "m1";

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

function isoOffset(baseIso, offsetMs) {
  return new Date(new Date(baseIso).getTime() + offsetMs).toISOString();
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
      source_id: "qa-edge-v1p4",
      vendor: "vendor_acme",
      protocol: "http"
    },
    entity: {
      entity_type: "robot",
      robot_id: ROBOT_ID
    },
    payload: {
      sequence: 1,
      status: "online",
      battery_percent: 77,
      pose: {
        vendor_map_id: "acme-s1-main",
        floorplan_id: "f1",
        x: 10,
        y: 10,
        heading_degrees: 90,
        confidence: 0.95
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

async function waitFor(check, timeoutMs = 12000, intervalMs = 300) {
  const started = Date.now();
  while (true) {
    const done = await check();
    if (done) {
      return;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for asynchronous processing");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function fetchLastStateByRobot(token, robotId = ROBOT_ID) {
  const res = await request(`/robots/last_state?site_id=${SITE_ID}`, token, { method: "GET" });
  assert(res.status === 200, "Expected /robots/last_state to return 200");
  assert(Array.isArray(res.body), "Expected /robots/last_state to return array");
  return res.body.find((row) => row.id === robotId) ?? null;
}

async function fetchMission(token, missionId = MISSION_ID) {
  const res = await request(`/missions/${missionId}`, token, { method: "GET" });
  assert(res.status === 200, `Expected /missions/${missionId} to return 200`);
  return res.body;
}

async function countIncidentsByTitle(token, title) {
  const res = await request(`/incidents?site_id=${SITE_ID}`, token, { method: "GET" });
  assert(res.status === 200, "Expected /incidents to return 200");
  assert(Array.isArray(res.body), "Expected /incidents response to be array");
  return res.body.filter((incident) => incident.title === title).length;
}

async function fetchAuditByAction(token, action) {
  const params = new URLSearchParams();
  params.set("action", action);
  params.set("limit", "100");
  const res = await request(`/audit?${params.toString()}`, token, { method: "GET" });
  assert(res.status === 200, "Expected /audit to return 200");
  return Array.isArray(res.body?.items) ? res.body.items : [];
}

async function fetchPipelineStatus(token) {
  const res = await request("/system/pipeline-status", token, { method: "GET" });
  assert(res.status === 200, "Expected /system/pipeline-status to return 200");
  return res.body;
}

async function run() {
  const token = ownerToken();
  const report = { timestamp: new Date().toISOString(), checks: [] };
  const record = (id, ok, details) => report.checks.push({ id, ok, details });

  try {
    const pipelineBefore = await fetchPipelineStatus(token);

    // V1P4-QA-001: sequence validation reject.
    {
      const invalidSequenceEnvelope = baseEnvelope({
        message_id: crypto.randomUUID(),
        payload: {
          sequence: 0,
          status: "online",
          battery_percent: 55,
          pose: {
            vendor_map_id: "acme-s1-main",
            floorplan_id: "f1",
            x: 20,
            y: 20,
            heading_degrees: 0,
            confidence: 0.9
          }
        }
      });
      const res = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(invalidSequenceEnvelope)
      });
      assert(res.status >= 400, "Expected sequence=0 to be rejected.");
      record("V1P4-QA-001", true, "Rejects invalid non-positive sequence values.");
    }

    // V1P4-QA-002: robot_event dedupe_key required.
    {
      const missingDedupeKeyEnvelope = baseEnvelope({
        message_id: crypto.randomUUID(),
        message_type: "robot_event",
        payload: {
          sequence: 1,
          event_type: "connectivity_drop",
          severity: "warning",
          category: "connectivity",
          title: "Missing dedupe key should fail",
          message: "No dedupe key",
          create_incident: true
        }
      });
      const res = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(missingDedupeKeyEnvelope)
      });
      assert(res.status >= 400, "Expected robot_event without dedupe_key to be rejected.");
      record("V1P4-QA-002", true, "Rejects robot_event missing dedupe_key.");
    }

    // V1P4-QA-003: message_id idempotency remains active.
    {
      const duplicateEnvelope = baseEnvelope({
        message_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        payload: {
          sequence: 400,
          status: "online",
          battery_percent: 59,
          pose: {
            vendor_map_id: "acme-s1-main",
            floorplan_id: "f1",
            x: 22,
            y: 22,
            heading_degrees: 10,
            confidence: 0.93
          }
        }
      });
      const first = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(duplicateEnvelope)
      });
      assert(first.status === 200 || first.status === 201, "Expected first ingest to be accepted.");
      const duplicate = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(duplicateEnvelope)
      });
      assert(duplicate.status === 200 || duplicate.status === 201, "Expected duplicate ingest to return success payload.");
      assert(duplicate.body?.duplicate === 1, "Expected duplicate message_id to return duplicate=1.");
      record("V1P4-QA-003", true, "message_id idempotency remains enforced.");
    }

    const orderingTimestamp = new Date(Date.now() + 1500).toISOString();

    // Baseline accepted robot_state used for ordering checks.
    {
      const baselineEnvelope = baseEnvelope({
        message_id: crypto.randomUUID(),
        timestamp: orderingTimestamp,
        payload: {
          sequence: 500,
          status: "online",
          battery_percent: 60,
          pose: {
            vendor_map_id: "acme-s1-main",
            floorplan_id: "f1",
            x: 25,
            y: 25,
            heading_degrees: 20,
            confidence: 0.95
          }
        }
      });
      const res = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(baselineEnvelope)
      });
      assert(res.status === 200 || res.status === 201, "Expected baseline robot_state ingest to be accepted.");

      await waitFor(async () => {
        const state = await fetchLastStateByRobot(token);
        return Boolean(state && state.batteryPercent === 60 && state.lastSeenAt === orderingTimestamp);
      });
    }

    // V1P4-QA-004: older-than-lateness drop.
    {
      const staleEnvelope = baseEnvelope({
        message_id: crypto.randomUUID(),
        timestamp: isoOffset(orderingTimestamp, -10000),
        payload: {
          sequence: 900,
          status: "online",
          battery_percent: 33,
          pose: {
            vendor_map_id: "acme-s1-main",
            floorplan_id: "f1",
            x: 18,
            y: 18,
            heading_degrees: 40,
            confidence: 0.95
          }
        }
      });
      const res = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(staleEnvelope)
      });
      assert(res.status === 200 || res.status === 201, "Expected stale robot_state ingest to be accepted at API level.");

      await waitFor(async () => {
        const state = await fetchLastStateByRobot(token);
        return Boolean(state && state.batteryPercent === 60 && state.lastSeenAt === orderingTimestamp);
      });
      record("V1P4-QA-004", true, "Drops robot_state older than allowed lateness window.");
    }

    // V1P4-QA-005: equal timestamp lower sequence drops, higher sequence accepts.
    {
      const lowerSequenceEnvelope = baseEnvelope({
        message_id: crypto.randomUUID(),
        timestamp: orderingTimestamp,
        payload: {
          sequence: 499,
          status: "online",
          battery_percent: 61,
          pose: {
            vendor_map_id: "acme-s1-main",
            floorplan_id: "f1",
            x: 25,
            y: 25,
            heading_degrees: 20,
            confidence: 0.95
          }
        }
      });
      const low = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(lowerSequenceEnvelope)
      });
      assert(low.status === 200 || low.status === 201, "Expected lower-sequence robot_state ingest to be accepted at API level.");

      await waitFor(async () => {
        const state = await fetchLastStateByRobot(token);
        return Boolean(state && state.batteryPercent === 60 && state.lastSeenAt === orderingTimestamp);
      });

      const higherSequenceEnvelope = baseEnvelope({
        message_id: crypto.randomUUID(),
        timestamp: orderingTimestamp,
        payload: {
          sequence: 501,
          status: "online",
          battery_percent: 62,
          pose: {
            vendor_map_id: "acme-s1-main",
            floorplan_id: "f1",
            x: 26,
            y: 26,
            heading_degrees: 21,
            confidence: 0.95
          }
        }
      });
      const high = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(higherSequenceEnvelope)
      });
      assert(high.status === 200 || high.status === 201, "Expected higher-sequence robot_state ingest to be accepted.");

      await waitFor(async () => {
        const state = await fetchLastStateByRobot(token);
        return Boolean(state && state.batteryPercent === 62 && state.lastSeenAt === orderingTimestamp);
      });
      record("V1P4-QA-005", true, "Sequence ordering keeps lower/equal updates out and allows higher sequence at same timestamp.");
    }

    // V1P4-QA-006 + V1P4-QA-007: robot_event dedupe window behavior.
    {
      const title = `QA V1P4 dedupe event ${Date.now()}`;
      const dedupeKey = `qa-v1p4-robot-event-${Date.now()}`;
      const beforeCount = await countIncidentsByTitle(token, title);
      const occurredAt = new Date().toISOString();

      const firstEvent = baseEnvelope({
        message_id: crypto.randomUUID(),
        message_type: "robot_event",
        timestamp: occurredAt,
        payload: {
          sequence: 10,
          dedupe_key: dedupeKey,
          event_type: "connectivity_drop",
          severity: "warning",
          category: "connectivity",
          title,
          message: "First event should create incident",
          create_incident: true,
          occurred_at: occurredAt
        }
      });
      const first = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(firstEvent)
      });
      assert(first.status === 200 || first.status === 201, "Expected first robot_event to be accepted.");

      await waitFor(async () => (await countIncidentsByTitle(token, title)) === beforeCount + 1);

      const duplicateEvent = baseEnvelope({
        message_id: crypto.randomUUID(),
        message_type: "robot_event",
        timestamp: isoOffset(occurredAt, 60000),
        payload: {
          sequence: 11,
          dedupe_key: dedupeKey,
          event_type: "connectivity_drop",
          severity: "warning",
          category: "connectivity",
          title,
          message: "Duplicate in window should be dropped",
          create_incident: true,
          occurred_at: isoOffset(occurredAt, 60000)
        }
      });
      const duplicate = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(duplicateEvent)
      });
      assert(duplicate.status === 200 || duplicate.status === 201, "Expected duplicate robot_event to be accepted at API layer.");

      await waitFor(async () => (await countIncidentsByTitle(token, title)) === beforeCount + 1);
      record("V1P4-QA-006", true, "Duplicate robot_event within dedupe window does not create duplicate incidents.");

      const afterWindowEvent = baseEnvelope({
        message_id: crypto.randomUUID(),
        message_type: "robot_event",
        timestamp: isoOffset(occurredAt, 31 * 60 * 1000),
        payload: {
          sequence: 12,
          dedupe_key: dedupeKey,
          event_type: "connectivity_drop",
          severity: "warning",
          category: "connectivity",
          title,
          message: "After window should create new incident",
          create_incident: true,
          occurred_at: isoOffset(occurredAt, 31 * 60 * 1000)
        }
      });
      const afterWindow = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(afterWindowEvent)
      });
      assert(afterWindow.status === 200 || afterWindow.status === 201, "Expected post-window robot_event to be accepted.");

      await waitFor(async () => (await countIncidentsByTitle(token, title)) === beforeCount + 2);
      record("V1P4-QA-007", true, "Same dedupe_key outside window is accepted again.");
    }

    // V1P4-QA-008, 009, 010: task_status dedupe and ordering.
    {
      const missionBefore = await fetchMission(token, MISSION_ID);
      const baseEventCount = Array.isArray(missionBefore.missionEvents) ? missionBefore.missionEvents.length : 0;
      const taskTimestamp = new Date().toISOString();

      const acceptedTask = baseEnvelope({
        message_id: crypto.randomUUID(),
        message_type: "task_status",
        timestamp: taskTimestamp,
        payload: {
          sequence: 700,
          task_id: MISSION_ID,
          state: "blocked",
          percent_complete: 66,
          updated_at: taskTimestamp,
          message: "Accepted blocked transition"
        }
      });
      const first = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(acceptedTask)
      });
      assert(first.status === 200 || first.status === 201, "Expected accepted task_status to be queued.");

      await waitFor(async () => {
        const mission = await fetchMission(token, MISSION_ID);
        return mission.state === "blocked" && Array.isArray(mission.missionEvents) && mission.missionEvents.length === baseEventCount + 1;
      });

      const duplicateTask = baseEnvelope({
        message_id: crypto.randomUUID(),
        message_type: "task_status",
        timestamp: taskTimestamp,
        payload: {
          sequence: 701,
          task_id: MISSION_ID,
          state: "blocked",
          percent_complete: 67,
          updated_at: taskTimestamp,
          message: "Duplicate tuple should be dropped"
        }
      });
      const duplicate = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(duplicateTask)
      });
      assert(duplicate.status === 200 || duplicate.status === 201, "Expected duplicate task_status to be accepted at API layer.");

      await waitFor(async () => {
        const mission = await fetchMission(token, MISSION_ID);
        return mission.state === "blocked" && Array.isArray(mission.missionEvents) && mission.missionEvents.length === baseEventCount + 1;
      });
      record("V1P4-QA-008", true, "Task status duplicate tuple does not duplicate timeline transitions.");

      const outOfOrderTask = baseEnvelope({
        message_id: crypto.randomUUID(),
        message_type: "task_status",
        timestamp: isoOffset(taskTimestamp, -30000),
        payload: {
          sequence: 702,
          task_id: MISSION_ID,
          state: "running",
          percent_complete: 68,
          updated_at: isoOffset(taskTimestamp, -30000),
          message: "Out-of-order update should drop"
        }
      });
      const outOfOrder = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(outOfOrderTask)
      });
      assert(outOfOrder.status === 200 || outOfOrder.status === 201, "Expected out-of-order task_status to be accepted at API layer.");

      await waitFor(async () => {
        const mission = await fetchMission(token, MISSION_ID);
        return mission.state === "blocked" && Array.isArray(mission.missionEvents) && mission.missionEvents.length === baseEventCount + 1;
      });
      record("V1P4-QA-009", true, "Out-of-order task status does not regress mission state or timeline.");

      const newerTask = baseEnvelope({
        message_id: crypto.randomUUID(),
        message_type: "task_status",
        timestamp: isoOffset(taskTimestamp, 30000),
        payload: {
          sequence: 703,
          task_id: MISSION_ID,
          state: "running",
          percent_complete: 70,
          updated_at: isoOffset(taskTimestamp, 30000),
          message: "Newer task status should apply"
        }
      });
      const newer = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(newerTask)
      });
      assert(newer.status === 200 || newer.status === 201, "Expected newer task_status to be queued.");

      await waitFor(async () => {
        const mission = await fetchMission(token, MISSION_ID);
        return mission.state === "running" && Array.isArray(mission.missionEvents) && mission.missionEvents.length === baseEventCount + 2;
      });
      record("V1P4-QA-010", true, "Newer task status applies and advances mission state/timeline.");
    }

    // V1P4-QA-011: tenant mismatch remains blocked.
    {
      const mismatchEnvelope = baseEnvelope({
        message_id: crypto.randomUUID(),
        tenant_id: "t2"
      });
      const res = await request("/ingest/telemetry", token, {
        method: "POST",
        body: JSON.stringify(mismatchEnvelope)
      });
      assert(res.status >= 400, "Expected tenant mismatch ingest to be rejected.");
      record("V1P4-QA-011", true, "Tenant isolation check remains enforced at ingest boundary.");
    }

    // V1P4-QA-012: dropped events are audited and do not increase dead-letter count.
    {
      const [robotDrops, eventDrops, taskDrops] = await Promise.all([
        fetchAuditByAction(token, "telemetry.robot_state.dropped"),
        fetchAuditByAction(token, "telemetry.robot_event.dropped"),
        fetchAuditByAction(token, "telemetry.task_status.dropped")
      ]);
      assert(robotDrops.length > 0, "Expected robot_state dropped audit entries.");
      assert(eventDrops.length > 0, "Expected robot_event dropped audit entries.");
      assert(taskDrops.length > 0, "Expected task_status dropped audit entries.");
      assert(robotDrops.some((entry) => entry?.diff?.after?.reason), "Expected robot drop audit entries to include reason.");
      assert(eventDrops.some((entry) => entry?.diff?.after?.reason), "Expected robot_event drop audit entries to include reason.");
      assert(taskDrops.some((entry) => entry?.diff?.after?.reason), "Expected task drop audit entries to include reason.");

      const pipelineAfter = await fetchPipelineStatus(token);
      assert(
        pipelineAfter.ingestion.deadLetters === pipelineBefore.ingestion.deadLetters,
        "Dropped dedupe/ordering events should not be written to dead-letter."
      );
      record("V1P4-QA-012", true, "Dropped events are audited and do not become dead letters.");
    }

    console.log(JSON.stringify({ ok: true, report }, null, 2));
  } catch (error) {
    report.checks.push({
      id: "V1P4-FAIL",
      ok: false,
      details: String(error)
    });
    console.error(JSON.stringify({ ok: false, report }, null, 2));
    process.exit(1);
  }
}

run();
