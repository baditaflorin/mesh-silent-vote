import { useEffect, useMemo, useState } from "react";
import { createRoomSync, type RoomSync } from "../sync/yjsRoom";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";
import { tally, type Ballot, type Mode } from "./tally";

type Round = {
  mode: Mode;
  options: string[];
  phase: "vote" | "reveal";
};

type Props = {
  roomId: string;
  peerId: string;
};

const DEFAULT_ROUND: Round = { mode: "approval", options: [], phase: "vote" };

export function VoteRoom({ roomId, peerId }: Props) {
  const [armed, setArmed] = useState(false);
  const [round, setRound] = useState<Round>(DEFAULT_ROUND);
  const [ballots, setBallots] = useState<Record<string, Ballot>>({});
  const [peerCount, setPeerCount] = useState(0);

  const room = useMemo<RoomSync | null>(() => {
    if (!armed) return null;
    return createRoomSync(roomId);
  }, [armed, roomId]);

  useEffect(() => {
    if (!armed) return undefined;
    void maybeFetchTurnCredentials();
    return undefined;
  }, [armed]);

  useEffect(() => {
    return () => {
      room?.provider?.destroy();
    };
  }, [room]);

  useEffect(() => {
    if (!room) return undefined;
    const roundMap = room.doc.getMap<Round>("round");
    const ballotsMap = room.doc.getMap<Ballot>("ballots");

    const refreshRound = () => {
      const cur = roundMap.get("current");
      setRound(cur ? { ...cur, options: [...(cur.options ?? [])] } : DEFAULT_ROUND);
    };
    const refreshBallots = () => {
      const next: Record<string, Ballot> = {};
      ballotsMap.forEach((b, k) => (next[k] = b));
      setBallots(next);
    };
    refreshRound();
    refreshBallots();
    roundMap.observe(refreshRound);
    ballotsMap.observe(refreshBallots);

    const onAwareness = () => {
      if (!room.provider) return;
      const states = room.provider.awareness.getStates();
      setPeerCount(states.size > 0 ? states.size - 1 : 0);
    };
    room.provider?.awareness.on("change", onAwareness);
    onAwareness();

    const onReset = () => {
      room.doc.transact(() => {
        ballotsMap.clear();
        const cur = roundMap.get("current") ?? DEFAULT_ROUND;
        roundMap.set("current", { ...cur, phase: "vote" });
      });
    };
    const onSetOptions = (e: Event) => {
      const detail = (e as CustomEvent<{ options: string[]; mode: Mode }>).detail;
      room.doc.transact(() => {
        ballotsMap.clear();
        roundMap.set("current", {
          mode: detail.mode,
          options: detail.options,
          phase: "vote",
        });
      });
    };

    window.addEventListener("vote:reset", onReset);
    window.addEventListener("vote:set-round", onSetOptions as EventListener);

    return () => {
      roundMap.unobserve(refreshRound);
      ballotsMap.unobserve(refreshBallots);
      room.provider?.awareness.off("change", onAwareness);
      window.removeEventListener("vote:reset", onReset);
      window.removeEventListener("vote:set-round", onSetOptions as EventListener);
    };
  }, [room]);

  const myBallot: Ballot = ballots[peerId] ?? {};

  const saveBallot = (next: Ballot) => {
    if (!room) return;
    const ballotsMap = room.doc.getMap<Ballot>("ballots");
    ballotsMap.set(peerId, next);
  };

  const reveal = () => {
    if (!room) return;
    const roundMap = room.doc.getMap<Round>("round");
    const cur = roundMap.get("current") ?? DEFAULT_ROUND;
    roundMap.set("current", { ...cur, phase: "reveal" });
  };

  const result = useMemo(() => {
    if (round.options.length === 0) return null;
    return tally(round.mode, round.options, Object.values(ballots));
  }, [round, ballots]);

  if (!armed) {
    return (
      <div className="vote-arm">
        <h1>mesh-silent-vote</h1>
        <p>
          Ranked-choice, approval, or score voting on a shared list of options. Peers vote on their
          phone. Tally runs locally — no server.
        </p>
        <button type="button" className="vote-arm-button" onClick={() => setArmed(true)}>
          Join room
        </button>
        <p className="vote-hint">
          Room <code>{roomId}</code>
        </p>
      </div>
    );
  }

  return (
    <div className="vote-stage">
      <div className="vote-hud">
        <span>{peerCount + 1} phones</span>
        <span>·</span>
        <span>{Object.keys(ballots).length} ballots</span>
        <span>·</span>
        <span>{round.mode}</span>
      </div>

      {round.options.length === 0 && (
        <div className="vote-empty">
          <h2>No round configured</h2>
          <p>Open Settings to enter the options and pick a voting mode.</p>
        </div>
      )}

      {round.options.length > 0 && round.phase === "vote" && (
        <VotePhase
          mode={round.mode}
          options={round.options}
          ballot={myBallot}
          onChange={saveBallot}
          onReveal={reveal}
        />
      )}

      {round.options.length > 0 && round.phase === "reveal" && result && (
        <RevealPhase result={result} mode={round.mode} />
      )}
    </div>
  );
}

function VotePhase({
  mode,
  options,
  ballot,
  onChange,
  onReveal,
}: {
  mode: Mode;
  options: string[];
  ballot: Ballot;
  onChange: (next: Ballot) => void;
  onReveal: () => void;
}) {
  return (
    <div className="vote-phase">
      {mode === "ranked" && (
        <RankedInput options={options} ranking={ballot.ranking ?? []} onChange={onChange} />
      )}
      {mode === "approval" && (
        <ApprovalInput options={options} approvals={ballot.approvals ?? []} onChange={onChange} />
      )}
      {mode === "score" && (
        <ScoreInput options={options} scores={ballot.scores ?? {}} onChange={onChange} />
      )}

      <button type="button" className="vote-reveal-btn" onClick={onReveal}>
        Reveal results
      </button>
    </div>
  );
}

function RankedInput({
  options,
  ranking,
  onChange,
}: {
  options: string[];
  ranking: string[];
  onChange: (next: Ballot) => void;
}) {
  // Maintain a working order that is initially the saved ranking, then unranked options at the end.
  const ordered = useMemo(() => {
    const known = new Set(options);
    const inOrder = ranking.filter((o) => known.has(o));
    const remaining = options.filter((o) => !inOrder.includes(o));
    return [...inOrder, ...remaining];
  }, [options, ranking]);

  const move = (idx: number, delta: number) => {
    const next = [...ordered];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[idx];
    const b = next[target];
    if (a === undefined || b === undefined) return;
    next[idx] = b;
    next[target] = a;
    onChange({ ranking: next });
  };

  return (
    <div className="vote-ranked">
      <h2>Drag with the arrows. Top = first choice.</h2>
      <ol>
        {ordered.map((opt, i) => (
          <li key={opt}>
            <span className="vote-rank">{i + 1}.</span>
            <span className="vote-opt-label">{opt}</span>
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label="Move up"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === ordered.length - 1}
              aria-label="Move down"
            >
              ▼
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ApprovalInput({
  options,
  approvals,
  onChange,
}: {
  options: string[];
  approvals: string[];
  onChange: (next: Ballot) => void;
}) {
  const toggle = (opt: string) => {
    const set = new Set(approvals);
    if (set.has(opt)) set.delete(opt);
    else set.add(opt);
    onChange({ approvals: [...set] });
  };
  return (
    <div className="vote-approval">
      <h2>Tap every option you approve of.</h2>
      <ul>
        {options.map((opt) => {
          const checked = approvals.includes(opt);
          return (
            <li key={opt}>
              <label className={checked ? "vote-approved" : ""}>
                <input type="checkbox" checked={checked} onChange={() => toggle(opt)} />
                <span>{opt}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScoreInput({
  options,
  scores,
  onChange,
}: {
  options: string[];
  scores: Record<string, number>;
  onChange: (next: Ballot) => void;
}) {
  const setScore = (opt: string, v: number) => {
    onChange({ scores: { ...scores, [opt]: v } });
  };
  return (
    <div className="vote-score">
      <h2>Slide each option 0–10.</h2>
      <ul>
        {options.map((opt) => {
          const v = scores[opt] ?? 5;
          return (
            <li key={opt}>
              <div className="vote-score-row">
                <span className="vote-opt-label">{opt}</span>
                <span className="vote-score-val">{v}</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={v}
                onChange={(e) => setScore(opt, Number(e.target.value))}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RevealPhase({ result, mode }: { result: ReturnType<typeof tally>; mode: Mode }) {
  const max = Math.max(1, ...result.rows.map((r) => r.value));
  return (
    <div className="vote-reveal">
      <h2>Results</h2>
      {result.winner && (
        <div className="vote-winner">
          Winner: <strong>{result.winner}</strong>
        </div>
      )}
      <ul className="vote-bars">
        {result.rows.map((row) => (
          <li key={row.option} className={row.option === result.winner ? "vote-bar-winner" : ""}>
            <div className="vote-bar-row">
              <span className="vote-opt-label">{row.option}</span>
              <span className="vote-bar-val">{row.label}</span>
            </div>
            <div className="vote-bar-track">
              <div className="vote-bar-fill" style={{ width: `${(row.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {mode === "ranked" && result.rounds && result.rounds.length > 0 && (
        <details className="vote-rounds">
          <summary>
            IRV rounds ({result.rounds.length} elimination{result.rounds.length === 1 ? "" : "s"})
          </summary>
          <ol>
            {result.rounds.map((r, i) => (
              <li key={i}>
                Eliminated <strong>{r.eliminated}</strong> (counts:{" "}
                {Object.entries(r.counts)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")}
                )
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
