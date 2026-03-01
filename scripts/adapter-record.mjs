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

function required(args, key) {
  const value = args[key];
  if (!value) {
    throw new Error(`Missing required flag --${key}`);
  }
  return value;
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

  const vendor = required(args, "vendor");
  const siteId = required(args, "site");
  const adapterName = required(args, "adapter");
  const duration = args.duration ? Number(args.duration) : 10;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("--duration must be a positive number");
  }

  const payload = {
    vendor,
    site_id: siteId,
    adapter_name: adapterName,
    duration_seconds: Math.round(duration),
    source_endpoint: args["source-endpoint"] ?? "/vendor/mock",
    ...(args.out ? { capture_id: args.out } : {})
  };

  const result = await request("/adapters/captures/record", token, payload);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`adapter:record failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
