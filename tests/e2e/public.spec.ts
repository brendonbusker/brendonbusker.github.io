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
  await page.goto("http://127.0.0.1:4321/projects/");
  await expect(
    page.getByRole("heading", { name: "Useful things, built with care." }),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:4321/resume/");
  await expect(
    page.getByRole("link", { name: /Download PDF/ }),
  ).toHaveAttribute("href", "/resume/Brendon-Busker-Resume.pdf");
  const response = await page.goto("http://127.0.0.1:4321/not-real");
  expect(response?.status()).toBe(404);
});

test("visitor theme choice persists while the resume keeps its configured policy", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4321/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Site default" }).click();
  await page.getByRole("menuitemradio", { name: /Hacker/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "hacker");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("brendon-public-theme")),
    )
    .toBe("hacker");

  await page.goto("http://127.0.0.1:4321/blog/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "hacker");
  await page.goto("http://127.0.0.1:4321/resume/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-preference",
    "hacker",
  );
  await expect(page.locator(".theme-picker")).toHaveCount(0);
});

test("every public palette remains readable and contained on every main page", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const themes = [
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
  ];
  const routes = [
    "/",
    "/blog/",
    "/blog/2026/09/03/first-post/",
    "/projects/",
    "/resume/",
  ];

  for (const route of routes) {
    await page.goto(`http://127.0.0.1:4321${route}`);
    for (const theme of themes) {
      const result = await page.locator("html").evaluate((root, nextTheme) => {
        root.dataset.theme = nextTheme;
        const bodyStyle = getComputedStyle(document.body);
        const parseRgb = (value: string) =>
          (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const luminance = (rgb: number[]) => {
          const values = rgb.map((channel) => {
            const value = channel / 255;
            return value <= 0.03928
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
        };
        const foreground = luminance(parseRgb(bodyStyle.color));
        const background = luminance(parseRgb(bodyStyle.backgroundColor));
        const contrast =
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05);
        return {
          contrast,
          overflow: document.documentElement.scrollWidth - innerWidth,
          mainVisible: document.querySelector("main")?.getBoundingClientRect()
            .height,
        };
      }, theme);
      expect(result.contrast, `${theme} contrast on ${route}`).toBeGreaterThan(
        4.5,
      );
      expect(
        result.overflow,
        `${theme} overflow on ${route}`,
      ).toBeLessThanOrEqual(1);
      expect(
        result.mainVisible,
        `${theme} main content on ${route}`,
      ).toBeGreaterThan(0);
    }
  }
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
