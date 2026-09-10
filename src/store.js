import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TERMINAL = new Set(["succeeded", "failed", "cancelled", "timed_out"]);

export function isTerminal(status) {
  return TERMINAL.has(status);
}

export function createStore(config) {
  fs.mkdirSync(config.waits_dir, { recursive: true });

  function waitPath(waitId) {
    return path.join(config.waits_dir, `${waitId}.json`);
  }

  function appendEvent(event) {
    const line = `${JSON.stringify({ ...event, at: event.at || new Date().toISOString() })}\n`;
    fs.appendFileSync(config.events_path, line, "utf8");
  }

  function writeStatusSummary(waits) {
    const byStatus = {};
    for (const w of waits) {
      byStatus[w.status] = (byStatus[w.status] || 0) + 1;
    }
    const payload = {
      updatedAt: new Date().toISOString(),
      codeRoot: config.code_root,
      counts: byStatus,
      pending: waits.filter((w) => w.status === "pending").map((w) => ({
        wait_id: w.wait_id,
        service: w.service,
        subject: w.subject,
        client: w.client,
      })),
    };
    fs.writeFileSync(config.status_path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return payload;
  }

  function list() {
    if (!fs.existsSync(config.waits_dir)) return [];
    return fs
      .readdirSync(config.waits_dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(config.waits_dir, f), "utf8")))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }

  function get(waitId) {
    const p = waitPath(waitId);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  }

  function save(wait) {
    fs.writeFileSync(waitPath(wait.wait_id), `${JSON.stringify(wait, null, 2)}\n`, "utf8");
    writeStatusSummary(list());
    return wait;
  }

  function register({ service, subject, client = "unknown", timeout_s = null }) {
    if (!service || typeof service !== "string") {
      throw new Error("service is required");
    }
    if (!subject || typeof subject !== "object") {
      throw new Error("subject is required");
    }
    const wait = {
      wait_id: `w_${crypto.randomBytes(8).toString("hex")}`,
      service,
      subject,
      client: String(client),
      created_at: new Date().toISOString(),
      timeout_s: timeout_s == null ? null : Number(timeout_s),
      status: "pending",
      completion: null,
    };
    save(wait);
    appendEvent({ type: "registered", wait_id: wait.wait_id, service, subject, client: wait.client });
    return wait;
  }

  function complete(waitId, { status, conclusion = null, url = null, finished_at = null, error = null }) {
    const wait = get(waitId);
    if (!wait) throw new Error(`unknown wait_id: ${waitId}`);
    if (isTerminal(wait.status)) return wait;

    wait.status = status;
    wait.completion = {
      conclusion,
      url,
      finished_at: finished_at || new Date().toISOString(),
      error,
    };
    save(wait);
    appendEvent({
      type: "completed",
      wait_id: waitId,
      status,
      conclusion,
      url,
    });
    return wait;
  }

  return {
    list,
    get,
    register,
    complete,
    appendEvent,
    writeStatusSummary: () => writeStatusSummary(list()),
    isTerminal,
  };
}
