import { expect, test } from "@playwright/test";
test("admin presents a focused login without exposing credentials", async ({
  page,
}) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    }),
  );
  await page.route("**/api/config", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ turnstileSiteKey: "" }),
    }),
  );
  await page.goto("http://127.0.0.1:5173/");
  await expect(
    page.getByRole("heading", { name: "Sign in to edit the site" }),
  ).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  expect(await page.content()).not.toContain("ADMIN_PASSWORD");
});
test("authenticated admin shell exposes publishing sections", async ({
  page,
}) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, csrfToken: "test-token" }),
    }),
  );
  await page.route("**/api/drafts/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ draft: null }),
    }),
  );
  await page.goto("http://127.0.0.1:5173/");
  await expect(
    page.getByRole("complementary", { name: "Publishing sections" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Posts" }).click();
  await expect(page.getByText("Start writing…")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("complementary", { name: "Publishing sections" })
    .getByRole("button", { name: "Projects", exact: true })
    .click();
  const projectPicker = page.getByLabel("Choose a project to edit");
  await projectPicker.selectOption("shiny-hunt-tracker");
  await expect(
    page.getByRole("heading", { name: "Shiny Hunt Tracker" }),
  ).toBeVisible();
});
