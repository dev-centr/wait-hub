<div align="center">

<a href="https://github.com/dev-centr/wait-hub/graphs/contributors"><img src="https://img.shields.io/github/contributors/dev-centr/wait-hub.svg?style=for-the-badge" alt="Contributors"></a>
<a href="https://github.com/dev-centr/wait-hub/network/members"><img src="https://img.shields.io/github/forks/dev-centr/wait-hub.svg?style=for-the-badge" alt="Forks"></a>
<a href="https://github.com/dev-centr/wait-hub/stargazers"><img src="https://img.shields.io/github/stars/dev-centr/wait-hub.svg?style=for-the-badge" alt="Stargazers"></a>
<a href="https://github.com/dev-centr/wait-hub/issues"><img src="https://img.shields.io/github/issues/dev-centr/wait-hub.svg?style=for-the-badge" alt="Issues"></a>
<a href="https://github.com/dev-centr/wait-hub/blob/main/LICENSE"><img src="https://img.shields.io/github/license/dev-centr/wait-hub.svg?style=for-the-badge" alt="MIT License"></a>

# wait-hub

Machine-local wait / event bus — register a wait, get completion. Stop inventing poll loops.

[Explore the docs »](https://docs.devcentr.org/wait-hub/) · [Architecture](docs/architecture.md) · [Changelog](CHANGELOG.adoc)

</div>

<details>
<summary>Table of contents</summary>

- [About](#about)
- [What you wait on](#what-you-wait-on)
- [Getting started](#getting-started)
- [Client (harness stub)](#client-harness-stub)
- [Built with](#built-with)
- [Related](#related)
- [License](#license)
- [Contact](#contact)

</details>

## About

**wait-hub** is a thin **general wait / event bus** for the local machine (and later any harness). Clients register a wait with a `service` id and `subject`; the daemon owns waiting, fan-in, and completion notify.

Waiting is a **general** problem. Forges / CI are the main target **for now**, but the product is not “another GitHub Actions tray app.” The same contract covers registry publish, Pages/DNS, deploy probes, and any long job with a completion signal — so agents and tools stop reinventing `AwaitShell` / poll scripts.

Core API (service-agnostic): **register_wait** · **complete_wait** · **wait_until** · **list**

- `service` is an **open string**
- **Catalogued adapters** handle known services (v1 ships **GitHub Actions as adapter #1**, not the product identity)
- Unknown services: **propose-automation** cold path (draft for review → first-party adapter later)
- **Equivalence-engine is out of the hot path** — no scavenging local poll scripts ([ADR 0001](docs/adr/0001-daemon-owned-adapters.md), [ADR 0002](docs/adr/0002-ee-deferred.md))

Sibling to [hive-watch](https://github.com/dev-centr/hive-watch) (hive git remotes). Different job: remotes status vs **wait-for-completion**.

**Agents / harnesses:** register a wait and block or subscribe on the daemon. Do not invent monitors for catalogued services when wait-hub is available. Future ideal: `gh` and peers hand off “wait for X” here.

<p align="right">(<a href="#wait-hub">back to top</a>)</p>

## What you wait on

| Example | `service` (illustrative) | v1 |
| --- | --- | --- |
| GitHub Actions run | `github.actions` | **Adapter #1** (API poll; webhook ingest stub) |
| Registry publish / package index | e.g. `npm.publish`, `dub.upload` | Later adapter |
| Pages / DNS / deploy probe | open string + subject | Later / propose |
| Local hive remotes ahead/behind | — | Use **hive-watch**, not wait-hub |
| Cursor cloud wake on CI | — | Cursor Automations / Subscriptions (complementary) |

Webhooks alone do not reach the laptop; v1 polls where needed. Optional ingest endpoints land as adapters grow ([open questions](docs/open-questions.md)).

<p align="right">(<a href="#wait-hub">back to top</a>)</p>

## Getting started

Prerequisites: Node 20+. For the GitHub Actions adapter: [`gh`](https://cli.github.com/) authenticated or `GITHUB_TOKEN`.

```powershell
git clone https://github.com/dev-centr/wait-hub.git "$env:code\github.com\dev-centr\wait-hub"
cd "$env:code\github.com\dev-centr\wait-hub"
node bin/waitd.js --write-config --code-root $env:code
node bin/waitd.js --serve
```

IPC default: `http://127.0.0.1:17357` (hive-watch uses `17356`).

Artifacts (machine-local, not committed):

| Path | Role |
| --- | --- |
| `$CODE_ROOT/wait-hub.config.json` | Port, poll interval, paths |
| `$CODE_ROOT/wait-hub.status.json` | Pending summary |
| `$CODE_ROOT/wait-hub.events.jsonl` | Append-only events |
| `$CODE_ROOT/wait-hub/waits/*.json` | Per-wait records |

<p align="right">(<a href="#wait-hub">back to top</a>)</p>

## Client (harness stub)

First client surface for [DevCentr harness](https://github.com/dev-centr/harness) — any harness can use the same CLI/HTTP:

```powershell
node bin/wait-hub.js wait github.actions --repo OWNER/REPO --run-id 123456789 --client devcentr-harness
```

Also: `health`, `list`, `get <wait_id>`, `--no-block` to register only. See [docs/harness-client.md](docs/harness-client.md).

<p align="right">(<a href="#wait-hub">back to top</a>)</p>

## Built with

| Role | Stack |
| --- | --- |
| Runtime | Node.js 20+ (ESM), localhost HTTP IPC |
| Adapter #1 auth | GitHub CLI (`gh`) or `GITHUB_TOKEN` |
| Sibling pattern | [hive-watch](https://github.com/dev-centr/hive-watch) daemon + `$CODE_ROOT` status files |

<p align="right">(<a href="#wait-hub">back to top</a>)</p>

## Related

- [hive-watch](https://github.com/dev-centr/hive-watch) — hive remotes fetch + status (not waits)
- [plan-stack](https://github.com/dev-centr/plan-stack) — speculative multi-phase wait queue (consumes wait-hub; ETA-sized stacks)
- [harness](https://github.com/dev-centr/harness) — first intended client
- [docs/open-questions.md](docs/open-questions.md) — webhook relay, Cursor mid-turn wake, more adapters
- [docs/forge-watch-push.md](docs/forge-watch-push.md) — why forge watches should prefer push over poll ([cli/cli#14410](https://github.com/cli/cli/issues/14410))
- [HCI-Nerdz plan-stack demo](https://hci-nerdz.github.io/plan-stack/) — teaching surface for speculative queues

<p align="right">(<a href="#wait-hub">back to top</a>)</p>

## License

MIT — see [LICENSE](LICENSE).

## Contact

Dev-Centr — [github.com/dev-centr](https://github.com/dev-centr)

<p align="right">(<a href="#wait-hub">back to top</a>)</p>
