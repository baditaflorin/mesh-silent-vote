import { useEffect, useMemo, useState } from "react";
import { MeshShell } from "@baditaflorin/mesh-common";
import { VoteRoom } from "./features/vote/VoteRoom";
import { SettingsExtras } from "./features/settings/SettingsExtras";
import { appConfig } from "./shared/config";

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
  const peerId = useMemo(() => ensurePeerId(), []);

  useEffect(() => {
    localStorage.setItem(STORAGE.room, roomId);
  }, [roomId]);

  return (
    <MeshShell
      config={appConfig}
      roomId={roomId}
      onRoomChange={setRoomId}
      settingsExtras={<SettingsExtras />}
    >
      <VoteRoom roomId={roomId} peerId={peerId} />
    </MeshShell>
  );
}
