import { useEffect, useState } from "react";
import {
  loadSignalingUrl,
  loadTurnTokenUrl,
  resetIceServers,
  saveSignalingUrl,
  saveTurnTokenUrl,
} from "../sync/iceConfig";
import { appConfig } from "../../shared/config";
import type { Mode } from "../vote/tally";

type Props = {
  open: boolean;
  onClose: () => void;
  roomId: string;
  onRoomChange: (next: string) => void;
};

export function SettingsDrawer({ open, onClose, roomId, onRoomChange }: Props) {
  const [signaling, setSignaling] = useState(loadSignalingUrl());
  const [tokenUrl, setTokenUrl] = useState(loadTurnTokenUrl());
  const [mode, setMode] = useState<Mode>("approval");
  const [optionsText, setOptionsText] = useState("");

  useEffect(() => {
    if (open) {
      setSignaling(loadSignalingUrl());
      setTokenUrl(loadTurnTokenUrl());
    }
  }, [open]);

  if (!open) return null;

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
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <label>
          <span>Room ID</span>
          <input value={roomId} onChange={(e) => onRoomChange(e.target.value)} />
        </label>

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

        <div className="settings-actions">
          <button type="button" onClick={applyRound}>
            Start round
          </button>
          <button type="button" onClick={resetRound}>
            Reset round
          </button>
        </div>

        <hr />

        <h3>Self-hosted infra (advanced)</h3>
        <p className="settings-help">
          Override the default signaling and TURN endpoints. Leave blank to use the built-in
          defaults (<code>{appConfig.signalingUrl}</code> and <code>{appConfig.turnTokenUrl}</code>
          ).
        </p>

        <label>
          <span>Signaling URL</span>
          <input
            value={signaling}
            onChange={(e) => setSignaling(e.target.value)}
            placeholder={appConfig.signalingUrl}
          />
        </label>

        <label>
          <span>TURN credentials URL</span>
          <input
            value={tokenUrl}
            onChange={(e) => setTokenUrl(e.target.value)}
            placeholder={appConfig.turnTokenUrl}
          />
        </label>

        <div className="settings-actions">
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl(signaling);
              saveTurnTokenUrl(tokenUrl);
              onClose();
              location.reload();
            }}
          >
            Save and reload
          </button>
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl("");
              saveTurnTokenUrl("");
              resetIceServers();
              onClose();
              location.reload();
            }}
          >
            Reset to defaults
          </button>
        </div>

        <hr />

        <footer className="settings-footer">
          <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
            source on github
          </a>
          <span>
            v{appConfig.version} · {appConfig.commit}
          </span>
        </footer>
      </div>
    </div>
  );
}
