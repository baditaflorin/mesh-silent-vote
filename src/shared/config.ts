export const appConfig = {
  appName: "mesh-silent-vote",
  displayName: "Quiet Vote",
  visualProfile: "gather",
  shellLayout: "inset",
  storagePrefix: "mesh-silent-vote",
  description:
    "A peer-to-peer room for transparent ranked, approval, and score decisions. Every participant can inspect the shared ballots.",
  accentHex: "#e6b36a",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
  repositoryUrl: "https://github.com/baditaflorin/mesh-silent-vote",
  pagesUrl: "https://baditaflorin.github.io/mesh-silent-vote/",
  signalingUrl:
    (import.meta.env.VITE_WEBRTC_SIGNALING as string | undefined) ?? "wss://turn.0docker.com/ws",
  turnTokenUrl:
    (import.meta.env.VITE_TURN_TOKEN_URL as string | undefined) ??
    "https://turn.0docker.com/credentials",
  paypalUrl: "https://www.paypal.com/paypalme/florinbadita",
} as const;
