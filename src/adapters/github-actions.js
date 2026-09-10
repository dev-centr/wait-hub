import { spawn } from "node:child_process";

/**
 * Adapter #1: GitHub Actions (not the product identity — wait-hub is a general bus).
 * Talks to the Actions API via `gh` (preferred auth) or GITHUB_TOKEN.
 * Equivalence-engine / scavenged scripts are NOT used here.
 */

function runGh(args, { token } = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (token) env.GH_TOKEN = token;
    const child = spawn("gh", args, {
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `gh exited ${code}`));
    });
  });
}

async function fetchRun({ owner, repo, run_id }, auth) {
  const path = `repos/${owner}/${repo}/actions/runs/${run_id}`;
  try {
    const out = await runGh(["api", path, "--jq", "."], { token: auth.token });
    return JSON.parse(out);
  } catch (err) {
    if (!auth.token) throw err;
    // Fallback: raw fetch with token when gh is missing/broken
    const res = await fetch(`https://api.github.com/${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${auth.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "wait-hub",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  }
}

function mapConclusion(run) {
  if (run.status !== "completed") {
    return { done: false, status: "pending", conclusion: run.conclusion || null, url: run.html_url };
  }
  const conclusion = run.conclusion || "unknown";
  let status = "failed";
  if (conclusion === "success") status = "succeeded";
  else if (conclusion === "cancelled") status = "cancelled";
  else if (conclusion === "skipped" || conclusion === "neutral") status = "succeeded";
  return {
    done: true,
    status,
    conclusion,
    url: run.html_url || null,
    finished_at: run.updated_at || run.run_updated_at || new Date().toISOString(),
  };
}

export function resolveAuth() {
  const token =
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GH_ENTERPRISE_TOKEN ||
    null;
  return { token };
}

/**
 * Validate subject for github.actions waits.
 * Minimal: { owner, repo, run_id } — run_id required for v1 poll.
 */
export function normalizeSubject(subject) {
  const owner = subject.owner || subject.org;
  const repo = subject.repo;
  const run_id = subject.run_id ?? subject.runId;
  if (!owner || !repo || run_id == null) {
    throw new Error("github.actions subject needs { owner, repo, run_id }");
  }
  return { owner: String(owner), repo: String(repo), run_id: Number(run_id) };
}

export async function pollOnce(subject, auth = resolveAuth()) {
  const run = await fetchRun(normalizeSubject(subject), auth);
  return mapConclusion(run);
}

/**
 * Apply a webhook workflow_run / check_suite style payload if it matches a wait.
 * Returns completion fields or null if not terminal / not matching.
 */
export function fromWebhookPayload(body) {
  const run = body.workflow_run || body.check_run?.check_suite || body;
  if (!run || typeof run !== "object") return null;
  if (run.status && run.status !== "completed") return null;
  const mapped = mapConclusion({
    status: run.status || "completed",
    conclusion: run.conclusion,
    html_url: run.html_url || run.url,
    updated_at: run.updated_at || run.completed_at,
  });
  if (!mapped.done) return null;
  return {
    ...mapped,
    owner: body.repository?.owner?.login || null,
    repo: body.repository?.name || null,
    run_id: run.id ?? null,
  };
}

export const serviceId = "github.actions";
