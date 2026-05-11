# mesh-silent-vote

[![Live](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh--silent--vote-32d6b0?style=flat-square)](https://baditaflorin.github.io/mesh-silent-vote/)
[![Version](https://img.shields.io/github/package-json/v/baditaflorin/mesh-silent-vote?style=flat-square&color=7c8aa3)](https://github.com/baditaflorin/mesh-silent-vote/blob/main/package.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![No backend](https://img.shields.io/badge/backend-none-0b1018?style=flat-square)](docs/adr/0001-deployment-mode.md)

> Peer-to-peer browser mesh for group decisions. Ranked-choice, approval, or score voting on a shared list of options. Replaces Doodle Premium and the surveillance polling tools.

**Live:** https://baditaflorin.github.io/mesh-silent-vote/

Open the link on every phone. Pick a room. The host enters the options and the voting mode. Everyone votes on their phone. Tap "Reveal" to see the chart. Tally runs locally — no central counter.

## How it works

- Every phone joins a shared **Yjs document** over **y-webrtc** via my [self-hosted signaling server](https://github.com/baditaflorin/signaling-server).
- The current round (mode, options, phase) is a `Y.Map` singleton at key `"current"`.
- Each peer writes their ballot into `Y.Map<peerId, Ballot>("ballots")`. Ballot shape depends on mode:
  - `ranked` → `{ ranking: string[] }`
  - `approval` → `{ approvals: string[] }`
  - `score` → `{ scores: Record<string, number> }`
- On reveal, every phone runs the same pure tally function over the same replicated ballots and gets the same result.
- Ranked uses **instant-runoff (Hare)** with deterministic tie-break: eliminate fewest-first-place from initial ballots, then alphabetical. See [ADR 0003](docs/adr/0003-irv-details.md).

## Privacy threat model

See [docs/privacy.md](docs/privacy.md). **Ballots are not secret** — every peer in the room can read every other peer's ballot. For secret ballots see [anon-conf-poll](https://github.com/baditaflorin/anon-conf-poll) instead. Use this app for informal team decisions where transparency is fine.

## Architecture

- **Mode A** — pure GitHub Pages, zero backend at runtime. ([ADR 0001](docs/adr/0001-deployment-mode.md))
- **WebRTC transport** — Yjs + y-webrtc with self-hosted signaling and TURN.
- **No GitHub Actions** — `docs/` is committed directly. Pre-push hooks run prettier, tsc, and a build smoke test.

## Run it locally

```bash
git clone https://github.com/baditaflorin/mesh-silent-vote.git
cd mesh-silent-vote
npm install
npm run dev
```

## Self-hosted infrastructure

| Repo                                                                   | Endpoint                               | Role                        |
| ---------------------------------------------------------------------- | -------------------------------------- | --------------------------- |
| [signaling-server](https://github.com/baditaflorin/signaling-server)   | `wss://turn.0docker.com/ws`            | y-webrtc protocol fan-out   |
| [turn-token-server](https://github.com/baditaflorin/turn-token-server) | `https://turn.0docker.com/credentials` | HMAC TURN creds, 1-hour TTL |
| [coturn-hetzner](https://github.com/baditaflorin/coturn-hetzner)       | `turn:turn.0docker.com:3479`           | TURN relay                  |

Override from the in-app Settings drawer.

## Settings (in-app)

- **Room ID** — phones must share one.
- **Voting mode** — ranked / approval / score.
- **Options** — one per line, applied with "Start round" (clears prior ballots).
- **Reset round** — clears ballots and returns to vote phase.
- **Signaling URL** / **TURN credentials URL** — override defaults.

## ADRs

- [0001 — Deployment mode (Mode A, pure Pages)](docs/adr/0001-deployment-mode.md)
- [0002 — Three voting modes](docs/adr/0002-voting-modes.md)
- [0003 — Instant-runoff details and tie-break](docs/adr/0003-irv-details.md)
- [0010 — GitHub Pages publishing strategy](docs/adr/0010-pages-publishing.md)

## License

[MIT](LICENSE) © 2026 Florin Badita
