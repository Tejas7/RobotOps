import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API_URL = process.env.ROBOTOPS_API_URL ?? "http://localhost:4000/api";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function sortEnvelopes(envelopes) {
  return [...envelopes].sort((left, right) => {
    const typeCompare = String(left.message_type).localeCompare(String(right.message_type));
    if (typeCompare !== 0) {
      return typeCompare;
    }
    const tsCompare = new Date(String(left.timestamp)).getTime() - new Date(String(right.timestamp)).getTime();
    if (tsCompare !== 0) {
      return tsCompare;
    }
    return String(left.message_id).localeCompare(String(right.message_id));
  });
}

function compareEnvelopes(actual, expected) {
  const sortedActual = sortEnvelopes(actual);
  const sortedExpected = sortEnvelopes(expected);
  const maxLength = Math.max(sortedActual.length, sortedExpected.length);
  const diffs = [];

  for (let index = 0; index < maxLength; index += 1) {
    const a = sortedActual[index] ?? null;
    const e = sortedExpected[index] ?? null;
    if (!a || !e) {
      diffs.push({ index, expected: e, actual: a });
      continue;
    }
    if (JSON.stringify(a) !== JSON.stringify(e)) {
      diffs.push({ index, expected: e, actual: a });
    }
  }

  return {
    ok: diffs.length === 0,
    diffs
  };
}

async function request(pathname, token, body) {
  const response = await fetch(`${API_URL}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let parsedBody = null;
  try {
    parsedBody = text ? JSON.parse(text) : null;
  } catch {
    parsedBody = text;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(parsedBody)}`);
  }
  return parsedBody;
}

async function loadExpected(filePath) {
  const raw = await readFile(path.resolve(process.cwd(), filePath), "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected golden file to contain a JSON array.");
  }
  return parsed;
}

async function writeReport(captureId, report) {
  const outputDir = path.join(process.cwd(), ".data", "adapter-validations");
  await mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `${captureId}-${Date.now()}.json`);
  await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return filePath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = args.token ?? process.env.ROBOTOPS_TOKEN;
  if (!token) {
    throw new Error("ROBOTOPS_TOKEN env var or --token is required.");
  }
  if (!args.capture) {
    throw new Error("Missing required --capture");
  }
  if (!args.expected) {
    throw new Error("Missing required --expected");
  }

  const expected = await loadExpected(args.expected);
  const replayPayload = {
    capture_id: args.capture,
    replay_speed_multiplier: 1,
    replay_mode: "logical_timestamp_scaling",
    deterministic_ordering: true,
    validation_only: true,
    return_envelopes: true,
    ...(args.from || args.to
      ? {
          time_window_filter: {
            ...(args.from ? { from: args.from } : {}),
            ...(args.to ? { to: args.to } : {})
          }
        }
      : {})
  };

  const replayResult = await request("/adapters/replays", token, replayPayload);
  const actual = Array.isArray(replayResult?.envelopes) ? replayResult.envelopes : [];
  const comparison = compareEnvelopes(actual, expected);
  const report = {
    timestamp: new Date().toISOString(),
    capture_id: args.capture,
    replay_run_id: replayResult?.run?.id ?? null,
    actual_count: actual.length,
    expected_count: expected.length,
    ok: comparison.ok,
    diff_count: comparison.diffs.length,
    diffs: comparison.diffs.slice(0, 20)
  };

  const reportPath = await writeReport(args.capture, report);
  process.stdout.write(`${JSON.stringify({ ...report, report_path: reportPath }, null, 2)}\n`);

  if (!comparison.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`adapter:validate failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
