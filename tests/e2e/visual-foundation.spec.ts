import { expect, test } from "@playwright/test";

test("the decision-room entry is clear and above the fold on phone and short desktop", async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1141, height: 602 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("./", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Quiet Vote", level: 1 })).toBeVisible();
    await expect(page.getByText(/not a secret ballot/i)).toBeVisible();
    const action = page.getByRole("button", { name: "Enter this decision room" });
    await expect(action).toBeVisible();

    const box = await action.boundingBox();
    expect(box, `missing action box at ${viewport.width}×${viewport.height}`).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
});

test("a joined room keeps the setup controls and transparency boundary accessible", async ({
  page,
}) => {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Enter this decision room" }).click();

  await expect(page.getByRole("heading", { name: "Build the decision", level: 1 })).toBeVisible();
  await expect(page.getByRole("group", { name: "How should people vote?" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Options" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open voting" })).toBeEnabled();
  await expect(page.getByText(/choices replicate across the room/i)).toBeVisible();
});
