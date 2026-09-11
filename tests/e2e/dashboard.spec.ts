import { expect, test } from "@playwright/test";
const adminUrl = process.env.ADMIN_TEST_URL || "http://127.0.0.1:5173/";
const current = {
  fullName: "Brendon Busker",
  timezone: "CST",
  latestPost: { title: "My Admin Page" },
  projectCount: 3,
  webUpdatedAt: "2026-09-10T23:47:00Z",
  pdfUpdatedAt: "2026-09-11T00:05:00Z",
};

test("dashboard loads current content, formats Central dates and refreshes when returning Home", async ({
  page,
}) => {
  let latest = "My Admin Page";
  await page.clock.install({ time: new Date("2026-09-11T01:00:00Z") });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        path === "/api/session"
          ? { authenticated: true }
          : path === "/api/dashboard"
            ? { ...current, latestPost: { title: latest } }
            : path === "/api/published/posts"
              ? { items: [] }
              : path === "/api/drafts"
                ? { drafts: [] }
                : {},
    });
  });
  await page.goto(adminUrl);
  const dashboard = page.locator(".dashboard");
  await expect(
    dashboard.getByRole("heading", { name: "Good evening, Brendon." }),
  ).toBeVisible();
  await expect(dashboard.locator(".page-label")).toHaveText(
    "Thursday, September 10",
  );
  await expect(dashboard).toContainText("My Admin Page");
  await expect(dashboard).toContainText("3 published");
  await expect(
    dashboard.locator("dd", { hasText: "Updated September 10, 2026" }),
  ).toHaveCount(2);
  await expect(dashboard).not.toContainText("August 31");
  await page.getByRole("button", { name: "Blog", exact: true }).click();
  await expect(page.locator(".post-editor")).toBeVisible();
  latest = "A newer post";
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(dashboard).toContainText("A newer post");
  await page.clock.setSystemTime(new Date("2026-09-11T13:00:00Z"));
  await page.clock.fastForward(60001);
  await expect(
    dashboard.getByRole("heading", { name: "Good morning, Brendon." }),
  ).toBeVisible();
  await expect(dashboard.locator(".page-label")).toHaveText(
    "Friday, September 11",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("failed dashboard reads offer retry and never substitute old placeholders", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      status: path === "/api/dashboard" && fail ? 502 : 200,
      json:
        path === "/api/session"
          ? { authenticated: true }
          : fail
            ? { error: "Unavailable" }
            : {
                ...current,
                latestPost: null,
                projectCount: 0,
                webUpdatedAt: null,
                pdfUpdatedAt: null,
              },
    });
  });
  await page.goto(adminUrl);
  const dashboard = page.locator(".dashboard");
  await expect(
    dashboard.getByText("Could not load current site details."),
  ).toBeVisible();
  await expect(dashboard.locator("dd", { hasText: "Unavailable" })).toHaveCount(
    4,
  );
  await expect(dashboard).not.toContainText("Building a place");
  fail = false;
  await dashboard.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(dashboard).toContainText("No published posts");
  await expect(dashboard).toContainText("0 published");
  await expect(
    dashboard.locator("dd", { hasText: "No publication found" }),
  ).toHaveCount(2);
});
