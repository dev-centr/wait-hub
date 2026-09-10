import process from "node:process";
import { defaultCodeRoot, defaultConfigPath, loadConfig } from "../config.js";

const VERSION = "0.1.0";

function usage() {
  console.log(`wait-hub ${VERSION} — client for waitd (general wait/event bus)

Register waits here instead of inventing poll/AwaitShell loops.
v1 CLI: github.actions (adapter #1). HTTP API accepts any service string.

Usage:
  wait-hub [--url URL] health
  wait-hub [--url URL] list
  wait-hub [--url URL] get <wait_id>
  wait-hub [--url URL] wait github.actions --repo OWNER/REPO --run-id N [--client ID] [--timeout-s N] [--no-block]

Environment:
  WAIT_HUB_URL   default http://127.0.0.1:<ipc_port from config>
  CODE_ROOT / code   hive root for config discovery
`);
}

function parseRepo(s) {
  const m = String(s).match(/^([^/]+)\/([^/]+)$/);
  if (!m) throw new Error("--repo must be OWNER/REPO");
  return { owner: m[1], repo: m[2] };
}

function parseArgs(argv) {
  const args = {
    cmd: "",
    service: "",
    repo: "",
    runId: null,
    waitId: "",
    client: "devcentr-harness",
    timeout_s: null,
    block: true,
    baseUrl: process.env.WAIT_HUB_URL || "",
  };
  const rest = argv.slice(2);
  if (!rest.length || rest[0] === "--help" || rest[0] === "-h") {
    usage();
    process.exit(0);
  }
  if (rest[0] === "--version") {
    console.log(VERSION);
    process.exit(0);
  }

  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--repo") args.repo = rest[++i];
    else if (a === "--run-id") args.runId = rest[++i];
    else if (a === "--client") args.client = rest[++i];
    else if (a === "--timeout-s") args.timeout_s = Number(rest[++i]);
    else if (a === "--no-block") args.block = false;
    else if (a === "--url") args.baseUrl = rest[++i];
    else if (a.startsWith("-")) throw new Error(`unknown flag: ${a}`);
    else positional.push(a);
  }

  args.cmd = positional[0] || "";
  if (args.cmd === "get") args.waitId = positional[1] || "";
  if (args.cmd === "wait") {
    args.service = positional[1] || "";
  } else if (positional[1] && positional[1].includes(".")) {
    args.service = positional[1];
  }
  return args;
}

async function api(baseUrl, method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

function resolveBaseUrl(args) {
  if (args.baseUrl) return args.baseUrl.replace(/\/$/, "");
  const codeRoot = defaultCodeRoot();
  const cfg = loadConfig(defaultConfigPath(codeRoot), codeRoot);
  return `http://127.0.0.1:${cfg.ipc_port}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const base = resolveBaseUrl(args);

  if (args.cmd === "health") {
    console.log(JSON.stringify(await api(base, "GET", "/health"), null, 2));
    return;
  }
  if (args.cmd === "list") {
    console.log(JSON.stringify(await api(base, "GET", "/waits"), null, 2));
    return;
  }
  if (args.cmd === "get") {
    if (!args.waitId) throw new Error("usage: wait-hub get <wait_id>");
    console.log(JSON.stringify(await api(base, "GET", `/waits/${args.waitId}`), null, 2));
    return;
  }
  if (args.cmd === "wait") {
    if (args.service !== "github.actions") {
      throw new Error("v1 only supports: wait-hub wait github.actions --repo o/r --run-id N");
    }
    const { owner, repo } = parseRepo(args.repo);
    if (args.runId == null) throw new Error("--run-id is required");

    const wait = await api(base, "POST", "/waits", {
      service: "github.actions",
      subject: { owner, repo, run_id: Number(args.runId) },
      client: args.client,
      timeout_s: args.timeout_s,
    });
    console.error(`registered ${wait.wait_id}`);

    if (!args.block) {
      console.log(JSON.stringify(wait, null, 2));
      return;
    }

    const timeout_ms =
      args.timeout_s != null ? args.timeout_s * 1000 : wait.timeout_s != null ? wait.timeout_s * 1000 : null;
    const done = await api(base, "POST", `/waits/${wait.wait_id}/wait`, { timeout_ms });
    console.log(JSON.stringify(done, null, 2));
    if (done.status === "succeeded") process.exit(0);
    process.exit(1);
  }

  usage();
  process.exit(2);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
