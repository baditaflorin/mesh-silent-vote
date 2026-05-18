import { useState } from "react";
import type { Mode } from "../vote/tally";

export function SettingsExtras() {
  const [mode, setMode] = useState<Mode>("approval");
  const [optionsText, setOptionsText] = useState("");

  const applyRound = () => {
    const opts = optionsText
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (opts.length < 2) {
      alert("Enter at least two options, one per line.");
      return;
    }
    window.dispatchEvent(new CustomEvent("vote:set-round", { detail: { options: opts, mode } }));
  };

  const resetRound = () => {
    if (!confirm("Clear all ballots and return to vote phase?")) return;
    window.dispatchEvent(new CustomEvent("vote:reset"));
  };

  return (
    <>
      <fieldset className="vote-mode-pick">
        <legend>Voting mode</legend>
        <label className="settings-check">
          <input
            type="radio"
            name="mode"
            checked={mode === "ranked"}
            onChange={() => setMode("ranked")}
          />
          <span>Ranked-choice (IRV)</span>
        </label>
        <label className="settings-check">
          <input
            type="radio"
            name="mode"
            checked={mode === "approval"}
            onChange={() => setMode("approval")}
          />
          <span>Approval</span>
        </label>
        <label className="settings-check">
          <input
            type="radio"
            name="mode"
            checked={mode === "score"}
            onChange={() => setMode("score")}
          />
          <span>Score (0–10)</span>
        </label>
      </fieldset>

      <label>
        <span>Options (one per line)</span>
        <textarea
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          rows={6}
          placeholder="Pizza&#10;Sushi&#10;Tacos"
        />
      </label>

      <div className="mesh-settings-actions">
        <button type="button" onClick={applyRound}>
          Start round
        </button>
        <button type="button" onClick={resetRound}>
          Reset round
        </button>
      </div>
    </>
  );
}
