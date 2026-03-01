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

function readBoolean(input, fallback) {
  if (input === undefined) {
    return fallback;
  }
  return input === "true";
}

async function request(path, token, body) {
  const response = await fetch(`${API_URL}${path}`, {
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = args.token ?? process.env.ROBOTOPS_TOKEN;
  if (!token) {
    throw new Error("ROBOTOPS_TOKEN env var or --token is required.");
  }

  if (!args.capture) {
    throw new Error("Missing required --capture");
  }

  const speed = args.speed ? Number(args.speed) : 1;
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error("--speed must be a positive number");
  }

  const payload = {
    capture_id: args.capture,
    replay_speed_multiplier: speed,
    replay_mode: args.mode ?? "logical_timestamp_scaling",
    deterministic_ordering: readBoolean(args.deterministic, true),
    ...(args.sleep !== undefined ? { sleep: readBoolean(args.sleep, false) } : {}),
    ...(args["timestamp-policy"] ? { timestamp_policy: args["timestamp-policy"] } : {}),
    ...(args["start-at"] ? { start_at: args["start-at"] } : {}),
    ...(args["run-id"] ? { run_id: args["run-id"] } : {}),
    validation_only: readBoolean(args["validation-only"], false),
    return_envelopes: readBoolean(args["return-envelopes"], false),
    ...(args.from || args.to
      ? {
          time_window_filter: {
            ...(args.from ? { from: args.from } : {}),
            ...(args.to ? { to: args.to } : {})
          }
        }
      : {})
  };

  const result = await request("/adapters/replays", token, payload);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`adapter:replay failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
