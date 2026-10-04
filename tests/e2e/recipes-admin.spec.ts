import { expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Recipe } from "@brendon/shared";
import type { PublishedItem } from "../../apps/admin/src/api";
import {
  serializeContent,
  parseManagedMarkdown,
} from "../../apps/admin/worker/index";
import site from "../../apps/site/src/data/site.json";
import { dashboardFixture } from "../fixtures/dashboard";

const gif = readFileSync("tests/fixtures/animated.gif");
const mediaPath = "/uploads/recipes/weekend-pancakes/animated.gif";
const original: Recipe = {
  schemaVersion: 1,
  id: "6b2d645c-5931-4f6d-9fc3-50e3a741ed93",
  title: "Weekend pancakes",
  slug: "weekend-pancakes",
  publishedAt: "2026-10-04T12:00:00-05:00",
  updatedAt: "2026-10-04T17:00:00Z",
  status: "published",
  excerpt: "A simple family breakfast.",
  meals: ["breakfast", "snack"],
  prepMinutes: 10,
  cookMinutes: 15,
  servings: "4 people",
  body: "<h2>Ingredients</h2><ul><li>Flour</li><li>Milk</li></ul><h2>Instructions</h2><p>Whisk and cook.</p>",
};

async function setup(page: Page, existing = false, loadFailure = false) {
  const state = {
    items: existing
      ? ([
          {
            content: structuredClone(original),
            path: "apps/site/src/content/recipes/weekend-pancakes.md",
            sha: "original-sha",
          },
        ] as PublishedItem<Recipe>[])
      : ([] as PublishedItem<Recipe>[]),
    drafts: new Map<string, Recipe>(),
    writes: [] as Array<{
      contentType: string;
      payload: Recipe;
      expectedSha?: string;
      targetPath?: string;
    }>,
    deletions: [] as Array<{
      path: string;
      expectedSha: string;
      contentKey: string;
    }>,
    upload: undefined as Buffer | undefined,
    loadFailure,
    draftLoadFailure: false,
    saveFailure: false,
    publishFailure: false,
    holdSave: false,
    held: null as Route | null,
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    let json: unknown = {};
    if (path === "/api/session")
      json = { authenticated: true, csrfToken: "recipe-test" };
    else if (path === "/api/dashboard") json = dashboardFixture;
    else if (path === "/api/published/homepage")
      json = {
        content: site,
        sha: "site",
        path: "apps/site/src/data/site.json",
      };
    else if (path === "/api/published/recipes" && method === "GET") {
      if (state.loadFailure)
        return route.fulfill({
          status: 503,
          json: { error: "Recipes unavailable" },
        });
      json = { items: state.items };
    } else if (path === "/api/published/recipes" && method === "DELETE") {
      const body = request.postDataJSON();
      state.deletions.push(body);
      state.items = state.items.filter((item) => item.path !== body.path);
      state.drafts.delete(body.contentKey);
      json = {
        version: "d".repeat(40),
        publicUrl: "https://brendonbusker.github.io/recipes/",
        commitUrl: "https://github.test/deletion",
      };
    } else if (path === "/api/drafts") {
      if (method === "PUT") {
        expect(request.headers()["x-csrf-token"]).toBe("recipe-test");
        const body = request.postDataJSON();
        expect(body.contentType).toBe("recipe");
        if (state.holdSave) {
          state.holdSave = false;
          state.held = route;
          return;
        }
        if (state.saveFailure)
          return route.fulfill({
            status: 503,
            json: { error: "Draft save failed" },
          });
        state.drafts.set(body.contentKey, body.payload);
        json = { savedAt: new Date().toISOString() };
      } else
        json = {
          drafts: [...state.drafts].map(([key, payload]) => ({
            id: key,
            content_type: "recipe",
            content_key: key,
            payload_json: JSON.stringify(payload),
            updated_at: "2026-10-04T18:00:00Z",
          })),
        };
    } else if (path.startsWith("/api/drafts/recipe/")) {
      const key = path.split("/").pop()!;
      if (method === "DELETE") state.drafts.delete(key);
      if (method === "GET" && state.draftLoadFailure)
        return route.fulfill({
          status: 503,
          json: { error: "Draft unavailable" },
        });
      json = { draft: state.drafts.get(key) ?? null };
    } else if (path.startsWith("/api/publish/media/recipes/")) {
      state.upload = request.postDataBuffer()!;
      json = {
        path: mediaPath,
        alt: "Pancakes cooking",
        version: "c".repeat(40),
        publicUrl: `https://brendonbusker.github.io${mediaPath}`,
      };
    } else if (path === "/api/publish") {
      const body = request.postDataJSON();
      state.writes.push(body);
      expect(body.contentType).toBe("recipe");
      if (state.publishFailure)
        return route.fulfill({
          status: 409,
          json: { error: "Recipe changed. Reload before publishing." },
        });
      const content = {
        ...body.payload,
        publishedAt: original.publishedAt,
      } as Recipe;
      const serialized = serializeContent("recipe", content, body.targetPath);
      expect(parseManagedMarkdown(serialized.content).data.meals).toEqual(
        content.meals,
      );
      const item = {
        content,
        path: serialized.path,
        sha: `sha-${state.writes.length}`,
      };
      state.items = [
        item,
        ...state.items.filter((other) => other.content.id !== content.id),
      ];
      json = {
        path: item.path,
        contentSha: item.sha,
        version: "a".repeat(40),
        publishedAt: content.publishedAt,
        publicUrl: `https://brendonbusker.github.io/recipes/${content.slug}/`,
      };
    } else if (path.startsWith("/api/deployment/"))
      json = { state: "live", message: "Your recipe is live." };
    else if (path.startsWith("/api/published/")) json = { items: [] };
    else throw new Error(`Unexpected request: ${method} ${path}`);
    await route.fulfill({ json });
  });
  await page.route(`**${mediaPath}`, (route) =>
    route.fulfill({ contentType: "image/gif", body: gif }),
  );
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  if (!loadFailure) {
    await expect(page.getByRole("textbox", { name: /^Title/ })).toBeEnabled();
    if (existing) {
      await page
        .locator(".document-list")
        .getByRole("button", { name: /Weekend pancakes/ })
        .click();
      await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue(
        original.title,
      );
      await expect(
        page.getByRole("button", { name: "Publish", exact: true }),
      ).toBeEnabled();
    }
  }
  return state;
}

test("recipes keep rich formatting, meal labels, optional details and original GIF bytes through publish and reopen", async ({
  page,
}) => {
  const state = await setup(page);
  await page.getByRole("textbox", { name: /^Title/ }).fill(original.title);
  await page.getByLabel("Slug", { exact: true }).fill(original.slug);
  await page.getByLabel("Breakfast", { exact: true }).check();
  await page.getByLabel("Snack", { exact: true }).check();
  await page.getByLabel("Prep time (minutes)", { exact: true }).fill("10");
  await page.getByLabel("Cook time (minutes)", { exact: true }).fill("15");
  await page.getByLabel("Servings", { exact: true }).fill("4 people");
  await page
    .getByLabel("Short description", { exact: true })
    .fill(original.excerpt);
  const body = page.locator(".document-surface");
  await body.evaluate((element, html) => {
    const clipboard = new DataTransfer();
    clipboard.setData("text/html", html);
    clipboard.setData(
      "text/plain",
      "Ingredients Flour Milk Instructions Whisk and cook.",
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: clipboard,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, original.body);
  await expect(body.locator("h2")).toHaveCount(2);
  await expect(body.locator("li")).toHaveCount(2);
  for (const label of ["Bold (Ctrl+B)", "Image", "Table"]) {
    // Recipe mode uses the same formatting ribbon as Blog.
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  }
  page.once("dialog", (dialog) => dialog.accept("Pancakes cooking"));
  await body.evaluate((element, bytes) => {
    const clipboard = new DataTransfer();
    clipboard.items.add(
      new File([Uint8Array.from(bytes)], "animated.gif", { type: "image/gif" }),
    );
    clipboard.setData(
      "text/html",
      '<img src="https://example.test/duplicate.gif">',
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: clipboard,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, Array.from(gif));
  const image = body.locator("img");
  await expect(image).toHaveCount(1);
  await expect(image).toHaveAttribute("data-cms-path", mediaPath);
  expect(state.upload?.includes(gif)).toBe(true);
  const firstFrame = await image.screenshot();
  await expect
    .poll(async () => (await image.screenshot()).equals(firstFrame), {
      intervals: [90, 130, 170],
    })
    .toBe(false);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".preview-canvas img")).toBeVisible();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await expect.poll(() => state.drafts.size).toBe(0);
  expect(state.writes[0]?.payload).toMatchObject({
    title: original.title,
    meals: ["breakfast", "snack"],
    prepMinutes: 10,
    cookMinutes: 15,
    servings: "4 people",
    status: "published",
  });
  expect(state.writes[0]?.payload.body).toContain(mediaPath);
  expect(state.writes[0]?.payload.body).not.toContain("blob:");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await page
    .locator(".document-list")
    .getByRole("button", { name: /Weekend pancakes/ })
    .click();
  await expect(page.getByLabel("Servings", { exact: true })).toHaveValue(
    "4 people",
  );
  await expect(page.getByLabel("Slug", { exact: true })).toBeDisabled();
  await expect(page.locator(".document-surface img")).toBeVisible();
  await page
    .getByRole("textbox", { name: /^Title/ })
    .fill("Our weekend pancakes");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes[1]).toMatchObject({
    expectedSha: "sha-1",
    targetPath: "apps/site/src/content/recipes/weekend-pancakes.md",
    payload: { slug: original.slug },
  });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", {
      name: "Delete published recipe Our weekend pancakes",
      exact: true,
    })
    .click();
  expect(state.deletions).toHaveLength(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: "Delete published recipe Our weekend pancakes",
      exact: true,
    })
    .click();
  await expect.poll(() => state.deletions.length).toBe(1);
  expect(state.deletions[0]).toMatchObject({
    expectedSha: "sha-2",
    path: "apps/site/src/content/recipes/weekend-pancakes.md",
  });
  await expect(
    page.getByRole("region", { name: "Publication status" }),
  ).toBeVisible();
});

test("unfinished recipes survive immediate section navigation and draft recovery", async ({
  page,
}) => {
  const state = await setup(page);
  await page
    .getByRole("textbox", { name: /^Title/ })
    .fill("Keep this recipe draft");
  await page.locator(".document-surface").fill("A pinch of saffron.");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect.poll(() => state.drafts.size).toBe(1);
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await page
    .locator(".document-list")
    .getByRole("button", { name: /Keep this recipe draft/ })
    .click();
  await expect(page.locator(".document-surface")).toContainText(
    "A pinch of saffron.",
  );
  expect(state.writes).toHaveLength(0);
  state.saveFailure = true;
  await page
    .getByRole("textbox", { name: /^Title/ })
    .fill("Keep this edit too");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue(
    "Keep this edit too",
  );
  await expect(page.getByText(/Could not save this draft/)).toBeVisible();
});

test("failed recipe loading blocks editing and can be retried", async ({
  page,
}) => {
  const state = await setup(page, false, true);
  await expect(page.getByText(/Recipes unavailable/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeDisabled();
  state.loadFailure = false;
  await page.getByRole("button", { name: /Retry/ }).click();
  await expect(page.getByRole("textbox", { name: /^Title/ })).toBeEnabled();
});

test("an unavailable private draft cannot be overwritten before recovery", async ({
  page,
}) => {
  const state = await setup(page, true);
  await page.getByRole("button", { name: "New", exact: true }).click();
  const saved = { ...original, title: "My unfinished pancake revision" };
  state.drafts.set(original.id, saved);
  state.draftLoadFailure = true;
  await page
    .locator(".document-list")
    .getByRole("button", { name: /Weekend pancakes/ })
    .click();
  await expect(page.getByText(/Draft unavailable/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Title/ })).toBeDisabled();
  await expect(page.locator(".document-surface")).toHaveAttribute(
    "contenteditable",
    "false",
  );
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Control+s");
  expect(state.drafts.get(original.id)).toEqual(saved);
  expect(state.writes).toHaveLength(0);
  state.draftLoadFailure = false;
  await page.getByRole("button", { name: /Retry/ }).click();
  await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue(
    saved.title,
  );
  await expect(page.getByRole("textbox", { name: /^Title/ })).toBeEnabled();
});

test("recipe publishing drains pending autosaves and freezes the exact reviewed snapshot", async ({
  page,
}) => {
  const state = await setup(page, true);
  state.holdSave = true;
  await page
    .getByLabel("Short description", { exact: true })
    .fill("Older queued save");
  await expect.poll(() => !!state.held).toBe(true);
  await page
    .getByLabel("Short description", { exact: true })
    .fill("Latest reviewed recipe");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("textbox", { name: /^Title/ })).toBeDisabled();
  await page.keyboard.press("Control+s");
  expect(state.writes).toHaveLength(0);
  const heldBody = state.held!.request().postDataJSON();
  state.drafts.set(heldBody.contentKey, heldBody.payload);
  await state.held!.fulfill({ json: { savedAt: new Date().toISOString() } });
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).toMatchObject({
    expectedSha: "original-sha",
    payload: { excerpt: "Latest reviewed recipe" },
  });
  await expect.poll(() => state.drafts.size).toBe(0);
  await expect(page.getByRole("textbox", { name: /^Title/ })).toBeEnabled();
});

for (const failure of ["saveFailure", "publishFailure"] as const) {
  test(`recipe ${failure} preserves edits and allows retry`, async ({
    page,
  }) => {
    const state = await setup(page, true);
    state[failure] = true;
    await page
      .getByLabel("Short description", { exact: true })
      .fill("Do not lose this recipe");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(
      page.getByText(
        failure === "saveFailure"
          ? /Could not save this draft/
          : /Recipe changed/,
      ),
    ).toBeVisible();
    await expect(
      page.getByLabel("Short description", { exact: true }),
    ).toHaveValue("Do not lose this recipe");
    await expect(
      page.getByLabel("Short description", { exact: true }),
    ).toBeEnabled();
    state[failure] = false;
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect.poll(() => state.drafts.size).toBe(0);
    expect(state.items[0]?.content.excerpt).toBe("Do not lose this recipe");
  });
}
