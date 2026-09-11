import { expect, test, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Post } from "@brendon/shared";
import type { PublishedItem } from "../../apps/admin/src/api";
import site from "../../apps/site/src/data/site.json";
import { sanitizePostBody } from "../../apps/admin/worker/index";

const gif = readFileSync("tests/fixtures/animated.gif");
const mediaPath = "/uploads/posts/gif-test/animated.gif";

async function expectAnimation(image: Locator) {
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBe(16);
  const firstFrame = await image.screenshot();
  // Compare the rendered image, not just its URL or MIME type: flattening must fail.
  await expect
    .poll(async () => (await image.screenshot()).equals(firstFrame), {
      timeout: 5000,
      intervals: [90, 130, 170],
    })
    .toBe(false);
}

for (const source of ["picker", "paste"] as const)
  test(`GIF stays animated after ${source}, preview, reopening and public rendering`, async ({
    page,
  }) => {
    let published: PublishedItem<Post> | undefined;
    let uploaded: Buffer | undefined;
    const drafts = new Map<string, unknown>();
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      let response: unknown = {};
      if (path === "/api/session")
        response = { authenticated: true, csrfToken: "test" };
      else if (path === "/api/published/homepage")
        response = {
          content: site,
          sha: "site",
          path: "apps/site/src/data/site.json",
        };
      else if (path === "/api/published/posts")
        response = { items: published ? [published] : [] };
      else if (path === "/api/published/projects") response = { items: [] };
      else if (path === "/api/drafts") {
        if (method === "PUT") {
          const body = route.request().postDataJSON();
          drafts.set(body.contentKey, body.payload);
          response = { savedAt: new Date().toISOString() };
        } else response = { drafts: [] };
      } else if (path.startsWith("/api/drafts/post/")) {
        const key = path.split("/").pop()!;
        if (method === "DELETE") drafts.delete(key);
        response = { draft: drafts.get(key) ?? null };
      } else if (path.startsWith("/api/publish/media/posts/")) {
        uploaded = route.request().postDataBuffer()!;
        response = {
          path: mediaPath,
          alt: "Alternating red and blue",
          commitUrl: "https://github.test/image",
        };
      } else if (path === "/api/publish") {
        const body = route.request().postDataJSON();
        published = {
          content: {
            ...body.payload,
            publishedAt: "2026-09-07T23:00:00-05:00",
          },
          path: "apps/site/src/content/posts/gif-test.md",
          sha: "published-sha",
        };
        response = {
          ...published,
          publishedAt: published.content.publishedAt,
          contentSha: published.sha,
          version: "a".repeat(40),
          commitUrl: "https://github.test/commit",
        };
      }
      await route.fulfill({ json: response });
    });
    await page.route(`**${mediaPath}`, (route) =>
      route.fulfill({ contentType: "image/gif", body: gif }),
    );
    await page.goto(process.env.ADMIN_TEST_URL || "http://127.0.0.1:5173/");
    await page.getByRole("button", { name: "Blog", exact: true }).click();
    await page.getByRole("textbox", { name: /^Title/ }).fill("GIF test");
    await page.locator(".document-surface").fill("An animated image.");
    const picker = page.locator('input[type="file"][accept^="image/"]');
    await expect(picker).toHaveAttribute("accept", /image\/gif/);
    page.once("dialog", (dialog) => dialog.accept("Alternating red and blue"));
    if (source === "picker") {
      await picker.setInputFiles({
        name: "animated.gif",
        mimeType: "image/gif",
        buffer: gif,
      });
    } else {
      await page.locator(".document-surface").evaluate((element, bytes) => {
        const data = new DataTransfer();
        data.items.add(
          new File([Uint8Array.from(bytes)], "animated.gif", {
            type: "image/gif",
          }),
        );
        data.setData(
          "text/html",
          '<img src="https://example.test/duplicate.gif">',
        );
        element.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData: data,
            bubbles: true,
            cancelable: true,
          }),
        );
      }, Array.from(gif));
    }
    const image = page.locator(".document-surface img");
    await expectAnimation(image);
    expect(uploaded!.includes(gif)).toBe(true);
    expect(uploaded!.toString("latin1")).toContain('filename="animated.gif"');
    expect(uploaded!.toString("latin1")).toContain("Content-Type: image/gif");
    await expect(image).toHaveAttribute("data-cms-path", mediaPath);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expectAnimation(page.locator(".preview-canvas img"));
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect.poll(() => published?.content.body).toContain(mediaPath);
    expect(published.content.body).not.toContain("blob:");

    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page.getByRole("button", { name: "Blog", exact: true }).click();
    await page.getByRole("button", { name: /GIF test Published/ }).click();
    await expectAnimation(page.locator(".document-surface img"));

    // Render the sanitized published body in an actual Astro article response.
    // The fixture stays in the test browser; no test post is written to the repository.
    await page.route("**/blog/2026/09/03/i/", async (route) => {
      const response = await route.fetch();
      const original = await response.text();
      const html = original.replace(
        /(<div class="prose">)[\s\S]*?(<\/div>\s*<\/article>)/,
        `$1${sanitizePostBody(published.content.body)}$2`,
      );
      expect(html).toContain(mediaPath);
      await route.fulfill({ response, body: html });
    });
    await page.goto("http://127.0.0.1:4321/blog/2026/09/03/i/");
    await expectAnimation(page.locator("article.post .prose img"));
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAnimation(page.locator("article.post .prose img"));
  });
