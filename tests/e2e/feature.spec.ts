import { expect, test, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

/**
 * Load-bearing cross-peer test for the ADVERTISED core action: ranked-choice /
 * approval / score voting where the *aggregate tally* is computed over the
 * replicated set of every peer's ballot (`ballots` Y.Map, keyed per peer).
 *
 * The single falsifiable question: when peer A casts a ballot and peer B casts
 * a different ballot, does the revealed aggregate on EACH peer reflect BOTH
 * ballots? If ballots went to local `useState`, peer B would only count its own
 * vote and these assertions would fail.
 *
 * Subtlety this test pins down: two Playwright pages share one browser context,
 * hence one origin, hence one `localStorage`. The app derives a per-device id
 * via `ensurePeerId()` (a random UUID persisted in localStorage). Without care,
 * the second page would read the first page's persisted id and both ballots
 * would collide on the same `ballots` Y.Map key — silently producing a single
 * aggregated ballot. We give each page a DISTINCT, deterministic device id by
 * overriding `crypto.randomUUID` per page BEFORE the app boots, modelling two
 * real phones. A 2-ballot aggregate is only reachable if the two ballots live
 * under distinct keys AND replicate across the mesh.
 */
async function openTwoVoters(
  browser: Browser,
  url: string,
  roomId: string,
): Promise<{ a: Page; b: Page; cleanup: () => Promise<void> }> {
  const context = await browser.newContext({ baseURL: url || undefined });

  // Shared room + dead signaling (y-webrtc BroadcastChannel fallback syncs the
  // two pages with no server).
  await context.addInitScript(
    ({ prefix, room, sig }) => {
      try {
        localStorage.setItem(`${prefix}:room`, room);
        localStorage.setItem(`${prefix}:signalingUrl`, sig);
        localStorage.removeItem(`${prefix}:iceServers`);
        // Clear any persisted device id so each page mints its own below.
        localStorage.removeItem(`${prefix}:peerId`);
      } catch {
        /* ignore */
      }
    },
    { prefix: storagePrefix, room: roomId, sig: "ws://localhost:1/never-connects" },
  );

  const pinDeviceId = (id: string) =>
    // Force ensurePeerId() to mint this exact id (it calls crypto.randomUUID()).
    `(() => { const real = crypto.randomUUID.bind(crypto);
       crypto.randomUUID = () => ${JSON.stringify(id)}; void real; })();`;

  const a = await context.newPage();
  await a.addInitScript(pinDeviceId("device-A"));
  const b = await context.newPage();
  await b.addInitScript(pinDeviceId("device-B"));

  await Promise.all([a.goto(url), b.goto(url)]);
  return { a, b, cleanup: () => context.close() };
}

async function join(page: Page) {
  await page.getByRole("button", { name: /join room/i }).click();
  await expect(page.locator(".vote-stage")).toBeVisible();
}

test("aggregate approval tally reflects BOTH peers' ballots across the mesh", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoVoters(
    browser,
    baseURL ?? "",
    `e2e-vote-${Math.random().toString(36).slice(2, 8)}`,
  );
  try {
    await join(a);
    await join(b);

    // Peer A configures the round; it lives in the shared `round` Y.Map.
    await a.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("vote:set-round", {
          detail: { options: ["Pizza", "Sushi", "Tacos"], mode: "approval" },
        }),
      );
    });

    // Round config must propagate to peer B (it never touched its own settings).
    await expect(b.getByText(/Tap every option you approve/i)).toBeVisible();
    await expect(a.getByText(/Tap every option you approve/i)).toBeVisible();

    // Peer A approves ONLY Pizza. Peer B approves Pizza + Sushi.
    await a.getByRole("checkbox").nth(0).check(); // Pizza
    await b.getByRole("checkbox").nth(0).check(); // Pizza
    await b.getByRole("checkbox").nth(1).check(); // Sushi

    // Both peers should observe 2 ballots in the HUD before revealing — proves
    // ballots replicated across the mesh under distinct keys, not local state.
    await expect(a.locator(".vote-hud")).toContainText("2 ballots");
    await expect(b.locator(".vote-hud")).toContainText("2 ballots");

    // Reveal on peer B and read the AGGREGATE off peer B's screen.
    await b.getByRole("button", { name: /reveal results/i }).click();

    const bPizza = b.locator(".vote-bars li", { hasText: "Pizza" });
    const bSushi = b.locator(".vote-bars li", { hasText: "Sushi" });
    const bTacos = b.locator(".vote-bars li", { hasText: "Tacos" });

    // Pizza got both approvals (A + B) => 2. Sushi only B => 1. Tacos => 0.
    // If peer B only saw its own ballot, Pizza would be 1 and this fails.
    await expect(bPizza.locator(".vote-bar-val")).toHaveText("2");
    await expect(bSushi.locator(".vote-bar-val")).toHaveText("1");
    await expect(bTacos.locator(".vote-bar-val")).toHaveText("0");
    await expect(b.locator(".vote-winner")).toContainText("Pizza");

    // Reveal also propagates: peer A flips to reveal and shows the same totals.
    await expect(
      a.locator(".vote-bars li", { hasText: "Pizza" }).locator(".vote-bar-val"),
    ).toHaveText("2");
    await expect(a.locator(".vote-winner")).toContainText("Pizza");
  } finally {
    await cleanup();
  }
});

test("aggregate score tally averages both peers' scores across the mesh", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoVoters(
    browser,
    baseURL ?? "",
    `e2e-score-${Math.random().toString(36).slice(2, 8)}`,
  );
  try {
    await join(a);
    await join(b);

    await a.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("vote:set-round", {
          detail: { options: ["Alpha", "Beta"], mode: "score" },
        }),
      );
    });

    await expect(b.getByText(/Slide each option/i)).toBeVisible();
    await expect(a.getByText(/Slide each option/i)).toBeVisible();

    // Peer A: Alpha=8, Beta=0. Peer B: Alpha=10, Beta=2.
    // Score tally is the MEAN across ballots: Alpha=(8+10)/2=9.00,
    // Beta=(0+2)/2=1.00 — only correct if both ballots replicated.
    const setRange = async (page: Page, idx: number, value: number) => {
      const slider = page.locator('input[type="range"]').nth(idx);
      await slider.evaluate((el, v) => {
        const input = el as HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )!.set!;
        setter.call(input, String(v));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
    };

    await setRange(a, 0, 8); // Alpha
    await setRange(a, 1, 0); // Beta
    await setRange(b, 0, 10); // Alpha
    await setRange(b, 1, 2); // Beta

    await expect(a.locator(".vote-hud")).toContainText("2 ballots");
    await expect(b.locator(".vote-hud")).toContainText("2 ballots");

    await b.getByRole("button", { name: /reveal results/i }).click();

    const bAlpha = b.locator(".vote-bars li", { hasText: "Alpha" });
    const bBeta = b.locator(".vote-bars li", { hasText: "Beta" });
    await expect(bAlpha.locator(".vote-bar-val")).toHaveText("9.00");
    await expect(bBeta.locator(".vote-bar-val")).toHaveText("1.00");
    await expect(b.locator(".vote-winner")).toContainText("Alpha");
  } finally {
    await cleanup();
  }
});
