# ADR 0002 — Equivalence-engine deferred (cold path)

## Status

Accepted (v1) — deferred

## Context

Equivalence-engine (EE) is valuable for **cataloguing equivalent implementations across ecosystems**. It is the wrong tool for the hot path of “wait until this subject completes,” whether the subject is a GitHub Actions run, a registry publish, or another long job.

## Decision

- **EE is out of the v1 hot path.** The daemon does not load EE graphs to find poll scripts.
- **Cold path (later):** agents may *propose* a wait automation for an uncatalogued `service` — draft roughly: service id, how to detect completion, auth needs — stored for human/review, eventually becoming a first-party adapter.
- **Optional later EE use:** catalogue adapter *implementations* across languages/ecosystems once the adapter contract is stable — not “find a script on disk to poll.”

## Consequences

- v1 stays small: thin daemon + adapter #1 (`github.actions`) + client stub.
- Proposals are a product feature for broad ecosystem coverage, not an escape hatch that reopens env-discovery complexity.
