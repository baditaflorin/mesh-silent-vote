export default async function quietVoteScreenshot(page) {
  await page.getByRole("button", { name: "Enter this decision room" }).click();
  await page
    .getByRole("textbox", { name: "Options" })
    .fill("Lunch at Nola\nLunch at Kismet\nLunch at Haneul");
  await page.getByRole("button", { name: "Open voting" }).click();
  await page.getByRole("checkbox", { name: "Lunch at Nola" }).check();
  await page.waitForTimeout(500);
}
