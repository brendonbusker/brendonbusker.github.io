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
  let deleteRequest: Record<string, string> | undefined;
  let savedPostBody = "";
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
  await page.route("**/api/drafts", (route) => {
    if (route.request().method() === "PUT") {
      const saved = route.request().postDataJSON() as {
        payload?: { body?: string };
      };
      savedPostBody = saved.payload?.body || "";
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ savedAt: new Date().toISOString() }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ drafts: [] }),
    });
  });
  await page.route("**/api/published/posts", (route) => {
    if (route.request().method() === "DELETE") {
      deleteRequest = route.request().postDataJSON() as Record<string, string>;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          commitUrl: "https://github.test/commit",
          version: "b".repeat(40),
        }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            content: publishedPost,
            path: "apps/site/src/content/posts/starting-this-site.md",
            sha: "a".repeat(40),
          },
        ],
      }),
    });
  });
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
  await expect(
    page.locator(".toolbar-group > span", { hasText: "Insert" }),
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
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
  await expect(writingSurface.locator("[data-resize-handle]")).toHaveCount(6);
  const imageWrapping = page.getByLabel("Image text wrapping");
  await expect(imageWrapping).toBeEnabled();
  await imageWrapping.selectOption("left");
  await expect(insertedImage).toHaveAttribute("data-layout", "left");
  await expect
    .poll(() =>
      insertedImage.evaluate((image) => {
        const container = image.closest("[data-resize-container]");
        return container ? getComputedStyle(container).float : "";
      }),
    )
    .toBe("left");
  await imageWrapping.selectOption("behind");
  await expect(insertedImage).toHaveAttribute("data-layout", "behind");
  await expect
    .poll(() =>
      insertedImage.evaluate((image) => {
        const container = image.closest("[data-resize-container]");
        return container ? getComputedStyle(container).position : "";
      }),
    )
    .toBe("absolute");
  await expect.poll(() => savedPostBody).toContain('data-layout="behind"');
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: "Delete published post Building a place for the work between projects",
    })
    .click();
  await expect(
    page.getByText("Published post deleted.", { exact: false }),
  ).toBeVisible();
  expect(deleteRequest).toMatchObject({
    path: "apps/site/src/content/posts/starting-this-site.md",
    expectedSha: "a".repeat(40),
    contentKey: publishedPost.id,
  });
  await expect(
    page.getByRole("button", {
      name: /Building a place for the work between projects/,
    }),
  ).toHaveCount(0);
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
  await page
    .getByRole("complementary", { name: "Publishing sections" })
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Choose your atmosphere" }),
  ).toBeVisible();
  await expect(page.locator(".theme-card")).toHaveCount(13);
  await expect(page.locator("html")).toHaveAttribute(
    "data-admin-theme",
    "light",
  );
  await page.getByRole("button", { name: "Use Hacker theme" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-admin-theme",
    "hacker",
  );
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("brendon-publishing-theme")),
    )
    .toBe("hacker");
  await expect(page.locator(".workspace")).toHaveCSS(
    "background-color",
    "rgb(2, 5, 3)",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-admin-theme",
    "hacker",
  );
});
