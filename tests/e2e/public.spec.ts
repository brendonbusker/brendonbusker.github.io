import { expect, test } from "@playwright/test";
test("homepage, archive, post, projects, resume, and 404 render", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4321/");
  await expect(
    page.getByRole("heading", { name: "Brendon Busker" }),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:4321/blog/");
  await expect(page.getByRole("heading", { name: "2026" })).toBeVisible();
  await page.locator(".archive-row h3 a").first().click();
  await expect(page.locator("article.post")).toBeVisible();
  await page.goto("http://127.0.0.1:4321/resume/");
  await expect(
    page.getByRole("link", { name: /Download PDF/ }),
  ).toHaveAttribute("href", "/resume/Brendon-Busker-Resume.pdf");
  const response = await page.goto("http://127.0.0.1:4321/not-real");
  expect(response?.status()).toBe(404);
});
test("project modal supports keyboard, deep links, escape, and history", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4321/projects/");
  await expect(
    page.getByRole("button", { name: /Shiny Hunt Tracker/ }),
  ).toBeVisible();
  const card = page.getByRole("button", { name: /Ultimate IV Calculator/ });
  await card.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.locator("header.has-image .project-hero-image"),
  ).toHaveAttribute(
    "src",
    /\/uploads\/projects\/ultimate-iv-calculator\/.+\.webp$/,
  );
  await expect(page).toHaveURL(/project=ultimate-iv-calculator/);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(card).toBeFocused();
  await page.goto(
    "http://127.0.0.1:4321/projects/?project=ultimate-iv-calculator",
  );
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).not.toBeVisible();

  await page.goto("http://127.0.0.1:4321/projects/?project=shiny-hunt-tracker");
  const shinyDialog = page.getByRole("dialog", { name: "Shiny Hunt Tracker" });
  await expect(shinyDialog).toBeVisible();
  await expect(shinyDialog.locator(".project-hero-image")).toHaveCount(1);
  await expect(
    shinyDialog.getByRole("link", { name: /Open live project/ }),
  ).toHaveAttribute(
    "href",
    "https://brendonbusker.github.io/shiny-hunt-tracker/",
  );
});
test("mobile navigation remains visible without a drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4321/");
  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  await expect(navigation).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Projects", exact: true }),
  ).toBeVisible();
});
