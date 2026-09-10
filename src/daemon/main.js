import process from "node:process";
import { defaultCodeRoot, defaultConfigPath, loadConfig, saveDefaultConfig } from "../config.js";
import { createStore } from "../store.js";
import { serveIpc, waitUntilTerminal } from "../ipc.js";
import * as gha from "../adapters/github-actions.js";

const VERSION = "0.1.0";

function parseArgs(argv) {
  const args = {
    serve: false,
    writeConfig: false,
    codeRoot: defaultCodeRoot(),
    configPath: "",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--serve") args.serve = true;
    else if (a === "--write-config") args.writeConfig = true;
    else if (a === "--code-root") args.codeRoot = argv[++i];
    else if (a === "--config") args.configPath = argv[++i];
    else if (a === "--version") {
      console.log(VERSION);
      process.exit(0);
    } else if (a === "--help" || a === "-h") {
      console.log(`waitd ${VERSION} — wait-hub daemon (general wait/event bus)

Usage:
  waitd --serve [--code-root PATH] [--config PATH]
  waitd --write-config [--code-root PATH]

IPC: 127.0.0.1:<ipc_port> (default 17357)
Adapters complete waits (v1: github.actions). Not a hive-watch remotes fetch.
`);
      process.exit(0);
    }
  }
  if (!args.configPath) args.configPath = defaultConfigPath(args.codeRoot);
  if (!args.serve && !args.writeConfig) args.serve = true;
  return args;
}

function createState(config, store) {
  return {
    version: VERSION,
    config,
    store,
    startedAt: new Date().toISOString(),
    lastPollAt: null,
    lastError: "",
    snapshot() {
      const waits = store.list();
      return {
        service: "waitd",
        version: VERSION,
        startedAt: this.startedAt,
        lastPollAt: this.lastPollAt,
        error: this.lastError,
        codeRoot: config.code_root,
        statusPath: config.status_path,
        eventsPath: config.events_path,
        ipcPort: config.ipc_port,
        counts: waits.reduce((acc, w) => {
          acc[w.status] = (acc[w.status] || 0) + 1;
          return acc;
        }, {}),
        pending: waits.filter((w) => w.status === "pending").length,
      };
    },
  };
}

async function pollPending(state) {
  const pending = state.store.list().filter((w) => w.status === "pending");
  state.lastPollAt = new Date().toISOString();
  for (const wait of pending) {
    try {
      if (wait.timeout_s != null) {
        const ageMs = Date.now() - Date.parse(wait.created_at);
        if (ageMs >= wait.timeout_s * 1000) {
          state.store.complete(wait.wait_id, {
            status: "timed_out",
            conclusion: "timed_out",
            error: `timeout_s=${wait.timeout_s}`,
          });
          continue;
        }
      }

      if (wait.service === gha.serviceId) {
        const result = await gha.pollOnce(wait.subject);
        if (result.done) {
          state.store.complete(wait.wait_id, {
            status: result.status,
            conclusion: result.conclusion,
            url: result.url,
            finished_at: result.finished_at,
          });
        }
      }
      // Unknown services stay pending until a first-party adapter exists
      // (or a cold-path proposal is accepted later).
    } catch (err) {
      state.lastError = String(err.message || err);
      state.store.appendEvent({
        type: "poll_error",
        wait_id: wait.wait_id,
        error: state.lastError,
      });
    }
  }
  state.store.writeStatusSummary();
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.writeConfig) {
    const cfg = saveDefaultConfig(args.configPath, args.codeRoot);
    console.log(`Wrote ${args.configPath}`);
    console.log(JSON.stringify(cfg, null, 2));
    if (!args.serve) return;
  }

  const config = loadConfig(args.configPath, args.codeRoot);
  const store = createStore(config);
  const state = createState(config, store);
  store.writeStatusSummary();

  const handlers = {
    list: () => store.list(),
    get: (id) => store.get(id),
    register: (body) => {
      if (body.service === gha.serviceId) {
        body.subject = gha.normalizeSubject(body.subject || {});
      }
      const wait = store.register(body);
      // Kick an immediate poll so short jobs complete without waiting a full interval.
      pollPending(state).catch(() => {});
      return wait;
    },
    waitUntil: (id, opts) => waitUntilTerminal(store, id, opts),
    ingestGithub: async (body) => {
      const mapped = gha.fromWebhookPayload(body);
      if (!mapped || !mapped.done) {
        return { matched: 0, note: "not a completed workflow_run payload" };
      }
      let matched = 0;
      for (const wait of store.list().filter((w) => w.status === "pending" && w.service === gha.serviceId)) {
        const s = wait.subject;
        const ownerOk = !mapped.owner || s.owner === mapped.owner;
        const repoOk = !mapped.repo || s.repo === mapped.repo;
        const runOk = mapped.run_id == null || Number(s.run_id) === Number(mapped.run_id);
        if (ownerOk && repoOk && runOk) {
          store.complete(wait.wait_id, {
            status: mapped.status,
            conclusion: mapped.conclusion,
            url: mapped.url,
            finished_at: mapped.finished_at,
          });
          matched += 1;
        }
      }
      return { matched };
    },
  };

  const interval = setInterval(() => {
    pollPending(state).catch((e) => {
      state.lastError = String(e.message || e);
    });
  }, config.poll_interval_ms);

  const server = await serveIpc(config.ipc_port, state, handlers);
  console.log(
    `waitd ${VERSION} listening on 127.0.0.1:${config.ipc_port} - CODE_ROOT=${config.code_root}`,
  );

  const shutdown = () => {
    clearInterval(interval);
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
