import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const API_URL = process.env.ROBOTOPS_API_URL ?? "http://localhost:4000/api";
const JWT_SECRET = process.env.JWT_SECRET ?? "robotops-dev-secret";
const TENANT_ID = "t1";
const SITE_ID = "s1";
const ROBOT_ID = "r1";
const QA_VENDOR = "qa_vendor_v1p3";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function nearlyEqual(left, right, epsilon = 0.001) {
  return Math.abs(left - right) <= epsilon;
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
      source_id: "qa-edge-v1p3",
      vendor: QA_VENDOR,
      protocol: "http"
    },
    entity: {
      entity_type: "robot",
      robot_id: ROBOT_ID
    },
    payload: {
      status: "online",
      battery_percent: 71,
      pose: {
        x: 1,
        y: 1,
        heading_degrees: 0,
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

async function waitFor(check, timeoutMs = 10000, intervalMs = 300) {
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

async function fetchRobotLastState(token) {
  const res = await request(`/robots/last_state?site_id=${SITE_ID}`, token, { method: "GET" });
  assert(res.status === 200, "Expected /robots/last_state to return 200");
  assert(Array.isArray(res.body), "Expected /robots/last_state to return an array");
  return res.body.find((row) => row.id === ROBOT_ID) ?? null;
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
    const mapIdValue = `qa-map-id-${Date.now()}`;
    const mapNameValue = `qa-map-name-${Date.now()}`;

    // V1P3-QA-001: create map with vendor_map_id only.
    const createById = await request("/vendor-site-maps", token, {
      method: "POST",
      body: JSON.stringify({
        site_id: SITE_ID,
        vendor: QA_VENDOR,
        vendor_map_id: mapIdValue,
        robotops_floorplan_id: "f1",
        scale: 2,
        rotation_degrees: 90,
        translate_x: 10,
        translate_y: -5
      })
    });
    assert(createById.status === 201 || createById.status === 200, "Expected create-by-id mapping to succeed");
    const mappingById = createById.body;
    record("V1P3-QA-001A", true, "Creates mapping with vendor_map_id only.");

    const createByIdDuplicate = await request("/vendor-site-maps", token, {
      method: "POST",
      body: JSON.stringify({
        site_id: SITE_ID,
        vendor: QA_VENDOR,
        vendor_map_id: mapIdValue,
        robotops_floorplan_id: "f1",
        scale: 1,
        rotation_degrees: 0,
        translate_x: 0,
        translate_y: 0
      })
    });
    assert(createByIdDuplicate.status >= 400, "Expected duplicate vendor_map_id to be rejected");
    record("V1P3-QA-001B", true, "Rejects duplicate vendor_map_id for tenant/site/vendor.");

    // V1P3-QA-002: create map with vendor_map_name only + duplicate rejection.
    const createByName = await request("/vendor-site-maps", token, {
      method: "POST",
      body: JSON.stringify({
        site_id: SITE_ID,
        vendor: QA_VENDOR,
        vendor_map_name: mapNameValue,
        robotops_floorplan_id: "f1b",
        scale: 1,
        rotation_degrees: -90,
        translate_x: 100,
        translate_y: 50
      })
    });
    assert(createByName.status === 201 || createByName.status === 200, "Expected create-by-name mapping to succeed");
    const mappingByName = createByName.body;
    record("V1P3-QA-002A", true, "Creates mapping with vendor_map_name only.");

    const createByNameDuplicate = await request("/vendor-site-maps", token, {
      method: "POST",
      body: JSON.stringify({
        site_id: SITE_ID,
        vendor: QA_VENDOR,
        vendor_map_name: mapNameValue,
        robotops_floorplan_id: "f1b",
        scale: 1,
        rotation_degrees: 0,
        translate_x: 0,
        translate_y: 0
      })
    });
    assert(createByNameDuplicate.status >= 400, "Expected duplicate vendor_map_name to be rejected");
    record("V1P3-QA-002B", true, "Rejects duplicate vendor_map_name for tenant/site/vendor.");

    const createMissingKeys = await request("/vendor-site-maps", token, {
      method: "POST",
      body: JSON.stringify({
        site_id: SITE_ID,
        vendor: QA_VENDOR,
        robotops_floorplan_id: "f1",
        scale: 1,
        rotation_degrees: 0,
        translate_x: 0,
        translate_y: 0
      })
    });
    assert(createMissingKeys.status >= 400, "Expected mapping without map_id/map_name to be rejected");
    record("V1P3-QA-003", true, "Rejects mapping creation when both key fields are missing.");

    // V1P3-QA-004: deterministic preview output.
    const preview = await request("/vendor-site-maps/preview", token, {
      method: "POST",
      body: JSON.stringify({
        robotops_floorplan_id: "f1",
        scale: 2,
        rotation_degrees: 90,
        translate_x: 10,
        translate_y: -5,
        points: [{ x: 2, y: 3, heading_degrees: 350, confidence: 0.9 }]
      })
    });
    assert(preview.status === 201 || preview.status === 200, "Expected preview endpoint to succeed");
    const previewPoint = preview.body?.points?.[0]?.output;
    assert(previewPoint, "Expected preview output point");
    assert(nearlyEqual(previewPoint.x, 4), `Expected preview x=4, got ${previewPoint.x}`);
    assert(nearlyEqual(previewPoint.y, -1), `Expected preview y=-1, got ${previewPoint.y}`);
    assert(nearlyEqual(previewPoint.heading_degrees, 80), `Expected preview heading=80, got ${previewPoint.heading_degrees}`);
    record("V1P3-QA-004", true, "Preview endpoint returns deterministic transformed points.");

    // V1P3-QA-005 + V1P3-QA-009 (id path + heading normalization).
    const ingestById = await request("/ingest/telemetry", token, {
      method: "POST",
      body: JSON.stringify(
        baseEnvelope({
          payload: {
            status: "online",
            battery_percent: 68,
            pose: {
              vendor_map_id: mapIdValue,
              x: 2,
              y: 3,
              heading_degrees: 350,
              confidence: 0.88
            }
          }
        })
      )
    });
    assert(ingestById.status === 201 || ingestById.status === 200, "Expected mapped ingest by vendor_map_id to be accepted");

    await waitFor(async () => {
      const row = await fetchRobotLastState(token);
      if (!row) {
        return false;
      }
      return (
        row.floorplanId === mappingById.robotopsFloorplanId &&
        nearlyEqual(row.x, 4) &&
        nearlyEqual(row.y, -1) &&
        nearlyEqual(row.headingDegrees, 80)
      );
    });
    record("V1P3-QA-005", true, "Mapped robot_state (vendor_map_id) transforms pose and writes RobotLastState.");
    record("V1P3-QA-009", true, "Heading normalization uses [0, 360) after transform rotation.");

    // V1P3-QA-006: name path transform.
    const ingestByName = await request("/ingest/telemetry", token, {
      method: "POST",
      body: JSON.stringify(
        baseEnvelope({
          payload: {
            status: "online",
            battery_percent: 66,
            pose: {
              vendor_map_name: mapNameValue,
              x: 10,
              y: 5,
              heading_degrees: 15,
              confidence: 0.9
            }
          }
        })
      )
    });
    assert(ingestByName.status === 201 || ingestByName.status === 200, "Expected mapped ingest by vendor_map_name to be accepted");

    await waitFor(async () => {
      const row = await fetchRobotLastState(token);
      if (!row) {
        return false;
      }
      return (
        row.floorplanId === mappingByName.robotopsFloorplanId &&
        nearlyEqual(row.x, 105) &&
        nearlyEqual(row.y, 40) &&
        nearlyEqual(row.headingDegrees, 285)
      );
    });
    record("V1P3-QA-006", true, "Mapped robot_state (vendor_map_name) transforms pose and writes RobotLastState.");

    // V1P3-QA-007: compat fallback passthrough with valid RobotOps floorplan.
    const ingestFallbackPass = await request("/ingest/telemetry", token, {
      method: "POST",
      body: JSON.stringify(
        baseEnvelope({
          source: {
            source_type: "edge",
            source_id: "qa-edge-v1p3-fallback",
            vendor: "qa_vendor_unmapped",
            protocol: "http"
          },
          payload: {
            status: "degraded",
            battery_percent: 65,
            pose: {
              floorplan_id: "f1",
              x: 12,
              y: 34,
              heading_degrees: 50,
              confidence: 0.91
            }
          }
        })
      )
    });
    assert(ingestFallbackPass.status === 201 || ingestFallbackPass.status === 200, "Expected fallback passthrough ingest to be accepted");

    await waitFor(async () => {
      const row = await fetchRobotLastState(token);
      if (!row) {
        return false;
      }
      return row.floorplanId === "f1" && nearlyEqual(row.x, 12) && nearlyEqual(row.y, 34) && nearlyEqual(row.headingDegrees, 50);
    });
    record("V1P3-QA-007", true, "Unmapped robot_state with valid floorplan uses passthrough fallback.");

    // V1P3-QA-008 + V1P3-QA-010: dead-letter on mapping miss + tenant isolation.
    const pipelineBefore = await fetchPipelineStatus(token);
    const deadLettersBefore = pipelineBefore?.ingestion?.deadLetters ?? 0;
    const failedBefore = pipelineBefore?.ingestion?.failed ?? 0;

    const ingestFallbackReject = await request("/ingest/telemetry", token, {
      method: "POST",
      body: JSON.stringify(
        baseEnvelope({
          payload: {
            status: "online",
            battery_percent: 63,
            pose: {
              vendor_map_id: "unknown-map-id",
              floorplan_id: "missing-floorplan",
              x: 3,
              y: 4,
              heading_degrees: 25,
              confidence: 0.92
            }
          }
        })
      )
    });
    assert(ingestFallbackReject.status === 201 || ingestFallbackReject.status === 200, "Expected ingest acceptance before async failure path");

    await waitFor(async () => {
      const pipelineAfter = await fetchPipelineStatus(token);
      const deadLettersAfter = pipelineAfter?.ingestion?.deadLetters ?? 0;
      const failedAfter = pipelineAfter?.ingestion?.failed ?? 0;
      return deadLettersAfter > deadLettersBefore && failedAfter > failedBefore;
    });

    const transformMissAudit = await request("/audit?action=vendor_site_map.transform_miss&limit=10", token, { method: "GET" });
    assert(transformMissAudit.status === 200, "Expected audit query for transform misses to succeed");
    assert(
      Array.isArray(transformMissAudit.body?.items) && transformMissAudit.body.items.some((item) => item.action === "vendor_site_map.transform_miss"),
      "Expected transform miss audit entry"
    );
    record("V1P3-QA-008", true, "Unmapped invalid floorplan path fails processing and records dead-letter + audit.");

    const tenantMismatch = await request("/ingest/telemetry", token, {
      method: "POST",
      body: JSON.stringify(baseEnvelope({ tenant_id: "t2" }))
    });
    assert(tenantMismatch.status >= 400, "Expected tenant mismatch ingest to be rejected");
    record("V1P3-QA-010", true, "Tenant isolation enforced on ingest envelope.");

    const listByVendor = await request(`/vendor-site-maps?vendor=${QA_VENDOR}`, token, { method: "GET" });
    assert(listByVendor.status === 200, "Expected vendor-site-map list query to succeed");
    assert(Array.isArray(listByVendor.body) && listByVendor.body.length >= 2, "Expected created vendor mappings in filtered list");
    record("V1P3-QA-002C", true, "Vendor map query filter returns expected tenant-scoped mappings.");

    console.log(JSON.stringify({ ok: true, report }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error), report }, null, 2));
    process.exit(1);
  }
}

void run();
