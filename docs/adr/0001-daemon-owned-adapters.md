# ADR 0001 — Daemon-owned adapters (hot path)

## Status

Accepted (v1)

## Context

Waiting is a **general** problem (CI, publish, deploy probes, DNS, …). Early brainstorm suggested the daemon could use **equivalence-engine** to discover local scripts that know how to wait in the user's environment. That re-introduces the problem this layer exists to solve: clients still invent waiters, env discovery is fragile, and "find a script on disk" is not a product contract.

Forges are the main target **for now**; the bus must not be designed as a CI-only app.

## Decision

The **hot path** is:

1. Clients register a wait with **minimal fields** (`service` as open string, `subject`, `client`, optional `timeout_s`).
2. The daemon owns **waiting**, **event fan-in**, and **completion notify** (register / complete / wait_until / list).
3. **Built-in / first-party adapters** talk to services **directly** using normal auth for that service. **GitHub Actions is adapter #1** (API via `gh` / `GITHUB_TOKEN`, optional webhook ingest) — not the product identity.
4. Agents and harnesses **must not** invent poll loops for catalogued services — they register and block/subscribe on the daemon.
5. Future: `gh` (and peers) hand off “wait for X” to this layer; until then, clients call the daemon API / CLI.

Script scavenging and EE-driven discovery are **out of the v1 hot path**.

## Consequences

- Adding a service means shipping (or accepting) a first-party adapter, or using the cold-path proposal flow — not hoping a random local script exists.
- Product framing stays broad: one bus, many adapters.
- Auth stays normal forge/tool auth already on the machine.
