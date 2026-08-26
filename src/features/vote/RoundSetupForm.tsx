import { useId, useState } from "react";
import { MeshButton } from "@baditaflorin/mesh-common";
import type { Mode } from "./tally";

export const ROUND_SET_EVENT = "vote:set-round";
export const ROUND_RESET_EVENT = "vote:reset";

type RoundSetupFormProps = {
  disabled?: boolean;
  className?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  compact?: boolean;
};

const MODES: Array<{ mode: Mode; label: string; hint: string }> = [
  {
    mode: "approval",
    label: "Approval",
    hint: "Choose every option you support.",
  },
  {
    mode: "ranked",
    label: "Ranked choice",
    hint: "Put options in your preferred order.",
  },
  {
    mode: "score",
    label: "Score",
    hint: "Rate each option from 0 to 10.",
  },
];

/**
 * Shared round composer for the stage and the settings drawer. It only
 * requests a round change; the feature-owned Yjs room receives and replicates
 * the event, so this form never claims that a browser-local draft is shared.
 */
export function RoundSetupForm({
  disabled = false,
  className,
  title = "Set the decision",
  description = "Choose a voting method, add at least two options, then open the room for voting.",
  actionLabel = "Open voting",
  compact = false,
}: RoundSetupFormProps) {
  const [mode, setMode] = useState<Mode>("approval");
  const [optionsText, setOptionsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const optionsId = useId();
  const helpId = useId();

  const applyRound = () => {
    const options = optionsText
      .split(/\n+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const uniqueOptions = [...new Set(options)];

    if (uniqueOptions.length < 2) {
      setError("Add at least two different options before opening the vote.");
      return;
    }

    setError(null);
    window.dispatchEvent(
      new CustomEvent(ROUND_SET_EVENT, { detail: { options: uniqueOptions, mode } }),
    );
  };

  return (
    <form
      className={`vote-round-composer${compact ? " vote-round-composer-compact" : ""}${
        className ? ` ${className}` : ""
      }`}
      onSubmit={(event) => {
        event.preventDefault();
        applyRound();
      }}
    >
      <div className="vote-round-composer-heading">
        <div>
          <p className="vote-eyebrow">Round setup</p>
          <h2>{title}</h2>
        </div>
        {!compact ? <span className="vote-composer-step">01 / Decide</span> : null}
      </div>
      <p className="vote-round-composer-description">{description}</p>

      <fieldset className="vote-mode-pick">
        <legend>How should people vote?</legend>
        <div className="vote-mode-options">
          {MODES.map(({ mode: nextMode, label, hint }) => {
            const selected = mode === nextMode;
            return (
              <label className={`vote-mode-option${selected ? " is-selected" : ""}`} key={nextMode}>
                <input
                  type="radio"
                  name={`vote-mode-${optionsId}`}
                  value={nextMode}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => setMode(nextMode)}
                />
                <span className="vote-mode-option-copy">
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="vote-options-field" htmlFor={optionsId}>
        <span>Options</span>
        <textarea
          id={optionsId}
          value={optionsText}
          disabled={disabled}
          onChange={(event) => {
            setOptionsText(event.target.value);
            if (error) setError(null);
          }}
          rows={compact ? 5 : 6}
          placeholder={"Lunch at Nola\nLunch at Kismet\nLunch at Haneul"}
          aria-describedby={helpId}
        />
      </label>
      <p className="vote-options-help" id={helpId}>
        One option per line. Opening a new round clears earlier ballots in this room.
      </p>
      {error ? (
        <p className="vote-form-error" role="alert">
          {error}
        </p>
      ) : null}

      <MeshButton type="submit" size={compact ? "md" : "lg"} fullWidth disabled={disabled}>
        {disabled ? "Enter the room to set a round" : actionLabel}
      </MeshButton>
    </form>
  );
}
