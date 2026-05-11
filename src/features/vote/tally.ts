export type Mode = "ranked" | "approval" | "score";

export type Ballot = {
  ranking?: string[];
  approvals?: string[];
  scores?: Record<string, number>;
};

export type TallyResult = {
  winner: string | null;
  rows: Array<{ option: string; value: number; label: string }>;
  rounds?: Array<{ counts: Record<string, number>; eliminated: string }>;
};

export function tally(mode: Mode, options: string[], ballots: Ballot[]): TallyResult {
  if (mode === "approval") return tallyApproval(options, ballots);
  if (mode === "score") return tallyScore(options, ballots);
  return tallyRanked(options, ballots);
}

function tallyApproval(options: string[], ballots: Ballot[]): TallyResult {
  const counts: Record<string, number> = {};
  options.forEach((o) => (counts[o] = 0));
  for (const b of ballots) {
    const approvals = b.approvals ?? [];
    for (const o of approvals) if (o in counts) counts[o]! += 1;
  }
  const rows = options
    .map((o) => ({ option: o, value: counts[o] ?? 0, label: String(counts[o] ?? 0) }))
    .sort((a, b) => b.value - a.value || a.option.localeCompare(b.option));
  return { winner: rows[0]?.option ?? null, rows };
}

function tallyScore(options: string[], ballots: Ballot[]): TallyResult {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  options.forEach((o) => {
    sums[o] = 0;
    counts[o] = 0;
  });
  for (const b of ballots) {
    const s = b.scores ?? {};
    for (const o of options) {
      const v = s[o];
      if (typeof v === "number" && Number.isFinite(v)) {
        sums[o]! += v;
        counts[o]! += 1;
      }
    }
  }
  const rows = options
    .map((o) => {
      const mean = (counts[o] ?? 0) > 0 ? (sums[o] ?? 0) / (counts[o] ?? 1) : 0;
      return {
        option: o,
        value: mean,
        label: mean.toFixed(2),
      };
    })
    .sort((a, b) => b.value - a.value || a.option.localeCompare(b.option));
  return { winner: rows[0]?.option ?? null, rows };
}

function tallyRanked(options: string[], ballots: Ballot[]): TallyResult {
  // Instant-runoff (Hare): eliminate lowest, redistribute, repeat until majority.
  let active = new Set(options);
  const rounds: Array<{ counts: Record<string, number>; eliminated: string }> = [];
  const firstPlaceCounts = countFirstPlace(options, ballots, options);
  let winner: string | null = null;

  for (let safety = 0; safety < options.length; safety++) {
    const counts = countFirstPlace([...active], ballots, options);
    const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0);
    if (active.size <= 1 || totalVotes === 0) {
      // pick the only/best remaining option
      const sorted = [...active].sort(
        (a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b),
      );
      winner = sorted[0] ?? null;
      break;
    }
    // Check majority
    const top = Math.max(...Object.values(counts));
    const topOption = [...active].find((o) => (counts[o] ?? 0) === top);
    if (top > totalVotes / 2) {
      winner = topOption ?? null;
      break;
    }
    // Eliminate lowest. Tie-break: fewest first-place from initial ballots, then alphabetical.
    const min = Math.min(...Object.values(counts));
    const candidates = [...active].filter((o) => (counts[o] ?? 0) === min);
    candidates.sort((a, b) => {
      const af = firstPlaceCounts[a] ?? 0;
      const bf = firstPlaceCounts[b] ?? 0;
      if (af !== bf) return af - bf;
      return a.localeCompare(b);
    });
    const eliminated = candidates[0];
    if (!eliminated) {
      winner = topOption ?? null;
      break;
    }
    rounds.push({ counts: { ...counts }, eliminated });
    active.delete(eliminated);
  }

  const finalCounts = countFirstPlace(options, ballots, options);
  const rows = options
    .map((o) => ({
      option: o,
      value: finalCounts[o] ?? 0,
      label: String(finalCounts[o] ?? 0),
    }))
    .sort((a, b) => b.value - a.value || a.option.localeCompare(b.option));

  return { winner, rows, rounds };
}

function countFirstPlace(
  active: string[],
  ballots: Ballot[],
  allOptions: string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of allOptions) counts[o] = 0;
  const activeSet = new Set(active);
  for (const b of ballots) {
    const r = b.ranking ?? [];
    for (const o of r) {
      if (activeSet.has(o)) {
        counts[o] = (counts[o] ?? 0) + 1;
        break;
      }
    }
  }
  return counts;
}
