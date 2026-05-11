---
status: accepted
date: 2026-05-12
---

# 0003 — Instant-runoff details and tie-break

## Context

Instant-runoff voting (Hare) has straightforward semantics but ambiguous edge cases. The two that bite implementations:

1. **Tie at the bottom.** Two options tied for last; which gets eliminated?
2. **Exhausted ballots.** A voter ranked only the top-3 of 8 options; once all three are eliminated, that ballot stops contributing.

These need a deterministic rule so every peer's local tally produces the same result.

## Decision

**Algorithm.** Plain IRV:

1. Count first-place votes among currently active candidates.
2. If any candidate has > 50% of the active votes, they win.
3. Otherwise eliminate the candidate with the fewest active first-place votes and redistribute their ballots to the next non-eliminated preference.
4. Repeat. If only one candidate remains, they win.

**Tie-break (for elimination).** If multiple candidates tie at the bottom:

1. Eliminate the one with the **fewest first-place votes from the initial round** (before any elimination). This is the "anti-Bucklin" rule — penalize the candidate who was least popular at the start.
2. If still tied, eliminate alphabetically (lexicographically lowest option name).

Both rules are deterministic and identical inputs across peers, so all phones tally to the same winner.

**Exhausted ballots.** A ballot ranking only a strict subset stops contributing once all its ranked candidates are eliminated. The "majority" threshold is recomputed each round against the remaining non-exhausted ballots (so the threshold falls as ballots exhaust — Hare semantics).

## Consequences

- **Pros.** Deterministic. Explainable. Reveal screen shows the elimination order in a collapsible "rounds" detail.
- **Cons.** Voters can be surprised that "majority" is computed over non-exhausted ballots, not the initial ballot count. We document this in the result UI's tooltip.
- **Strategy.** IRV can punish honest preference-ranking in pathological cases (the "no-show paradox"). We accept this; the alternative (Condorcet) has its own pathologies and is harder to explain.

## Alternatives considered

- **Random tie-break.** Rejected — non-deterministic across peers, would split the mesh's view of the winner.
- **Designated-leader tie-break.** Rejected — adds a coordinator role that the rest of the app doesn't need.
- **Hash-based tie-break (deterministic but obfuscated).** Considered, rejected as too clever. The anti-Bucklin + alphabetical rule is more legible.
