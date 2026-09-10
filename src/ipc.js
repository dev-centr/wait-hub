import http from "node:http";
import { URL } from "node:url";
import { isTerminal } from "./store.js";

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/**
 * Local HTTP IPC (hive-watch style). Service-agnostic core:
 * POST /waits              register_wait
 * GET  /waits              list
 * GET  /waits/:id          get
 * POST /waits/:id/wait     wait_until (block until terminal or timeout)
 * POST /ingest/github      adapter #1 webhook ingest (optional)
 * GET  /health
 * GET  /status
 * complete_wait is internal (adapters / ingest) in v1.
 */
export function createIpcServer(state, handlers) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const route = `${req.method} ${url.pathname}`;

      if (route === "GET /health") {
        send(res, 200, { ok: true, service: "waitd", version: state.version });
        return;
      }

      if (route === "GET /status") {
        send(res, 200, state.snapshot());
        return;
      }

      if (route === "GET /waits") {
        send(res, 200, { waits: handlers.list() });
        return;
      }

      if (req.method === "POST" && url.pathname === "/waits") {
        const body = await readJson(req);
        const wait = handlers.register(body);
        send(res, 201, wait);
        return;
      }

      const getMatch = url.pathname.match(/^\/waits\/([^/]+)$/);
      if (req.method === "GET" && getMatch) {
        const wait = handlers.get(decodeURIComponent(getMatch[1]));
        if (!wait) {
          send(res, 404, { error: "not found" });
          return;
        }
        send(res, 200, wait);
        return;
      }

      const waitMatch = url.pathname.match(/^\/waits\/([^/]+)\/wait$/);
      if (req.method === "POST" && waitMatch) {
        const body = await readJson(req);
        const waitId = decodeURIComponent(waitMatch[1]);
        const result = await handlers.waitUntil(waitId, {
          timeout_ms: body.timeout_ms ?? null,
          poll_ms: body.poll_ms ?? 500,
        });
        send(res, 200, result);
        return;
      }

      if (route === "POST /ingest/github") {
        const body = await readJson(req);
        const result = await handlers.ingestGithub(body);
        send(res, 200, result);
        return;
      }

      send(res, 404, { error: "not found" });
    } catch (err) {
      send(res, 500, { error: String(err.message || err) });
    }
  });
}

export function serveIpc(port, state, handlers) {
  const server = createIpcServer(state, handlers);
  return new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

/** Promise that resolves when wait is terminal (polls store). */
export function waitUntilTerminal(store, waitId, { timeout_ms = null, poll_ms = 500 } = {}) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const wait = store.get(waitId);
      if (!wait) {
        reject(new Error(`unknown wait_id: ${waitId}`));
        return;
      }
      if (isTerminal(wait.status)) {
        resolve(wait);
        return;
      }
      if (timeout_ms != null && Date.now() - started >= timeout_ms) {
        try {
          resolve(
            store.complete(waitId, {
              status: "timed_out",
              conclusion: "timed_out",
              error: `wait_until timed out after ${timeout_ms}ms`,
            }),
          );
        } catch (err) {
          reject(err);
        }
        return;
      }
      setTimeout(tick, poll_ms);
    };
    tick();
  });
}
