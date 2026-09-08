import { expect, test } from "@playwright/test";
import site from "../../apps/site/src/data/site.json";
import blogPage from "../../apps/site/src/data/blog-page.json";

test("Blog introduction loads, previews, publishes and reopens without losing the active post", async ({
  page,
}) => {
  let published = { ...blogPage, headline: "Current published headline" };
  let sha = "original-sha";
  const writes: Array<{
    contentType: string;
    payload: typeof blogPage;
    expectedSha: string;
  }> = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = {};
    if (path === "/api/session")
      response = { authenticated: true, csrfToken: "test" };
    else if (path === "/api/published/homepage")
      response = {
        content: site,
        sha: "site",
        path: "apps/site/src/data/site.json",
      };
    else if (path === "/api/published/blog-page")
      response = {
        content: published,
        sha,
        path: "apps/site/src/data/blog-page.json",
      };
    else if (
      path === "/api/published/posts" ||
      path === "/api/published/projects"
    )
      response = { items: [] };
    else if (path === "/api/drafts")
      response = { drafts: [], savedAt: new Date().toISOString() };
    else if (path.startsWith("/api/drafts/")) response = { draft: null };
    else if (path === "/api/publish") {
      const body = route.request().postDataJSON();
      writes.push(body);
      published = body.payload;
      sha = "new-sha";
      response = {
        path: "apps/site/src/data/blog-page.json",
        contentSha: sha,
        version: "a".repeat(40),
        commitUrl: "https://github.test/commit",
      };
    }
    await route.fulfill({ json: response });
  });
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Blog", exact: true }).click();
  await page.getByRole("textbox", { name: /^Title/ }).fill("Keep my draft");
  await page
    .locator(".document-surface")
    .fill("Do not lose this unfinished post.");
  await page.getByRole("button", { name: "Edit page introduction" }).click();
  await expect(
    page.getByRole("heading", { name: "Blog page introduction", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Headline")).toHaveValue(
    "Current published headline",
  );
  const publish = page.getByRole("button", { name: "Publish introduction" });
  await expect(publish).toBeDisabled();
  await page.getByLabel("Headline").fill("");
  await expect(publish).toBeDisabled();
  await page.getByLabel("Eyebrow").fill("Personal journal");
  await page.getByLabel("Headline").fill("Things I want to write about.");
  await page
    .getByLabel("Supporting description")
    .fill("Stories, projects, and everyday thoughts.");
  await expect(page.getByLabel("Blog page introduction preview")).toContainText(
    "Things I want to write about.",
  );
  await publish.click();
  await expect(page.getByRole("status")).toContainText(
    "Blog page introduction published.",
  );
  expect(writes).toEqual([
    {
      contentType: "blogPage",
      payload: {
        schemaVersion: 1,
        eyebrow: "Personal journal",
        headline: "Things I want to write about.",
        description: "Stories, projects, and everyday thoughts.",
      },
      expectedSha: "original-sha",
    },
  ]);
  await page.screenshot({
    path: "test-results/blog-page-editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Back to blog" }).click();
  await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue(
    "Keep my draft",
  );
  await expect(page.locator(".document-surface")).toContainText(
    "Do not lose this unfinished post.",
  );
  await page.getByRole("button", { name: "Edit page introduction" }).click();
  await expect(page.getByLabel("Headline")).toHaveValue(published.headline);
  await page.getByRole("button", { name: "Back to blog" }).click();
  await page.route("**/api/published/blog-page", (route) =>
    route.fulfill({
      status: 502,
      json: { error: "Could not load introduction." },
    }),
  );
  await page.getByRole("button", { name: "Edit page introduction" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Could not load introduction.",
  );
  await expect(publish).toBeDisabled();
  await expect(page.getByLabel("Headline")).toHaveCount(0);
});

test("both archive routes render the published Blog introduction", async ({
  page,
}) => {
  for (const route of ["blog", "notes"]) {
    await page.goto(`http://127.0.0.1:4321/${route}/`);
    await expect(page.locator(".page-intro .eyebrow")).toHaveText(
      blogPage.eyebrow,
    );
    await expect(page.locator(".page-intro h1")).toHaveText(blogPage.headline);
    await expect(page.locator(".page-intro > p").last()).toHaveText(
      blogPage.description,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      blogPage.description,
    );
  }
});
