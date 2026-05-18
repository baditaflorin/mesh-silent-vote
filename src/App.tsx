import { useEffect, useMemo, useState } from "react";
import { VoteRoom } from "./features/vote/VoteRoom";
import { SettingsDrawer } from "./features/settings/SettingsDrawer";
import { appConfig } from "./shared/config";
import { InviteShareButton, MeshBeacon } from "@baditaflorin/mesh-common";

const STORAGE = {
  room: `${appConfig.storagePrefix}:room`,
  peer: `${appConfig.storagePrefix}:peerId`,
};

function readString(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}

function ensurePeerId(): string {
  const existing = localStorage.getItem(STORAGE.peer);
  if (existing && existing.length > 0) return existing;
  const fresh = crypto.randomUUID();
  localStorage.setItem(STORAGE.peer, fresh);
  return fresh;
}

export function App() {
  const [roomId, setRoomId] = useState(() => readString(STORAGE.room, "default"));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const peerId = useMemo(() => ensurePeerId(), []);

  useEffect(() => {
    localStorage.setItem(STORAGE.room, roomId);
  }, [roomId]);

  return (
    <div className="app-root">
      <VoteRoom roomId={roomId} peerId={peerId} />

      <InviteShareButton appName={appConfig.appName} roomId={roomId} />
      <MeshBeacon app={appConfig.appName} room={roomId} />

      <button
        type="button"
        className="settings-fab"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
      >
        ⚙
      </button>

      <div className="self-ref">
        <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
          source
        </a>
        <span aria-hidden="true">·</span>
        <a href={appConfig.paypalUrl} target="_blank" rel="noreferrer">
          tip ♥
        </a>
        <span aria-hidden="true">·</span>
        <span>
          v{appConfig.version} · {appConfig.commit}
        </span>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={roomId}
        onRoomChange={setRoomId}
      />
    </div>
  );
}
