# Open questions

Tracked for later design; not blockers for the v1 skeleton.

1. **Webhook / push ingest** — `POST /ingest/github` exists for adapter #1, but forge → laptop still needs smee / `gh webhook forward` / cloudflared. Who owns the relay — waitd, hive-watch tray, or a separate helper? Upstream ask: [`gh run watch` prefer push completion](https://github.com/cli/cli/issues/14410) ([context note](forge-watch-push.md)).
2. **Cursor wake mid-turn** — Local agents are turn-based. Blocking `wait-hub wait` / `POST …/wait` covers “same turn.” Cross-turn wake needs harness/Cursor support this daemon cannot invent alone.
3. **Subject without concrete job id** — e.g. `{ owner, repo, ref }` or “latest publish” is useful but racy; prefer explicit ids in v1.
4. **Next adapters** — registry publish, Pages/DNS, deploy probes: same pattern; prioritize by how often agents reinvent waiters.
5. **Tray / HUD** — Optional later; status JSON + IPC are enough for v1.
6. **Harness native binding** — First client is CLI (`wait-hub`); D/HTTP wrappers in harnesses can follow.
7. **Proposal store schema** — Cold-path drafts: JSON under `$CODE_ROOT/wait-hub/proposals/` vs issues in `.issues`.
8. **Security** — Bind is localhost-only; ingest should eventually verify signatures and allowlist subjects.
9. **Hand-off from `gh` / peers** — When/how CLIs register waits instead of embedding their own watchers. Tracked publicly in [cli/cli#14410](https://github.com/cli/cli/issues/14410); see [forge-watch-push.md](forge-watch-push.md).
