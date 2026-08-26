import { useEffect, useMemo, useState } from "react";
import {
  MeshButton,
  MeshPresence,
  MeshShellConnectionBridge,
  MeshStatusPill,
  MeshSurface,
} from "@baditaflorin/mesh-common";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";
import { createRoomSync, type RoomSync } from "../sync/yjsRoom";
import { ROUND_RESET_EVENT, ROUND_SET_EVENT, RoundSetupForm } from "./RoundSetupForm";
import { tally, type Ballot, type Mode } from "./tally";

type Round = {
  mode: Mode;
  options: string[];
  phase: "vote" | "reveal";
};

type Props = {
  roomId: string;
  peerId: string;
  roomOpen: boolean;
  onOpenRoom: () => void;
};

const DEFAULT_ROUND: Round = { mode: "approval", options: [], phase: "vote" };

const MODE_LABELS: Record<Mode, string> = {
  approval: "Approval vote",
  ranked: "Ranked choice",
  score: "Score vote",
};

export function VoteRoom({ roomId, peerId, roomOpen, onOpenRoom }: Props) {
  const [round, setRound] = useState<Round>(DEFAULT_ROUND);
  const [ballots, setBallots] = useState<Record<string, Ballot>>({});
  const [peerCount, setPeerCount] = useState(0);

  const room = useMemo<RoomSync | null>(() => {
    if (!roomOpen) return null;
    return createRoomSync(roomId);
  }, [roomId, roomOpen]);

  useEffect(() => {
    if (!roomOpen) return undefined;
    void maybeFetchTurnCredentials();
    return undefined;
  }, [roomOpen]);

  useEffect(() => {
    return () => {
      room?.provider?.destroy();
      room?.doc.destroy();
    };
  }, [room]);

  useEffect(() => {
    if (!room) return undefined;
    const roundMap = room.doc.getMap<Round>("round");
    const ballotsMap = room.doc.getMap<Ballot>("ballots");

    const refreshRound = () => {
      const current = roundMap.get("current");
      setRound(current ? { ...current, options: [...(current.options ?? [])] } : DEFAULT_ROUND);
    };
    const refreshBallots = () => {
      const next: Record<string, Ballot> = {};
      ballotsMap.forEach((ballot, key) => (next[key] = ballot));
      setBallots(next);
    };
    const onAwareness = () => {
      if (!room.provider) return;
      const states = room.provider.awareness.getStates();
      setPeerCount(states.size > 0 ? states.size - 1 : 0);
    };
    const onReset = () => {
      room.doc.transact(() => {
        ballotsMap.clear();
        const current = roundMap.get("current") ?? DEFAULT_ROUND;
        roundMap.set("current", { ...current, phase: "vote" });
      });
    };
    const onSetOptions = (event: Event) => {
      const detail = (event as CustomEvent<{ options: string[]; mode: Mode }>).detail;
      room.doc.transact(() => {
        ballotsMap.clear();
        roundMap.set("current", {
          mode: detail.mode,
          options: detail.options,
          phase: "vote",
        });
      });
    };

    refreshRound();
    refreshBallots();
    onAwareness();
    roundMap.observe(refreshRound);
    ballotsMap.observe(refreshBallots);
    room.provider?.awareness.on("change", onAwareness);
    window.addEventListener(ROUND_RESET_EVENT, onReset);
    window.addEventListener(ROUND_SET_EVENT, onSetOptions as EventListener);

    return () => {
      roundMap.unobserve(refreshRound);
      ballotsMap.unobserve(refreshBallots);
      room.provider?.awareness.off("change", onAwareness);
      window.removeEventListener(ROUND_RESET_EVENT, onReset);
      window.removeEventListener(ROUND_SET_EVENT, onSetOptions as EventListener);
    };
  }, [room]);

  const shellRoom = useMemo(
    () =>
      room
        ? {
            doc: room.doc,
            provider: room.provider,
            peerId: room.peerId,
            deviceId: peerId,
            peerCount,
            roomId,
          }
        : null,
    [peerCount, peerId, room, roomId],
  );
  const myBallot: Ballot = ballots[peerId] ?? {};
  const ballotCount = Object.keys(ballots).length;
  const result = useMemo(() => {
    if (round.options.length === 0) return null;
    return tally(round.mode, round.options, Object.values(ballots));
  }, [ballots, round]);

  const saveBallot = (next: Ballot) => {
    if (!room) return;
    room.doc.getMap<Ballot>("ballots").set(peerId, next);
  };

  const reveal = () => {
    if (!room) return;
    const roundMap = room.doc.getMap<Round>("round");
    const current = roundMap.get("current") ?? DEFAULT_ROUND;
    roundMap.set("current", { ...current, phase: "reveal" });
  };

  if (!roomOpen) {
    return <VoteWelcome roomId={roomId} onOpenRoom={onOpenRoom} />;
  }

  return (
    <>
      <MeshShellConnectionBridge room={shellRoom} />
      <main className="vote-room vote-stage" aria-labelledby="vote-room-title">
        <div className="vote-workspace">
          <header className="vote-room-header">
            <div className="vote-room-title-group">
              <p className="vote-eyebrow">Peer-to-peer decision room</p>
              <h1 id="vote-room-title">
                {round.options.length === 0 ? "Build the decision" : "Cast your vote"}
              </h1>
              <p className="vote-room-lede">
                {round.options.length === 0
                  ? "Set the options once, then let every joined session respond on its own device."
                  : "Your choice updates the shared room immediately. Ballots stay transparent to the people who join."}
              </p>
            </div>
            <div className="vote-hud" aria-label="Room activity">
              <MeshPresence
                count={peerCount + 1}
                label="live sessions"
                state={peerCount > 0 ? "connected" : "idle"}
                announce="polite"
              />
              <span className="vote-hud-divider" aria-hidden="true" />
              <span className="vote-hud-stat">
                <strong>{ballotCount}</strong> {ballotCount === 1 ? "ballot" : "ballots"}
              </span>
              {round.options.length > 0 ? (
                <MeshStatusPill tone="info" dot>
                  {MODE_LABELS[round.mode]}
                </MeshStatusPill>
              ) : null}
            </div>
          </header>

          {round.options.length === 0 ? (
            <div className="vote-empty vote-stage-grid">
              <MeshSurface as="section" tone="raised" padding="lg" className="vote-setup-surface">
                <RoundSetupForm />
              </MeshSurface>
              <TransparencyBoundary roomId={roomId} peerCount={peerCount} />
            </div>
          ) : null}

          {round.options.length > 0 && round.phase === "vote" ? (
            <div className="vote-stage-grid">
              <MeshSurface
                as="section"
                tone="raised"
                padding="lg"
                className="vote-response-surface"
              >
                <VotePhase
                  mode={round.mode}
                  options={round.options}
                  ballot={myBallot}
                  ballotCount={ballotCount}
                  onChange={saveBallot}
                  onReveal={reveal}
                />
              </MeshSurface>
              <TransparencyBoundary roomId={roomId} peerCount={peerCount} />
            </div>
          ) : null}

          {round.options.length > 0 && round.phase === "reveal" && result ? (
            <div className="vote-stage-grid">
              <MeshSurface as="section" tone="raised" padding="lg" className="vote-results-surface">
                <RevealPhase result={result} mode={round.mode} ballotCount={ballotCount} />
              </MeshSurface>
              <TransparencyBoundary roomId={roomId} peerCount={peerCount} />
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}

function VoteWelcome({ roomId, onOpenRoom }: Pick<Props, "roomId" | "onOpenRoom">) {
  return (
    <main className="vote-room vote-welcome" aria-labelledby="quiet-vote-title">
      <div className="vote-welcome-grid">
        <section className="vote-welcome-copy">
          <p className="vote-eyebrow">Peer-to-peer decision room</p>
          <h1 id="quiet-vote-title">Quiet Vote</h1>
          <p className="vote-welcome-lede">
            A focused place to make a group decision without a host, an account, or a central tally
            service.
          </p>
          <div className="vote-welcome-actions">
            <MeshButton size="lg" onClick={onOpenRoom}>
              Enter this decision room
            </MeshButton>
            <p className="vote-room-code">
              This room&apos;s code <code>{roomId}</code>
            </p>
          </div>
          <div className="vote-welcome-signals" aria-label="How Quiet Vote works">
            <MeshStatusPill tone="success" dot>
              No central host
            </MeshStatusPill>
            <MeshStatusPill tone="neutral">Share the room link deliberately</MeshStatusPill>
          </div>
        </section>

        <MeshSurface as="aside" tone="accent" padding="lg" className="vote-welcome-boundary">
          <p className="vote-eyebrow">Before you start</p>
          <h2>An honest privacy boundary</h2>
          <p>
            This room is peer-to-peer, but it is not a secret ballot. Submitted choices replicate to
            every person who joins the room.
          </p>
          <dl>
            <div>
              <dt>Good for</dt>
              <dd>Transparent team, family, and small-group decisions.</dd>
            </div>
            <div>
              <dt>Not for</dt>
              <dd>Confidential, anonymous, or coercion-sensitive votes.</dd>
            </div>
          </dl>
        </MeshSurface>
      </div>
    </main>
  );
}

function TransparencyBoundary({ roomId, peerCount }: { roomId: string; peerCount: number }) {
  return (
    <aside className="vote-boundary" aria-labelledby="vote-boundary-title">
      <div className="vote-boundary-heading">
        <p className="vote-eyebrow">Room notes</p>
        <h2 id="vote-boundary-title">Make the boundary clear</h2>
      </div>
      <dl className="vote-boundary-list">
        <div>
          <dt>Room code</dt>
          <dd>
            <code>{roomId}</code>
          </dd>
        </div>
        <div>
          <dt>Who can change it?</dt>
          <dd>Anyone who has joined can set options, restart voting, or show the tally.</dd>
        </div>
        <div>
          <dt>Ballot visibility</dt>
          <dd>Choices replicate across the room; use a different tool for a secret ballot.</dd>
        </div>
      </dl>
      <p className="vote-boundary-presence">
        {peerCount === 0
          ? "You are the only live session so far. Use Invite to bring someone into this room."
          : `${peerCount + 1} live sessions are currently visible to this room.`}
      </p>
    </aside>
  );
}

function VotePhase({
  mode,
  options,
  ballot,
  ballotCount,
  onChange,
  onReveal,
}: {
  mode: Mode;
  options: string[];
  ballot: Ballot;
  ballotCount: number;
  onChange: (next: Ballot) => void;
  onReveal: () => void;
}) {
  return (
    <div className="vote-phase">
      <div className="vote-phase-heading">
        <div>
          <p className="vote-eyebrow">{MODE_LABELS[mode]}</p>
          <h2>Choose your position</h2>
        </div>
        <span className="vote-phase-count" aria-live="polite">
          {ballotCount} {ballotCount === 1 ? "submitted ballot" : "submitted ballots"}
        </span>
      </div>
      <p className="vote-phase-description">
        Every choice is visible to people in this room. This helps small groups decide openly; it
        does not create a secret ballot.
      </p>

      {mode === "ranked" ? (
        <RankedInput options={options} ranking={ballot.ranking ?? []} onChange={onChange} />
      ) : null}
      {mode === "approval" ? (
        <ApprovalInput options={options} approvals={ballot.approvals ?? []} onChange={onChange} />
      ) : null}
      {mode === "score" ? (
        <ScoreInput options={options} scores={ballot.scores ?? {}} onChange={onChange} />
      ) : null}

      <div className="vote-reveal-action">
        <MeshButton size="lg" fullWidth onClick={onReveal}>
          Reveal the room tally
        </MeshButton>
        <p>Any joined participant can do this. The tally is calculated locally on each device.</p>
      </div>
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
  const ordered = useMemo(() => {
    const known = new Set(options);
    const inOrder = ranking.filter((option) => known.has(option));
    const remaining = options.filter((option) => !inOrder.includes(option));
    return [...inOrder, ...remaining];
  }, [options, ranking]);

  const move = (index: number, delta: number) => {
    const next = [...ordered];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const current = next[index];
    const destination = next[target];
    if (current === undefined || destination === undefined) return;
    next[index] = destination;
    next[target] = current;
    onChange({ ranking: next });
  };

  return (
    <section className="vote-ranked" aria-labelledby="vote-ranked-title">
      <h3 id="vote-ranked-title">Top = first choice</h3>
      <p>Use the arrows to order every option. Instant-runoff uses your next choice if needed.</p>
      <ol>
        {ordered.map((option, index) => (
          <li key={option}>
            <span className="vote-rank" aria-hidden="true">
              {index + 1}
            </span>
            <span className="vote-opt-label">{option}</span>
            <div className="vote-rank-actions" aria-label={`Reorder ${option}`}>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${option} up`}
              >
                Up
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === ordered.length - 1}
                aria-label={`Move ${option} down`}
              >
                Down
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
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
  const toggle = (option: string) => {
    const choices = new Set(approvals);
    if (choices.has(option)) choices.delete(option);
    else choices.add(option);
    onChange({ approvals: [...choices] });
  };

  return (
    <section className="vote-approval" aria-labelledby="vote-approval-title">
      <h3 id="vote-approval-title">Tap every option you approve of.</h3>
      <p>There is no limit. Leave an option clear if you do not support it.</p>
      <ul>
        {options.map((option) => {
          const checked = approvals.includes(option);
          return (
            <li key={option}>
              <label className={checked ? "vote-approved" : ""}>
                <input type="checkbox" checked={checked} onChange={() => toggle(option)} />
                <span>{option}</span>
                <span className="vote-choice-state" aria-hidden="true">
                  {checked ? "Selected" : "Select"}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
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
  const setScore = (option: string, value: number) => {
    onChange({ scores: { ...scores, [option]: value } });
  };

  return (
    <section className="vote-score" aria-labelledby="vote-score-title">
      <h3 id="vote-score-title">Slide each option 0–10.</h3>
      <p>Use the full range: 0 means no support, 10 means strongest support.</p>
      <ul>
        {options.map((option) => {
          const value = scores[option] ?? 5;
          return (
            <li key={option}>
              <div className="vote-score-row">
                <label htmlFor={`score-${option}`} className="vote-opt-label">
                  {option}
                </label>
                <output className="vote-score-val" htmlFor={`score-${option}`}>
                  {value}
                </output>
              </div>
              <input
                id={`score-${option}`}
                type="range"
                min={0}
                max={10}
                step={1}
                value={value}
                aria-label={`Score ${option}: ${value} out of 10`}
                onChange={(event) => setScore(option, Number(event.target.value))}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RevealPhase({
  result,
  mode,
  ballotCount,
}: {
  result: ReturnType<typeof tally>;
  mode: Mode;
  ballotCount: number;
}) {
  const max = Math.max(1, ...result.rows.map((row) => row.value));
  return (
    <div className="vote-reveal">
      <div className="vote-phase-heading">
        <div>
          <p className="vote-eyebrow">Local room calculation</p>
          <h2>Room tally</h2>
        </div>
        <MeshStatusPill tone="live" dot>
          {ballotCount} {ballotCount === 1 ? "ballot" : "ballots"}
        </MeshStatusPill>
      </div>
      <p className="vote-results-description">
        Every joined device calculates this same result from the replicated room data.
      </p>
      {result.winner ? (
        <div className="vote-winner">
          <span>Current lead</span>
          <strong>{result.winner}</strong>
        </div>
      ) : (
        <p className="vote-no-winner">No ballots have been submitted yet, so there is no lead.</p>
      )}
      <ul className="vote-bars" aria-label="Tally results">
        {result.rows.map((row) => (
          <li key={row.option} className={row.option === result.winner ? "vote-bar-winner" : ""}>
            <div className="vote-bar-row">
              <span className="vote-opt-label">{row.option}</span>
              <span className="vote-bar-val">{row.label}</span>
            </div>
            <div className="vote-bar-track" aria-hidden="true">
              <div className="vote-bar-fill" style={{ width: `${(row.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {mode === "ranked" && result.rounds && result.rounds.length > 0 ? (
        <details className="vote-rounds">
          <summary>
            Instant-runoff path ({result.rounds.length} elimination
            {result.rounds.length === 1 ? "" : "s"})
          </summary>
          <ol>
            {result.rounds.map((round, index) => (
              <li key={index}>
                Eliminated <strong>{round.eliminated}</strong> (counts:{" "}
                {Object.entries(round.counts)
                  .map(([option, value]) => `${option}=${value}`)
                  .join(", ")}
                )
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
