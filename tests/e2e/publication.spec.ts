import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import site from "../../apps/site/src/data/site.json";

test("new posts receive server time, then preserve it or allow corrections when reopened", async ({
  page,
}) => {
  let published: any;
  const requests: any[] = [];
  const drafts = new Map<string, unknown>();
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let response: unknown = {};
    if (pathname === "/api/session")
      response = { authenticated: true, csrfToken: "test" };
    else if (pathname === "/api/published/homepage")
      response = {
        content: site,
        sha: "site",
        path: "apps/site/src/data/site.json",
      };
    else if (pathname === "/api/published/posts")
      response = { items: published ? [published] : [] };
    else if (pathname === "/api/published/projects") response = { items: [] };
    else if (pathname === "/api/drafts") {
      if (method === "PUT") {
        const body = route.request().postDataJSON();
        drafts.set(body.contentKey, body.payload);
        response = { savedAt: new Date().toISOString() };
      } else response = { drafts: [] };
    } else if (pathname.startsWith("/api/drafts/post/")) {
      const key = pathname.split("/").pop()!;
      if (method === "DELETE") drafts.delete(key);
      response = { draft: drafts.get(key) ?? null };
    } else if (pathname === "/api/publish") {
      const body = route.request().postDataJSON();
      requests.push(body);
      const publishedAt = published
        ? body.payload.publishedAt
        : "2026-09-07T22:45:19-05:00";
      published = {
        content: { ...body.payload, publishedAt },
        path: "apps/site/src/content/posts/2026-09-07-timed-post.md",
        sha: `sha-${requests.length}`,
      };
      response = {
        publishedAt,
        path: published.path,
        contentSha: published.sha,
        version: "a".repeat(40),
        commitUrl: "https://github.test/commit",
      };
    }
    await route.fulfill({ json: response });
  });
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Blog", exact: true }).click();
  await expect(
    page.getByText(/Set automatically when you publish/),
  ).toBeVisible();
  await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);
  await page.getByRole("textbox", { name: /^Title/ }).fill("Timed post");
  await page
    .locator(".document-surface")
    .fill("Publication time should survive later edits.");
  const publish = page.getByRole("button", { name: "Publish", exact: true });
  await publish.click();
  const time = page.getByLabel("Publication date and time", { exact: true });
  await expect(time).toHaveValue("2026-09-07T22:45:19");
  await expect(publish).toBeEnabled();
  expect(requests[0].targetPath).toBeUndefined();

  // Reopen the saved post through a fresh CMS component and published API read.
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Blog", exact: true }).click();
  await page.getByRole("button", { name: /Timed post Published/ }).click();
  await expect(time).toHaveValue("2026-09-07T22:45:19");
  await page.getByLabel("Excerpt", { exact: true }).fill("A later copy edit.");
  await publish.click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].payload.publishedAt).toBe("2026-09-07T22:45:19-05:00");
  expect(requests[1].expectedSha).toBe("sha-1");
  await expect(publish).toBeEnabled();

  await time.fill("2026-09-07T23:11:22");
  await publish.click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2].payload.publishedAt).toBe("2026-09-07T23:11:22-05:00");
  await expect(time).toHaveValue("2026-09-07T23:11:22");
  await page.screenshot({
    path: "test-results/publication-editor.png",
    fullPage: true,
  });
});

test("homepage, archives, adjacent posts and RSS follow precise publication order", async ({
  page,
  request,
}) => {
  const directory = "apps/site/src/content/posts";
  const posts = readdirSync(directory)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const text = readFileSync(`${directory}/${file}`, "utf8");
      const field = (key: string) =>
        text.match(new RegExp(`^${key}: (.+)$`, "m"))![1].replace(/^"|"$/g, "");
      return {
        title: field("title"),
        date: field("publishedAt"),
        slug: field("slug"),
      };
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const latest = posts[0];
  const latestUrl = `/blog/${latest.date.slice(0, 10).replaceAll("-", "/")}/${latest.slug}/`;
  await page.goto("http://127.0.0.1:4321/");
  await expect(page.locator(".latest-note h2")).toHaveText(latest.title);
  await expect(page.locator(".latest-note time")).toHaveAttribute(
    "datetime",
    latest.date,
  );
  await expect(page.locator(".latest-note h2 a")).toHaveAttribute(
    "href",
    latestUrl,
  );
  await page.screenshot({
    path: "test-results/publication-home.png",
    fullPage: true,
  });
  for (const route of ["blog", "notes"]) {
    await page.goto(`http://127.0.0.1:4321/${route}/`);
    await expect(page.locator(".archive-row h3")).toHaveText(
      posts.map((post) => post.title),
    );
  }
  await page.goto(`http://127.0.0.1:4321${latestUrl}`);
  await expect(page.locator("article.post time")).toHaveAttribute(
    "datetime",
    latest.date,
  );
  if (posts.length > 1)
    await expect(page.locator(".post-nav")).toContainText(posts[1].title);
  const feed = await (
    await request.get("http://127.0.0.1:4321/rss.xml")
  ).text();
  expect(feed).toContain(new Date(latest.date).toUTCString());
  expect(feed.indexOf(latest.title)).toBeLessThan(feed.indexOf(posts[1].title));
});
