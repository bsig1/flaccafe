import { expect, test } from "@playwright/test";

test("browser shell smoke renders the app chrome", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  await expect(page.getByText("FLAC Cafe")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
