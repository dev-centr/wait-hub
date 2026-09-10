import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** Sibling of hive-watch IPC (17356). */
export const DEFAULT_PORT = 17357;
export const DEFAULT_POLL_MS = 5_000;

export function defaultCodeRoot() {
  return (
    process.env.CODE_ROOT ||
    process.env.code ||
    (process.platform === "win32" ? "C:\\code" : path.join(os.homedir(), "code"))
  );
}

export function defaultConfigPath(codeRoot = defaultCodeRoot()) {
  return path.join(codeRoot, "wait-hub.config.json");
}

export function loadConfig(configPath, codeRoot = defaultCodeRoot()) {
  const defaults = {
    code_root: codeRoot,
    ipc_port: DEFAULT_PORT,
    poll_interval_ms: DEFAULT_POLL_MS,
    status_path: path.join(codeRoot, "wait-hub.status.json"),
    events_path: path.join(codeRoot, "wait-hub.events.jsonl"),
    waits_dir: path.join(codeRoot, "wait-hub", "waits"),
  };

  if (!fs.existsSync(configPath)) {
    return { ...defaults, config_path: configPath };
  }

  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const root = raw.code_root || codeRoot;
  return {
    ...defaults,
    ...raw,
    config_path: configPath,
    code_root: root,
    status_path: raw.status_path || path.join(root, "wait-hub.status.json"),
    events_path: raw.events_path || path.join(root, "wait-hub.events.jsonl"),
    waits_dir: raw.waits_dir || path.join(root, "wait-hub", "waits"),
  };
}

export function saveDefaultConfig(configPath, codeRoot = defaultCodeRoot()) {
  const cfg = loadConfig(configPath, codeRoot);
  const { config_path: _drop, ...writable } = cfg;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(writable, null, 2)}\n`, "utf8");
  return cfg;
}
