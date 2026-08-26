import { expect, test, type Locator, type Page } from "@playwright/test";
import { captureConsoleErrors } from "@baditaflorin/mesh-common/testing";

function settingsDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Settings" });
}

function legacySettingsDrawer(page: Page): Locator {
  return page.locator(".mesh-settings-drawer, .settings-drawer").first();
}

async function isVisible(locator: Locator): Promise<boolean> {
  return locator.isVisible().catch(() => false);
}

/**
 * First-visit flows may intentionally open the accessible Settings sheet.
 * Radix correctly makes the background inaccessible while it is open, so
 * content-level assertions must close it first rather than mistake that for
 * a missing page. This remains scoped to the test; the app owns onboarding.
 */
async function closeInitiallyOpenSettings(page: Page): Promise<void> {
  const dialog = settingsDialog(page);
  if (!(await isVisible(dialog))) return;
  const close = dialog.getByRole("button", { name: "close" });
  if (await isVisible(close)) {
    await close.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(dialog).toBeHidden();
}

async function openSettings(page: Page): Promise<Locator> {
  const dialog = settingsDialog(page);
  if (await isVisible(dialog)) return dialog;

  const legacyDrawer = legacySettingsDrawer(page);
  if (await isVisible(legacyDrawer)) return legacyDrawer;

  await page.getByLabel("Open settings").click();
  if (await isVisible(dialog)) return dialog;
  await expect(legacyDrawer).toBeVisible();
  return legacyDrawer;
}

/**
 * Generic smoke test — works for any mesh-* app without modification.
 * Asserts: page loads, settings drawer opens, self-ref bar visible, no
 * console errors.
 */

test("page loads with product chrome and no unexpected console errors", async ({ page }) => {
  const c = captureConsoleErrors(page);
  await page.goto("./");
  await closeInitiallyOpenSettings(page);

  const modernShell = page.locator("[data-mesh-app-shell]");
  await expect(modernShell).toBeVisible();
  const selfRef = page.locator(".mesh-self-ref, .self-ref").first();
  if (await selfRef.count()) {
    await expect(page.getByRole("link", { name: /source/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /tip/i }).first()).toBeVisible();
    await expect(selfRef.getByText(/^v\d/)).toBeVisible();
  } else {
    // The modern product bar keeps first-use space for the decision flow; its
    // accessible controls remain the required smoke-level provenance surface.
    await expect(page.getByRole("button", { name: /invite people to quiet vote/i })).toBeVisible();
    await expect(page.getByLabel("Open settings")).toBeVisible();
  }

  // Allow a moment for async TURN fetch / WebRTC handshake; benign warnings
  // about TURN unreachable are OK, but real errors are not.
  await page.waitForTimeout(800);
  const errors = c.getErrors().filter((e) => {
    // Ignore network failures that come from the intentionally-unreachable
    // signaling URL in the test environment.
    return !/turn|stun|signaling|websocket|webrtc|failed to load resource|err_failed|err_connection|err_blocked|err_name_not_resolved/i.test(
      e,
    );
  });
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("settings drawer can be opened (or is already open) and shows infra fields", async ({
  page,
}) => {
  await page.goto("./");
  // Settings is an accessible Radix dialog in the current shell. Keep the
  // legacy drawer fallback for older app bundles that are refreshed in place.
  const drawer = await openSettings(page);
  await expect(drawer.getByText(/Self-hosted infra/i)).toBeVisible();
  await expect(drawer.getByText(/Signaling URL/i)).toBeVisible();
  await expect(drawer.getByText(/TURN credentials URL/i)).toBeVisible();
});
