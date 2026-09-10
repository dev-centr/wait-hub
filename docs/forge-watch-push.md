# Prefer push completion for forge watches

Short public note on why CLI “watch until CI finishes” should prefer **webhooks / push** over periodic API poll — and how that relates to wait-hub.

## The problem

Tools like `gh run watch` give a good human UX: block in the terminal until a GitHub Actions run reaches a terminal status. Under the hood, though, many watchers **poll** the forge API on an interval.

That means:

- Every active watcher keeps spending **API quota** even when nothing changed.
- You only learn the run finished on the **next poll tick** (latency up to the full interval).
- Every script, IDE agent, and local wait bus tends to **reinvent the same poller**.

Local process waiters (for example an IDE waiting on a shell process) only know when the **local** process exits. They do not listen to forge events. Nesting “wait on `gh run watch`” under a local process waiter is still nested polling, not event listening.

## What would help

For GitHub CLI / Actions developer experience: an efficient, low-latency, API-friendly **completion signal** for watchers — humans, scripts, and agents.

Useful shapes include:

1. **Webhook-backed `gh run watch`** — complete on `workflow_run` (or similar) delivery when push is available; keep poll as fallback.
2. **One-shot watch registration** — register interest in a run id and block until the platform signals done (managed relay / device flow / cloud-side waiter).
3. **A small hand-off contract** — so tools can subscribe once instead of each owning a poll loop.

Inbound webhooks do not reach a Windows laptop without a relay. Push-oriented watch is still valuable for cloud runners, Codespaces, CI-adjacent hosts, and any CLI-managed relay. Poll can remain the offline default.

## Feature request

Filed on the GitHub CLI tracker:

**https://github.com/cli/cli/issues/14410**

Related CLI neighbors (different asks): [log streaming](https://github.com/cli/cli/issues/3484), [`workflow run --watch`](https://github.com/cli/cli/issues/3559), [configurable poll interval](https://github.com/cli/cli/issues/12143).

## Where wait-hub fits

[wait-hub](https://github.com/dev-centr/wait-hub) is a **machine-local wait / event bus**: register a wait, get completion. GitHub Actions is adapter #1 — not the product identity.

Today the GHA adapter may poll where needed; webhook ingest is a stub/open question ([open questions](open-questions.md)). The ideal future is that `gh` (and peers) either:

- hand off “wait for this run” to a local bus like wait-hub, or
- complete watches via push themselves so local tools do not each invent watchers.

wait-hub is related context for the forge DX ask — not a substitute for platform/CLI support.

## Share

Primary link for discussion: the `cli/cli` issue above. This page is an optional second URL under the wait-hub repo for context and Twitter / blog pointers.
