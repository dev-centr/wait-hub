# Harness client stub

Any harness (first: DevCentr [harness](https://github.com/dev-centr/harness)) should treat wait-hub as the **general wait backend**. Catalogued services go through the daemon; do not invent per-agent poll scripts when waitd is running.

v1 CLI exercises **adapter #1** (`github.actions`). The HTTP API is service-agnostic (`service` + `subject`).

## Contract

```text
wait-hub wait github.actions --repo OWNER/REPO --run-id N --client devcentr-harness
```

- Exit `0` if `status=succeeded` (and skipped/neutral mapped as success)
- Exit `1` on failed / cancelled / timed_out / daemon errors
- `--no-block` registers only and prints the wait JSON
- Client id example: `devcentr-harness` (other harnesses use their own id)

## Integration sketch (later)

1. Shell out to `wait-hub` on PATH, or HTTP to `127.0.0.1:17357` (`POST /waits`, `POST /waits/:id/wait`)
2. Prefer daemon block over embedding `gh run watch` / ad-hoc AwaitShell for catalogued services
3. New long jobs → new adapters (or cold-path proposals), same client call shape
