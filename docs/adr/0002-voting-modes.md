---
status: accepted
date: 2026-05-12
---

# 0002 — Three voting modes (ranked, approval, score)

## Context

A poll on "what should we do?" can mean different things. Each voting method matches a different decision shape:

- **Ranked-choice (IRV)** — best for "pick one winner from N>2 where preferences matter." A single winner with strong support.
- **Approval** — fastest for "which of these are acceptable?" Allows any subset.
- **Score** — best for "rate each option absolutely." Surfaces lukewarm support that ranking and approval can hide.

Forcing every poll into one method (Doodle defaults to approval, e.g.) gives the wrong answer for the wrong question. We want one tool that does all three.

## Decision

The host picks the mode when configuring a round. The Y.Map<string, Round>("round") singleton stores `{ mode, options, phase }`. Each peer writes a `Ballot` into `Y.Map<peerId, Ballot>("ballots")`. The ballot shape depends on the mode:

- `ranked` → `{ ranking: string[] }` — permutation of options.
- `approval` → `{ approvals: string[] }` — any subset.
- `score` → `{ scores: Record<string, number> }` — 0–10 per option.

**The tally function is pure and runs locally on every phone** from the shared ballot data. Because every peer has the same inputs (CRDT-replicated) and the tally is deterministic, every peer sees the same result without a central calculator. Implementation in `src/features/vote/tally.ts`.

## Consequences

- **Pros.** Right method per decision shape. No backend needed for tallying. Everyone agrees on the result because everyone computes it from the same inputs.
- **Cons.** Three implementations to maintain. The tally code grew to ~120 LOC — still small but not trivial. Switching modes mid-round is destructive (we clear ballots on round-start).
- **Mode parity.** All three render the same result chart (bars sorted desc, winner highlighted). Ranked mode adds a collapsible "IRV rounds" detail showing eliminations.

## Alternatives considered

- **Single mode (approval only).** Rejected — too coarse for "we want our favorite," too generous for "pick the best."
- **Condorcet / Schulze for ranked.** Rejected — harder to explain to non-voters, and produces non-intuitive winners when there's a cycle. IRV is what mainstream ranked-choice elections use (San Francisco, Maine, Australia House) and is good enough.
- **STAR voting for score.** Considered. Plain mean is simpler to explain; STAR is a possible follow-up.
