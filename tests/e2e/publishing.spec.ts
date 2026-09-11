import { dashboardFixture } from "../fixtures/dashboard";
import { test, expect } from "@playwright/test";
import blogPage from "../../apps/site/src/data/blog-page.json";
import site from "../../apps/site/src/data/site.json";

for (const scenario of [
  "temporary",
  "persistent",
  "expired session",
] as const) {
  test(`status checks recover safely from ${scenario} errors`, async ({
    page,
  }) => {
    let checks = 0;
    let recovered = false;
    await page.addInitScript(() =>
      localStorage.setItem(
        "cms-latest-publication",
        JSON.stringify({
          id: "published",
          version: "a".repeat(40),
          publicUrl: "https://brendonbusker.github.io/",
          state: "waiting",
        }),
      ),
    );
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/dashboard") {
        await route.fulfill({ json: dashboardFixture });
        return;
      }
      if (path === "/api/session") {
        await route.fulfill({
          json: { authenticated: true, csrfToken: "test" },
        });
      } else if (path.startsWith("/api/deployment/")) {
        checks++;
        if (recovered || (scenario === "temporary" && checks > 2)) {
          await route.fulfill({
            json: {
              state: "live",
              message: "Your changes are live on the website.",
            },
          });
        } else if (scenario === "expired session") {
          await route.fulfill({
            status: 401,
            json: { error: "Your session has expired. Sign in again." },
          });
        } else if (scenario === "temporary" && checks === 2) {
          await route.fulfill({
            status: 503,
            json: { error: "Temporarily unavailable." },
          });
        } else await route.abort("failed");
      } else throw new Error(`Unexpected request: ${path}`);
    });
    await page.clock.install();
    await page.goto("http://127.0.0.1:5173/");
    const banner = page.getByRole("region", { name: "Publication status" });
    if (scenario === "expired session") {
      await expect(banner).toContainText("Your session has expired");
      await page.clock.fastForward(60001);
      expect(checks).toBe(1);
      return;
    }
    await expect(banner).toContainText("Rechecking status");
    await expect(banner).not.toContainText("NetworkError");
    await page.clock.fastForward(5001);
    await expect.poll(() => checks).toBe(2);
    await expect(banner).toContainText("Rechecking status");
    await page.clock.fastForward(15001);
    if (scenario === "temporary") {
      await expect(banner).toContainText("Your changes are live");
      await page.clock.fastForward(60001);
      expect(checks).toBe(3);
    } else {
      await expect.poll(() => checks).toBe(3);
      await expect(banner).toContainText("Rechecking status");
      await page.clock.fastForward(30001);
      await expect(banner).toContainText("Status unavailable");
      await page.clock.fastForward(60001);
      expect(checks).toBe(4);
      recovered = true;
      await banner.getByRole("button", { name: "Check again" }).click();
      await expect(banner).toContainText("Your changes are live");
      expect(checks).toBe(5);
    }
  });
}

test("publication status follows a publish across navigation, refresh, failure and recovery", async ({
  page,
}) => {
  let state = "waiting";
  let unavailable = false;
  let releasePublish: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    releasePublish = resolve;
  });
  let writes = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/dashboard") {
      await route.fulfill({ json: dashboardFixture });
      return;
    }
    let response: unknown = {};
    if (path === "/api/session")
      response = { authenticated: true, csrfToken: "test" };
    else if (path === "/api/published/blog-page")
      response = {
        content: blogPage,
        sha: "original",
        path: "apps/site/src/data/blog-page.json",
      };
    else if (path === "/api/published/homepage")
      response = { content: site, sha: "site" };
    else if (path.startsWith("/api/published/")) response = { items: [] };
    else if (path === "/api/drafts")
      response = { drafts: [], savedAt: new Date().toISOString() };
    else if (path.startsWith("/api/drafts/")) response = { draft: null };
    else if (path === "/api/publish") {
      writes++;
      await gate;
      response = {
        version: "a".repeat(40),
        contentSha: "updated",
        publicUrl: "https://brendonbusker.github.io/blog/",
        commitUrl: "https://github.com/test",
        path: "apps/site/src/data/blog-page.json",
      };
    } else if (path.startsWith("/api/deployment/")) {
      if (unavailable) {
        await route.fulfill({
          status: 503,
          json: { error: "Cannot check deployment right now." },
        });
        return;
      }
      response = {
        state,
        message: `Deployment is ${state}.`,
        detailsUrl:
          "https://github.com/brendonbusker/brendonbusker.github.io/actions/runs/123",
      };
    }
    await route.fulfill({ json: response });
  });
  await page.clock.install();
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Blog", exact: true }).click();
  await page.getByRole("button", { name: "Edit page introduction" }).click();
  await page.getByLabel("Headline").fill("Preview publish status");
  await page.getByRole("button", { name: "Publish introduction" }).click();
  const banner = page.getByRole("region", { name: "Publication status" });
  await expect(banner).toContainText("Sending your changes");
  releasePublish();
  await expect(banner).toContainText("Waiting for build");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(banner).toBeVisible();
  state = "building";
  await page.clock.fastForward(30001);
  await expect(banner).toContainText("Deployment is building.");
  await page.reload();
  await expect(banner).toContainText("Deployment is building.");
  unavailable = true;
  await page.reload();
  await expect(banner).toContainText("Rechecking status");
  unavailable = false;
  state = "failed";
  await page.clock.fastForward(5001);
  await expect(banner).toContainText("Needs attention");
  await expect(
    banner.getByRole("link", { name: /View published/ }),
  ).toHaveCount(0);
  state = "live";
  await banner.getByRole("button", { name: "Check again" }).click();
  await expect(
    banner.getByRole("link", { name: /View published/ }),
  ).toHaveAttribute("href", "https://brendonbusker.github.io/blog/");
  expect(writes).toBe(1);
  await page.screenshot({
    path: "test-results/publishing-status.png",
    fullPage: true,
  });
  await banner.getByRole("button", { name: "Dismiss" }).click();
  await page.reload();
  await expect(banner).toHaveCount(0);
});
