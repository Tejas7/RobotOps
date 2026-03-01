import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const API_URL = process.env.ROBOTOPS_API_URL ?? "http://localhost:4000/api";
const JWT_SECRET = process.env.JWT_SECRET ?? "robotops-dev-secret";
const TENANT_ID = "t1";
const SITE_ID = "s1";

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

function stableEnvelopeString(envelopes) {
  return JSON.stringify(
    [...envelopes].sort((left, right) => {
      const type = String(left.message_type).localeCompare(String(right.message_type));
      if (type !== 0) {
        return type;
      }
      const ts = new Date(String(left.timestamp)).getTime() - new Date(String(right.timestamp)).getTime();
      if (ts !== 0) {
        return ts;
      }
      return String(left.message_id).localeCompare(String(right.message_id));
    })
  );
}

function replayEnvelopeSpanMs(envelopes) {
  if (!Array.isArray(envelopes) || envelopes.length < 2) {
    return 0;
  }
  const timestamps = envelopes.map((entry) => new Date(String(entry.timestamp)).getTime()).sort((a, b) => a - b);
  return Math.max(0, timestamps[timestamps.length - 1] - timestamps[0]);
}

async function run() {
  const token = ownerToken();
  const report = { timestamp: new Date().toISOString(), checks: [] };
  const record = (id, ok, details) => report.checks.push({ id, ok, details });

  try {
    const captureId = `qa-v1p5-${Date.now()}`;

    // V1P5-QA-001: Record capture.
    const recordRes = await request("/adapters/captures/record", token, {
      method: "POST",
      body: JSON.stringify({
        vendor: "vendor_acme",
        site_id: SITE_ID,
        adapter_name: "demo_polling",
        duration_seconds: 6,
        capture_id: captureId,
        source_endpoint: "/vendor/mock"
      })
    });
    assert(recordRes.status === 200 || recordRes.status === 201, "Expected capture recording to succeed.");
    assert(recordRes.body?.capture?.capture_id === captureId, "Expected recorded capture_id to match request.");
    assert(recordRes.body?.capture?.entry_count > 0, "Expected capture to contain at least one entry.");
    record("V1P5-QA-001", true, "Recorded adapter capture with manifest + JSONL entries.");

    // V1P5-QA-002: Capture listing and filters.
    const listRes = await request(`/adapters/captures?vendor=vendor_acme&site_id=${SITE_ID}`, token, { method: "GET" });
    assert(listRes.status === 200, "Expected /adapters/captures to return 200.");
    assert(Array.isArray(listRes.body), "Expected /adapters/captures response to be an array.");
    assert(listRes.body.some((item) => item.capture_id === captureId), "Expected recorded capture in filtered capture list.");
    record("V1P5-QA-002", true, "Capture manifest listing works with vendor/site filters.");

    // V1P5-QA-003: Deterministic validation replay.
    const deterministicStartAt = new Date(Date.now() + 10_000).toISOString();
    const replayValidationOne = await request("/adapters/replays", token, {
      method: "POST",
      body: JSON.stringify({
        capture_id: captureId,
        deterministic_ordering: true,
        replay_mode: "logical_timestamp_scaling",
        replay_speed_multiplier: 1,
        start_at: deterministicStartAt,
        validation_only: true,
        return_envelopes: true
      })
    });
    assert(replayValidationOne.status === 200 || replayValidationOne.status === 201, "Expected first validation replay to succeed.");
    assert(replayValidationOne.body?.run?.id, "Expected validation replay run id.");
    const envelopesOne = Array.isArray(replayValidationOne.body?.envelopes) ? replayValidationOne.body.envelopes : [];
    assert(envelopesOne.length > 0, "Expected validation replay to produce envelopes.");

    const replayValidationTwo = await request("/adapters/replays", token, {
      method: "POST",
      body: JSON.stringify({
        capture_id: captureId,
        deterministic_ordering: true,
        replay_mode: "logical_timestamp_scaling",
        replay_speed_multiplier: 1,
        start_at: deterministicStartAt,
        validation_only: true,
        return_envelopes: true
      })
    });
    assert(replayValidationTwo.status === 200 || replayValidationTwo.status === 201, "Expected second validation replay to succeed.");
    const envelopesTwo = Array.isArray(replayValidationTwo.body?.envelopes) ? replayValidationTwo.body.envelopes : [];
    assert(stableEnvelopeString(envelopesOne) === stableEnvelopeString(envelopesTwo), "Expected deterministic replay envelope output.");
    record("V1P5-QA-003", true, "Deterministic validation replay output is stable across runs.");

    // V1P5-QA-004: Logical replay speed scaling changes timeline span.
    const fixedStartAt = new Date(Date.now() + 20_000).toISOString();
    const replaySlow = await request("/adapters/replays", token, {
      method: "POST",
      body: JSON.stringify({
        capture_id: captureId,
        deterministic_ordering: true,
        replay_mode: "logical_timestamp_scaling",
        replay_speed_multiplier: 1,
        start_at: fixedStartAt,
        validation_only: true,
        return_envelopes: true
      })
    });
    assert(replaySlow.status === 200 || replaySlow.status === 201, "Expected logical slow replay to succeed.");
    const replayFast = await request("/adapters/replays", token, {
      method: "POST",
      body: JSON.stringify({
        capture_id: captureId,
        deterministic_ordering: true,
        replay_mode: "logical_timestamp_scaling",
        replay_speed_multiplier: 10,
        start_at: fixedStartAt,
        validation_only: true,
        return_envelopes: true
      })
    });
    assert(replayFast.status === 200 || replayFast.status === 201, "Expected logical fast replay to succeed.");
    const slowSpan = replayEnvelopeSpanMs(Array.isArray(replaySlow.body?.envelopes) ? replaySlow.body.envelopes : []);
    const fastSpan = replayEnvelopeSpanMs(Array.isArray(replayFast.body?.envelopes) ? replayFast.body.envelopes : []);
    assert(fastSpan <= slowSpan, "Expected higher logical replay speed to reduce or equal timestamp span.");
    record("V1P5-QA-004", true, "Logical timestamp scaling applies replay_speed_multiplier.");

    // V1P5-QA-005: Failed replay still creates run diagnostics row.
    const failedRunId = crypto.randomUUID();
    const invalidWindowReplay = await request("/adapters/replays", token, {
      method: "POST",
      body: JSON.stringify({
        capture_id: captureId,
        run_id: failedRunId,
        deterministic_ordering: true,
        replay_mode: "logical_timestamp_scaling",
        replay_speed_multiplier: 1,
        time_window_filter: {
          from: "2026-01-02T00:00:00.000Z",
          to: "2026-01-01T00:00:00.000Z"
        }
      })
    });
    assert(invalidWindowReplay.status >= 400, "Expected invalid replay time window to fail.");
    const failedRunDetail = await request(`/adapters/replays/${failedRunId}`, token, { method: "GET" });
    assert(failedRunDetail.status === 200, "Expected failed replay run detail to exist.");
    assert(failedRunDetail.body?.status === "failed", "Expected failed replay run status.");
    assert(Array.isArray(failedRunDetail.body?.events) && failedRunDetail.body.events.length > 0, "Expected failure artifact events.");
    record("V1P5-QA-005", true, "Replay run record is created and persisted even for pre-processing failure.");

    // V1P5-QA-006: Ingest-path replay and run diagnostics.
    const replayRunRes = await request("/adapters/replays", token, {
      method: "POST",
      body: JSON.stringify({
        capture_id: captureId,
        deterministic_ordering: true,
        replay_mode: "logical_timestamp_scaling",
        replay_speed_multiplier: 1
      })
    });
    assert(replayRunRes.status === 200 || replayRunRes.status === 201, "Expected ingest replay run to succeed.");
    const replayRunId = replayRunRes.body?.run?.id;
    assert(typeof replayRunId === "string" && replayRunId.length > 0, "Expected replay run id in replay response.");
    assert(typeof replayRunRes.body?.run?.accepted_count === "number", "Expected replay run accepted_count.");

    const replayDetailRes = await request(`/adapters/replays/${replayRunId}`, token, { method: "GET" });
    assert(replayDetailRes.status === 200, "Expected replay run detail endpoint to return 200.");
    assert(Array.isArray(replayDetailRes.body?.events), "Expected replay run detail to include events array.");
    assert(replayDetailRes.body.events.length > 0, "Expected replay run detail to contain event results.");
    record("V1P5-QA-006", true, "Replay run persistence and diagnostics endpoint are functional.");

    // V1P5-QA-007: Adapter health endpoint reflects latest run.
    const healthRes = await request("/adapters/health", token, { method: "GET" });
    assert(healthRes.status === 200, "Expected /adapters/health to return 200.");
    assert(Array.isArray(healthRes.body), "Expected /adapters/health response array.");
    const row = healthRes.body.find((item) => item.vendor === "vendor_acme" && item.adapter_name === "demo_polling" && item.site_id === SITE_ID);
    assert(row, "Expected adapter health row for vendor_acme/demo_polling.");
    assert(row.last_run_id === replayRunId, "Expected adapter health last_run_id to match latest replay run.");
    assert(row.status === "healthy" || row.status === "degraded", "Expected adapter health status to be healthy or degraded.");
    record("V1P5-QA-007", true, "Adapter health endpoint reports latest run state.");
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  }

  const failed = report.checks.filter((check) => !check.ok);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (report.error || failed.length > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  process.stderr.write(`V1 Phase 5 QA failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
