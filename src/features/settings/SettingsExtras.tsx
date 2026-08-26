import { MeshButton } from "@baditaflorin/mesh-common";
import { ROUND_RESET_EVENT, RoundSetupForm } from "../vote/RoundSetupForm";

type SettingsExtrasProps = {
  roomOpen: boolean;
};

export function SettingsExtras({ roomOpen }: SettingsExtrasProps) {
  const resetRound = () => {
    if (!confirm("Clear every submitted ballot and return this room to voting?")) return;
    window.dispatchEvent(new CustomEvent(ROUND_RESET_EVENT));
  };

  return (
    <section className="vote-settings" aria-labelledby="vote-settings-title">
      <div className="vote-settings-heading">
        <p className="vote-eyebrow">Decision controls</p>
        <h2 id="vote-settings-title">Change this round</h2>
        <p>Anyone in the room can update the options or reveal a tally. There is no host role.</p>
      </div>
      {!roomOpen ? (
        <p className="vote-settings-notice" role="status">
          Enter the decision room first to create or change a shared round.
        </p>
      ) : null}
      <RoundSetupForm
        compact
        disabled={!roomOpen}
        title="Create a new round"
        description="This replaces the visible options for everyone in the room."
        actionLabel="Start new round"
      />
      <MeshButton variant="secondary" fullWidth disabled={!roomOpen} onClick={resetRound}>
        Clear ballots and return to voting
      </MeshButton>
    </section>
  );
}
