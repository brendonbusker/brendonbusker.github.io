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
  await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
  expect(await page.content()).not.toContain("ADMIN_PASSWORD");
});
test("authenticated admin shell exposes publishing sections", async ({
  page,
}) => {
  const publishedPost = {
    schemaVersion: 1,
    id: "f3ca8746-060e-4f5f-a70a-776075596c4c",
    title: "Building a place for the work between projects",
    slug: "starting-this-site",
    publishedAt: "2026-08-31",
    updatedAt: "2026-08-31",
    excerpt: "A personal site should have room for the process.",
    body: "This is the complete historical post body.",
    status: "published",
  };
  const publishedProject = {
    schemaVersion: 1,
    id: "932feeb1-05a7-41a4-bcab-6c6da8e6c76d",
    title: "Shiny Hunt Tracker",
    slug: "shiny-hunt-tracker",
    summary: "Track multiple Pokémon shiny hunts.",
    category: "Web application",
    status: "Live",
    featured: true,
    published: true,
    sortOrder: 2,
    liveUrl: "https://brendonbusker.github.io/shiny-hunt-tracker/",
    githubUrl: "https://github.com/brendonbusker/shiny-hunt-tracker",
    icon: "sparkles",
    accent: "#9a6a22",
    techStack: ["React", "TypeScript"],
    screenshots: [
      {
        src: "/uploads/projects/shiny-hunt-tracker/cover.webp",
        alt: "Shiny Hunt Tracker dashboard",
      },
    ],
    overview: "A local-first shiny hunting dashboard.",
    why: "Long hunts span many sessions.",
    features: ["Multiple simultaneous hunts"],
    implementation: "React with IndexedDB.",
    createdAt: "2026-08-31",
    updatedAt: "2026-09-01",
  };
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
  await page.route("**/api/drafts", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ drafts: [] }),
    }),
  );
  await page.route("**/api/published/posts", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            content: publishedPost,
            path: "apps/site/src/content/posts/starting-this-site.md",
            sha: "post-sha",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/published/projects", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            content: publishedProject,
            path: "apps/site/src/content/projects/shiny-hunt-tracker.md",
            sha: "project-sha",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/publish/media/posts/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        path: "/uploads/posts/starting-this-site/test-image.webp",
        alt: "A test editor image",
      }),
    }),
  );
  await page.goto("http://127.0.0.1:5173/");
  await expect(
    page.getByRole("complementary", { name: "Publishing sections" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Blog" }).click();
  await expect(page.getByText("Start writing…")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: /Building a place for the work between projects/,
    })
    .click();
  await expect(
    page.getByText("This is the complete historical post body."),
  ).toBeVisible();
  const writingSurface = page.locator(".document-surface");
  await writingSurface.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Fast typing stays put.", { delay: 5 });
  await page.waitForTimeout(1500);
  await expect(writingSurface).toContainText("Fast typing stays put.");
  await expect(page.getByText("Clipboard", { exact: true })).toBeVisible();
  await expect(page.getByText("Font", { exact: true })).toBeVisible();
  await expect(
    page.locator(".toolbar-group > span", { hasText: "Paragraph" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Insert" }).click();
  page.once("dialog", (dialog) => dialog.accept("A test editor image"));
  await page.locator('input[type="file"][accept^="image/"]').setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const insertedImage = writingSurface.getByRole("img", {
    name: "A test editor image",
  });
  await expect(insertedImage).toBeVisible();
  await expect(insertedImage).toHaveAttribute(
    "data-cms-path",
    "/uploads/posts/starting-this-site/test-image.webp",
  );
  await insertedImage.click();
  await expect(writingSurface.locator("[data-resize-handle]")).toHaveCount(6);
  await page
    .getByRole("complementary", { name: "Publishing sections" })
    .getByRole("button", { name: "Projects", exact: true })
    .click();
  const projectPicker = page.getByLabel("Choose a project to edit");
  await projectPicker.selectOption("shiny-hunt-tracker");
  await expect(
    page.getByRole("heading", { name: "Shiny Hunt Tracker" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.locator(".project-preview-cover")).toHaveAttribute(
    "src",
    "/uploads/projects/shiny-hunt-tracker/cover.webp",
  );
});
