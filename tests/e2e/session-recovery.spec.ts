import { expect, test, type Page, type Route } from "@playwright/test";
import { mkdirSync } from "node:fs";
import type { Recipe } from "@brendon/shared";
import site from "../../apps/site/src/data/site.json";
import { dashboardFixture } from "../fixtures/dashboard";

const original: Recipe = {
  schemaVersion: 1,
  id: "6b2d645c-5931-4f6d-9fc3-50e3a741ed93",
  title: "Saved pancakes",
  slug: "saved-pancakes",
  publishedAt: "2026-10-04T12:00:00Z",
  updatedAt: "2026-10-04T12:00:00Z",
  status: "published",
  excerpt: "Original description",
  meals: ["breakfast"],
  prepMinutes: 5,
  cookMinutes: 10,
  servings: "2 people",
  body: "<p>Previously saved instructions.</p>",
};

async function setup(page: Page, expiredStatus: 401 | 403 = 401) {
  const state = {
    expired: false,
    loginResult: "failure" as "failure" | "success" | "malformed" | "held",
    heldLogin: null as Route | null,
    draftReads: 0,
    attemptedSaves: 0,
    saves: [] as Recipe[],
    publishes: [] as Recipe[],
  };
  await page.addInitScript(() => {
    let complete: ((token: string) => void) | undefined;
    window.turnstile = {
      render: (_element, options) => {
        complete = options.callback as (token: string) => void;
        queueMicrotask(() => complete?.("test-challenge"));
        return "test-widget";
      },
      reset: () => queueMicrotask(() => complete?.("test-challenge")),
      remove: () => {
        complete = undefined;
      },
    };
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    let json: unknown = {};
    if (path === "/api/session")
      json = { authenticated: true, csrfToken: "original-token" };
    else if (path === "/api/config") json = { turnstileSiteKey: "test-key" };
    else if (path === "/api/auth/login") {
      if (state.loginResult === "held") {
        state.heldLogin = route;
        return;
      }
      if (state.loginResult === "failure")
        return route.fulfill({
          status: 401,
          json: { error: "Invalid username or password." },
        });
      if (state.loginResult === "malformed")
        return route.fulfill({
          status: 200,
          body: "not-json",
          contentType: "text/plain",
        });
      state.expired = false;
      json = { authenticated: true, csrfToken: "renewed-token" };
    } else if (path === "/api/dashboard") json = dashboardFixture;
    else if (path === "/api/published/homepage")
      json = {
        content: site,
        sha: "site",
        path: "apps/site/src/data/site.json",
      };
    else if (path === "/api/published/recipes")
      json = {
        items: [
          {
            content: original,
            sha: "original-sha",
            path: "apps/site/src/content/recipes/saved-pancakes.md",
          },
        ],
      };
    else if (path === "/api/drafts" && method === "GET") json = { drafts: [] };
    else if (path.startsWith("/api/drafts/recipe/")) {
      if (method === "GET") state.draftReads += 1;
      json = {
        draft: path.endsWith(original.id) && method === "GET" ? original : null,
      };
    } else if (path === "/api/drafts" && method === "PUT") {
      state.attemptedSaves += 1;
      if (state.expired)
        return route.fulfill({
          status: expiredStatus,
          json:
            expiredStatus === 401
              ? { error: "Your session has expired. Sign in again." }
              : {
                  error: "Security token expired. Sign in again to continue.",
                  code: "csrf_expired",
                },
        });
      expect(request.headers()["x-csrf-token"]).toBe("renewed-token");
      state.saves.push(request.postDataJSON().payload);
      json = { savedAt: new Date().toISOString() };
    } else if (path === "/api/publish") {
      expect(request.headers()["x-csrf-token"]).toBe("renewed-token");
      const payload = request.postDataJSON().payload;
      state.publishes.push(payload);
      json = {
        path: "apps/site/src/content/recipes/saved-pancakes.md",
        contentSha: "published-sha",
        version: "a".repeat(40),
        publishedAt: original.publishedAt,
        publicUrl: "https://brendonbusker.github.io/recipes/saved-pancakes/",
      };
    } else if (path.startsWith("/api/deployment/"))
      json = { state: "live", message: "Recipe is live." };
    else throw new Error(`Unexpected request: ${method} ${path}`);
    await route.fulfill({ json });
  });
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await expect(page.getByRole("textbox", { name: /^Title/ })).toBeEnabled();
  await page
    .locator(".document-list")
    .getByRole("button", { name: /Saved pancakes/ })
    .click();
  await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue(
    original.title,
  );
  await expect(page.locator(".document-surface")).toContainText(
    "Previously saved instructions.",
  );
  state.expired = true;
  return state;
}

async function editRecipe(page: Page) {
  await page
    .getByRole("textbox", { name: /^Title/ })
    .fill("Unsaved family pancakes");
  await page.getByLabel("Snack", { exact: true }).check();
  await page.getByLabel("Prep time (minutes)", { exact: true }).fill("17");
  await page.getByLabel("Cook time (minutes)", { exact: true }).fill("23");
  await page.getByLabel("Servings", { exact: true }).fill("6 people");
  await page
    .getByLabel("Short description", { exact: true })
    .fill("Keep this unsaved description.");
  await page
    .locator(".document-surface")
    .fill("Keep these unsaved instructions and ingredients.");
}

async function expectRecipe(page: Page) {
  await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue(
    "Unsaved family pancakes",
  );
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(
    original.slug,
  );
  await expect(page.getByLabel("Breakfast", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Snack", { exact: true })).toBeChecked();
  await expect(
    page.getByLabel("Prep time (minutes)", { exact: true }),
  ).toHaveValue("17");
  await expect(
    page.getByLabel("Cook time (minutes)", { exact: true }),
  ).toHaveValue("23");
  await expect(page.getByLabel("Servings", { exact: true })).toHaveValue(
    "6 people",
  );
  await expect(
    page.getByLabel("Short description", { exact: true }),
  ).toHaveValue("Keep this unsaved description.");
  await expect(page.locator(".document-surface")).toContainText(
    "Keep these unsaved instructions and ingredients.",
  );
}

test("expired session recovery preserves the selected recipe through failed/cancelled login, then explicit save and publish", async ({
  page,
}) => {
  const state = await setup(page);
  await editRecipe(page);
  const reads = state.draftReads;
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Sign in again to save your work",
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: /^Username/ }),
  ).toBeFocused();
  await expect(page.locator(".draft-save-error")).toContainText(
    "Your session has expired. Sign in again.",
  );
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toHaveCSS("opacity", "1");
  mkdirSync("tmp/recipes-qa", { recursive: true });
  await page.screenshot({
    path: "tmp/recipes-qa/session-recovery-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "tmp/recipes-qa/session-recovery-mobile.png" });
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1280, height: 720 });
  await dialog.getByRole("textbox", { name: /^Username/ }).fill("test-admin");
  await dialog.getByLabel(/^Password/).fill("test-password");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Invalid username or password.",
  );
  await dialog.getByRole("button", { name: "Return to editor" }).click();
  await expect(dialog).not.toBeVisible();
  await expectRecipe(page);
  await page
    .locator(".draft-save-error")
    .getByRole("button", { name: "Retry save" })
    .click();
  expect(state.attemptedSaves).toBe(1);
  expect(state.saves).toHaveLength(0);
  expect(state.publishes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Sign in again", exact: true })
    .click();
  await dialog.getByRole("textbox", { name: /^Username/ }).fill("test-admin");
  await dialog.getByLabel(/^Password/).fill("test-password");
  state.loginResult = "success";
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  // No draft or publication should be replayed after recovery.
  await page.waitForTimeout(1500);
  await expectRecipe(page);
  expect(state.draftReads).toBe(reads);
  expect(state.saves).toHaveLength(0);
  expect(state.publishes).toHaveLength(0);
  await page
    .locator(".draft-save-error")
    .getByRole("button", { name: "Retry save" })
    .click();
  await expect.poll(() => state.saves.length).toBe(1);
  expect(state.saves[0]).toMatchObject({
    id: original.id,
    title: "Unsaved family pancakes",
    meals: ["breakfast", "snack"],
    prepMinutes: 17,
    cookMinutes: 23,
    servings: "6 people",
  });
  expect(state.saves[0]!.body).toContain(
    "Keep these unsaved instructions and ingredients.",
  );
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect.poll(() => state.publishes.length).toBe(1);
  expect(state.publishes[0]).toMatchObject({
    id: original.id,
    slug: original.slug,
    title: state.saves[0]!.title,
    body: state.saves[0]!.body,
    meals: ["breakfast", "snack"],
    prepMinutes: 17,
    cookMinutes: 23,
    servings: "6 people",
  });
});

test("CSRF recovery keeps the editor mounted on malformed login and cannot dismiss an in-flight login", async ({
  page,
}) => {
  const state = await setup(page, 403);
  await editRecipe(page);
  const reads = state.draftReads;
  await page.keyboard.press("Control+s");
  const dialog = page.getByRole("dialog", {
    name: "Sign in again to save your work",
  });
  await expect(dialog).toBeVisible();
  await expect(page.locator(".draft-save-error")).toContainText(
    "Your security token has expired. Sign in again to save your work.",
  );
  await dialog.getByRole("textbox", { name: /^Username/ }).fill("test-admin");
  await dialog.getByLabel(/^Password/).fill("test-password");
  state.loginResult = "malformed";
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Sign-in could not be confirmed",
  );
  expect(state.draftReads).toBe(reads);
  state.loginResult = "held";
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect.poll(() => state.heldLogin).not.toBeNull();
  await expect(
    dialog.getByRole("button", { name: "Return to editor" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  state.expired = false;
  await state.heldLogin!.fulfill({
    json: { authenticated: true, csrfToken: "renewed-token" },
  });
  await expect(dialog).not.toBeVisible();
  await expectRecipe(page);
  expect(state.draftReads).toBe(reads);
  expect(state.saves).toHaveLength(0);
  expect(state.publishes).toHaveLength(0);
  await page.keyboard.press("Control+s");
  await expect.poll(() => state.saves.length).toBe(1);
});
