# Privacy threat model — mesh-silent-vote

## What other peers in the same room can see

- The list of options.
- Every peer's full ballot — keyed by `peerId` (a `crypto.randomUUID()` persisted to `localStorage`).
- The round phase (vote / reveal).

**This is not a secret-ballot system.** Other peers in the room can see who voted for what, because every ballot is published to the shared CRDT under a stable peer ID. Treat it as informal team decision-making, not as a binding election.

If you need secret ballots with public tally, see [anon-conf-poll](https://github.com/baditaflorin/anon-conf-poll) for the Semaphore commit-reveal pattern.

## What stays local

- Your `peerId` UUID is local.
- Your room ID is local.
- Self-hosted infra overrides are local.

## What the signaling server sees

`signaling-server` (mine, source at https://github.com/baditaflorin/signaling-server):

- Room name (`mesh-silent-vote:<roomId>`).
- Encrypted SDP offer/answer relay.
- The WebSocket peer IP.

It does **not** see ballots — those flow peer-to-peer over WebRTC DataChannel.

## What the TURN server sees

`coturn-hetzner` (mine, source at https://github.com/baditaflorin/coturn-hetzner) relays encrypted WebRTC bytes when peers can't connect directly. It sees IP addresses of both endpoints and encrypted DTLS-SRTP traffic. It cannot decrypt ballots.

## Permissions asked

None.

## What's NOT in the threat model

- **Ballot secrecy.** Explicitly not provided — see above.
- **Coercion resistance.** A coercer in the room can read your ballot in real time. Don't use for situations where this matters.
- **Sybil resistance.** A user can clear `localStorage` and vote multiple times under fresh peer IDs. Acceptable for informal team decisions; not acceptable for binding votes.
