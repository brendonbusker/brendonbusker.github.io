import { expect, test, type Page } from "@playwright/test";
import site from "../../apps/site/src/data/site.json";
import { dashboardFixture } from "../fixtures/dashboard";

type ClipboardTestWindow = Window & {
  copiedText?: string;
  finishClipboardWrite?: () => void;
};

async function openRecipeWorkspace(page: Page) {
  const recipes = ["First recipe", "Second recipe"].map((title, index) => ({
    content: {
      schemaVersion: 1,
      id: `6b2d645c-5931-4f6d-9fc3-50e3a741ed9${index}`,
      title,
      slug: `recipe-${index}`,
      publishedAt: "2026-10-04T12:00:00-05:00",
      updatedAt: "2026-10-04T17:00:00Z",
      status: "published",
      excerpt: "",
      meals: ["dinner"],
      servings: "",
      body: `<p>${title} body stays safe.</p>`,
    },
    path: `apps/site/src/content/recipes/recipe-${index}.md`,
    sha: String(index + 1).repeat(40),
  }));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const json =
      path === "/api/session"
        ? { authenticated: true, csrfToken: "cut-test" }
        : path === "/api/dashboard"
          ? dashboardFixture
          : path === "/api/published/homepage"
            ? {
                content: site,
                sha: "a".repeat(40),
                path: "apps/site/src/data/site.json",
              }
            : path === "/api/published/recipes"
              ? { items: recipes }
              : path === "/api/drafts"
                ? { drafts: [], savedAt: new Date().toISOString() }
                : { draft: null };
    return route.fulfill({ json });
  });
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
}

test("recipe slugs follow sequential title edits and preserve custom hyphenated slugs", async ({
  page,
}) => {
  await openRecipeWorkspace(page);
  const title = page.getByRole("textbox", { name: /^Title/ });
  const slug = page.getByLabel("Slug", { exact: true });
  await expect(title).toBeEnabled();
  await title.pressSequentially("Roasted tomato toast");
  await expect(slug).toHaveValue("roasted-tomato-toast");
  await slug.fill("family");
  await slug.pressSequentially("-");
  await expect(slug).toHaveValue("family-");
  await slug.pressSequentially("toast");
  await title.fill("Tomato toast for lunch");
  await expect(slug).toHaveValue("family-toast");
});

test("delayed Cut preserves a changed document or selection and still cuts an unchanged selection", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text: string) {
          const state = window as ClipboardTestWindow;
          state.copiedText = text;
          return new Promise<void>((resolve) => {
            state.finishClipboardWrite = resolve;
          });
        },
      },
    });
  });
  await openRecipeWorkspace(page);
  await page
    .locator(".document-list")
    .getByRole("button", { name: /First recipe/ })
    .click();
  const body = page.getByLabel("Recipe body", { exact: true });
  await expect(body).toHaveText("First recipe body stays safe.");
  await body.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.getByRole("button", { name: "Cut", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as ClipboardTestWindow).copiedText))
    .toBe("First recipe body stays safe.");

  // Clipboard permission may resolve after the writer has opened another recipe.
  await page
    .locator(".document-list")
    .getByRole("button", { name: /Second recipe/ })
    .click();
  await expect(body).toHaveText("Second recipe body stays safe.");
  await body.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.evaluate(() =>
    (window as ClipboardTestWindow).finishClipboardWrite?.(),
  );
  await expect(
    page.getByText(
      "Selection copied. The document or selection changed, so no text was cut.",
    ),
  ).toBeVisible();
  await expect(body).toHaveText("Second recipe body stays safe.");

  // Moving the selection within the same unchanged document must also be safe.
  await body.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.getByRole("button", { name: "Cut", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as ClipboardTestWindow).copiedText))
    .toBe("Second recipe body stays safe.");
  await body.click();
  await page.keyboard.press("ControlOrMeta+Home");
  await page.keyboard.press("ControlOrMeta+Shift+ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("Second");
  await page.evaluate(() =>
    (window as ClipboardTestWindow).finishClipboardWrite?.(),
  );
  await expect(body).toHaveText("Second recipe body stays safe.");

  // An unchanged selection is still removed after its original text is copied.
  await body.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.getByRole("button", { name: "Cut", exact: true }).click();
  await page.evaluate(() =>
    (window as ClipboardTestWindow).finishClipboardWrite?.(),
  );
  await expect(body).toHaveText("");
  await expect(page.getByText("Selection cut to the clipboard.")).toBeVisible();
});
