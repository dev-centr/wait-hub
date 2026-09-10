# Architecture (one-pager)

**wait-hub** is a machine-local **general wait / event bus**: register a wait, fan in completion, notify subscribers. Sibling to [hive-watch](https://github.com/dev-centr/hive-watch) (git remotes) — different concern.

Waiting is ecosystem-wide. **Forges are the main target for now**; the core must stay service-agnostic so clients stop reinventing poll/`AwaitShell` loops for every long job.

## Hot path (v1)

```
Any client (harness / agent / CLI / future gh hand-off)
        │  register_wait(service, subject, client)
        ▼
   waitd — registry + fan-in + wait_until
        │
        ├── built-in adapter(s)  (v1: github.actions via API poll)
        └── optional ingest       (e.g. POST /ingest/github)
        ▼
  $CODE_ROOT/wait-hub.status.json
  $CODE_ROOT/wait-hub.events.jsonl
  $CODE_ROOT/wait-hub/waits/*.json
```

- Core ops: **register_wait** · **complete_wait** · **wait_until** · **list**
- `service` = open string; adapters are plugins, not the product name
- **GitHub Actions = adapter #1**, not product identity
- Daemon owns waiting; adapters use normal auth for that service
- Agents register waits — they do **not** invent monitors for catalogued services
- **Equivalence-engine is not on this path** ([ADR 0002](adr/0002-ee-deferred.md))

## Cold path (later)

Propose automation for an unknown `service` → human/review → first-party adapter. EE may later catalogue adapter *implementations* across ecosystems — never “find a script on disk to poll.”

## Same pattern, many jobs

Remote CI, registry publish, Pages/DNS, deploy probes, any long job with a completion signal — one bus, many adapters.

| Concern | Layer |
| --- | --- |
| Wait for completion (any service) | **wait-hub** |
| Hive git remotes ahead/behind | **hive-watch** |
| Local file/process ready | out of scope for v1 |

## Wait job (minimal)

`wait_id`, `service`, `subject`, `client`, `created_at`, optional `timeout_s`, `status` (`pending` \| `succeeded` \| `failed` \| `cancelled` \| `timed_out`), optional `completion` (`conclusion`, `url`, `finished_at`).
