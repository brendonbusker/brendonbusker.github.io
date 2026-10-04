import { expect, test } from "@playwright/test";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rm,
  symlink,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { resolve, extname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import type { Recipe } from "@brendon/shared";
import { serializeContent } from "../../apps/admin/worker/index";

// Exercise the real Astro source and serializer in an isolated project. Fixtures,
// build caches and generated content never enter the normal site checkout, even
// if the test worker is interrupted before teardown can run.
let server: Server | undefined;
let projectRoot: string | undefined;
let publicUrl = "";
const siteRoot = resolve("apps/site");
const output = resolve("tmp/recipe-e2e-site");
const prefix = "qa-recipe-";
const base: Recipe = {
  schemaVersion: 1,
  id: randomUUID(),
  title: "Crème pancakes",
  slug: `${prefix}pancakes`,
  publishedAt: "2026-10-04T12:00:00-05:00",
  updatedAt: "2026-10-04T17:00:00Z",
  status: "published",
  excerpt: "A weekend favorite.",
  meals: ["breakfast", "snack"],
  prepMinutes: 10,
  cookMinutes: 15,
  servings: "4 people",
  body: '<h2>Ingredients</h2><ul><li>Cardamom</li><li>Milk</li></ul><h2>Instructions</h2><p>Whisk, then cook.</p><img src="/uploads/recipes/qa-recipe-pancakes/animated.gif" alt="Cooking pancakes" data-layout="block">',
};
const recipes: Recipe[] = [
  base,
  {
    ...base,
    id: randomUUID(),
    title: "Lemon soup",
    slug: `${prefix}soup`,
    meals: ["lunch", "dinner"],
    prepMinutes: undefined,
    cookMinutes: undefined,
    servings: "",
    body: "<p>Simmer chickpeas and lemon.</p>",
  },
  {
    ...base,
    id: randomUUID(),
    title: "Private saffron secret",
    slug: `${prefix}private`,
    status: "draft",
    body: "<p>DO-NOT-INDEX-THIS-PRIVATE-RECIPE</p>",
  },
  ...Array.from({ length: 120 }, (_, index): Recipe => ({
    ...base,
    id: randomUUID(),
    title: `Collection recipe ${String(index).padStart(3, "0")}`,
    slug: `${prefix}collection-${index}`,
    meals: ["dinner"],
    body: `<p>Tomatoes and parsley. Collection marker ${index}.</p>`,
  })),
];

test.beforeAll(async () => {
  test.setTimeout(60_000);
  await mkdir("tmp", { recursive: true });
  projectRoot = await mkdtemp(resolve("tmp/recipe-e2e-project-"));
  try {
    await cp(siteRoot, projectRoot, {
      recursive: true,
      filter: (source) => {
        const name = basename(source);
        return (
          !["node_modules", "dist", ".astro"].includes(name) &&
          !name.startsWith(".env")
        );
      },
    });
    await symlink(
      resolve(siteRoot, "node_modules"),
      resolve(projectRoot, "node_modules"),
      "junction",
    );
    // Share installed packages, but never their Astro/Vite content caches.
    await writeFile(
      resolve(projectRoot, "astro.config.mjs"),
      `import sourceConfig from ${JSON.stringify(pathToFileURL(resolve(siteRoot, "astro.config.mjs")).href)};
export default { ...sourceConfig, cacheDir: './.astro-cache', vite: { ...sourceConfig.vite, cacheDir: './.vite-cache' } };
`,
    );
    const fixtureDirectory = resolve(projectRoot, "src/content/recipes");
    await rm(fixtureDirectory, { recursive: true, force: true });
    await mkdir(fixtureDirectory, { recursive: true });
    for (const recipe of recipes) {
      const serialized = serializeContent("recipe", recipe);
      // The publish serializer deliberately forces published status. A separate
      // source-only draft fixture verifies the site's published-only boundary.
      const markdown =
        recipe.status === "draft"
          ? serialized.content.replace(/^status: published$/m, "status: draft")
          : serialized.content;
      await writeFile(
        resolve(fixtureDirectory, `${recipe.slug}.md`),
        markdown,
        { flag: "wx" },
      );
    }
    execFileSync(
      "pnpm",
      [
        "--filter",
        "@brendon/site",
        "exec",
        "astro",
        "build",
        "--force",
        "--root",
        projectRoot,
        "--outDir",
        output,
      ],
      { timeout: 45_000, stdio: "pipe" },
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
    projectRoot = undefined;
  }
  const mime: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url || "/", "http://localhost").pathname;
    const path = resolve(
      output,
      `.${pathname}${pathname.endsWith("/") ? "index.html" : ""}`,
    );
    if (!path.startsWith(`${output}/`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      response.setHeader(
        "Content-Type",
        mime[extname(path)] || "application/octet-stream",
      );
      response.end(await readFile(path));
    } catch {
      response
        .writeHead(404, { "Content-Type": "text/html" })
        .end(await readFile(resolve(output, "404.html")));
    }
  });
  await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Recipe fixture server did not start");
  publicUrl = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  if (projectRoot) await rm(projectRoot, { recursive: true, force: true });
  if (server)
    await new Promise<void>((done, reject) =>
      server!.close((error) => (error ? reject(error) : done())),
    );
});

test("recipe search handles a large collection, all body words, accents, meal filters and browser history", async ({
  page,
}) => {
  await expect
    .poll(async () => {
      await page.goto(`${publicUrl}/recipes/`);
      return page.locator(".recipe-entry").count();
    })
    .toBe(122);
  await expect(
    page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Recipes", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(await page.content()).not.toContain(
    "DO-NOT-INDEX-THIS-PRIVATE-RECIPE",
  );
  expect(await page.content()).not.toContain("Private saffron secret");
  const input = page.getByRole("searchbox", { name: "Find a recipe" });
  await input.fill("CREME cardamom!");
  await expect(page.locator(".recipe-entry:visible")).toHaveCount(1);
  await expect(page.locator("[data-recipe-status]")).toHaveText(
    "1 recipe found",
  );
  await expect(page).toHaveURL(/q=CREME\+cardamom/);
  await page.getByRole("button", { name: "Dinner", exact: true }).click();
  await expect(page.locator("[data-recipe-empty]")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".recipe-entry:visible")).toHaveCount(1);
  await page.getByRole("button", { name: "Snack", exact: true }).click();
  await expect(page.locator(".recipe-entry:visible")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Snack", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(input).toHaveValue("CREME cardamom!");
  await expect(page.locator(".recipe-entry:visible")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.locator(".recipe-entry:visible")).toHaveCount(122);
  await expect(input).toBeFocused();
  await page.getByRole("button", { name: "Lunch", exact: true }).click();
  await expect(page.locator(".recipe-entry:visible")).toHaveCount(1);
  await expect(page.locator(".recipe-entry:visible")).toContainText(
    "Lemon soup",
  );
});

test("recipe detail renders structured facts, rich text, GIFs and print layout without blog dates", async ({
  page,
}) => {
  await page.route(
    "**/uploads/recipes/qa-recipe-pancakes/animated.gif",
    (route) =>
      route.fulfill({
        contentType: "image/gif",
        path: "tests/fixtures/animated.gif",
      }),
  );
  await page.goto(`${publicUrl}/recipes/${base.slug}/`);
  await expect(
    page.getByRole("heading", { name: base.title, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".recipe-facts")).toContainText("25 min");
  await expect(page.locator(".recipe-facts")).toContainText("4 people");
  await expect(
    page.getByRole("heading", { name: "Ingredients", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".recipe-body li")).toHaveCount(2);
  await expect(page.locator(".recipe-document time")).toHaveCount(0);
  const image = page.getByRole("img", {
    name: "Cooking pancakes",
    exact: true,
  });
  await expect(image).toBeVisible();
  const firstFrame = await image.screenshot();
  await expect
    .poll(async () => (await image.screenshot()).equals(firstFrame), {
      intervals: [90, 130, 170],
    })
    .toBe(false);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".site-header")).toBeHidden();
  await expect(page.locator("[data-print-recipe]")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Instructions", exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await page.goto(`${publicUrl}/recipes/${prefix}soup/`);
  await expect(page.locator(".recipe-facts")).toHaveCount(0);
  const response = await page.goto(`${publicUrl}/recipes/${prefix}private/`);
  expect(response?.status()).toBe(404);
});

test("the recipe collection remains readable without JavaScript and mobile navigation fits", async ({
  browser,
  page,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const withoutJs = await context.newPage();
  await withoutJs.goto(`${publicUrl}/recipes/?meal=snack&q=cardamom`);
  await expect(withoutJs.locator(".recipe-entry:visible")).toHaveCount(122);
  await expect(withoutJs.getByRole("search", { name: "Recipes" })).toBeHidden();
  await context.close();
  await page.setViewportSize({ width: 320, height: 740 });
  for (const route of ["/", "/recipes/", `/recipes/${base.slug}/`]) {
    await page.goto(`${publicUrl}${route}`);
    await expect(
      page
        .getByRole("navigation", { name: "Primary navigation" })
        .getByRole("link", { name: "Recipes", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
});

test("recipe pages inherit all thirteen readable themes", async ({ page }) => {
  for (const route of ["/recipes/", `/recipes/${base.slug}/`]) {
    await page.goto(`${publicUrl}${route}`);
    for (const theme of [
      "light",
      "dark",
      "midnight",
      "hacker",
      "dracula",
      "nord",
      "solarized",
      "ocean",
      "sakura",
      "espresso",
      "synthwave",
      "amber",
      "blueprint",
    ]) {
      const result = await page.locator("html").evaluate((root, next) => {
        root.dataset.theme = next;
        const style = getComputedStyle(document.body);
        const luminance = (value: string) => {
          const channels = (value.match(/[\d.]+/g) || [])
            .slice(0, 3)
            .map(Number)
            .map((channel) => {
              const n = channel / 255;
              return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
            });
          return (
            0.2126 * channels[0]! +
            0.7152 * channels[1]! +
            0.0722 * channels[2]!
          );
        };
        const a = luminance(style.color),
          b = luminance(style.backgroundColor);
        return {
          contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          overflow: root.scrollWidth - innerWidth,
        };
      }, theme);
      expect(result.contrast, `${theme} contrast on ${route}`).toBeGreaterThan(
        4.5,
      );
      expect(
        result.overflow,
        `${theme} overflow on ${route}`,
      ).toBeLessThanOrEqual(1);
    }
  }
});
