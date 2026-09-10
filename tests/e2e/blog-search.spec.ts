import { expect, test } from "@playwright/test";

for (const archive of ["blog", "notes"]) {
  test(`${archive} search filters article text, shares queries and clears without changing chronology`, async ({
    page,
  }) => {
    await page.goto(`http://127.0.0.1:4321/${archive}/`);
    const search = page.getByRole("searchbox", { name: "Search posts" });
    const rows = page.locator(".archive-row:not([hidden])");
    const links = await rows
      .locator("h3 a")
      .evaluateAll((elements) => elements.map((el) => el.getAttribute("href")));
    const content = await rows.evaluateAll((elements) =>
      elements.map((row) => ({
        title: row.querySelector("h3")!.textContent!,
        excerpt: row.querySelector("p")!.textContent!,
        body: row.querySelector("template")!.content.textContent!,
        href: row.querySelector("h3 a")!.getAttribute("href")!,
      })),
    );
    expect(content.length).toBeGreaterThan(0);
    const previews = content
      .map((p) => p.title + " " + p.excerpt)
      .join(" ")
      .toLowerCase();
    const word = content[0]!.body
      .toLowerCase()
      .match(/[a-z]{6,}/g)!
      .find(
        (word) =>
          !previews.includes(word) &&
          content.filter((p) => p.body.toLowerCase().includes(word)).length ===
            1,
      )!;
    expect(word).toBeTruthy();
    await search.fill(word.toUpperCase());
    await expect(rows).toHaveCount(1);
    await expect(rows.locator("h3 a")).toHaveAttribute(
      "href",
      content[0]!.href,
    );
    await expect(page.getByRole("status")).toHaveText("1 post found");
    await expect(page).toHaveURL(new RegExp(`q=${word.toUpperCase()}`));
    await page.reload();
    await expect(search).toHaveValue(word.toUpperCase());
    await expect(rows).toHaveCount(1);
    await search.fill("zzzznosuchpostzzzz");
    await expect(rows).toHaveCount(0);
    await expect(page.locator(".archive > section:visible")).toHaveCount(0);
    await expect(
      page.getByText(
        "No posts found. Try different words or clear your search.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(search).toBeFocused();
    await expect(rows).toHaveCount(content.length);
    expect(
      await rows
        .locator("h3 a")
        .evaluateAll((elements) =>
          elements.map((el) => el.getAttribute("href")),
        ),
    ).toEqual(links);
    await expect(page).not.toHaveURL(/\?q=/);
    await search.fill(content[0]!.title);
    await search.press("Enter");
    await expect(
      rows.locator(`h3 a[href="${content[0]!.href}"]`),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Clear search" }).click();
    await page.screenshot({
      path: `test-results/${archive}-search-mobile.png`,
      fullPage: true,
    });
  });
}

test("the archive remains readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4321/blog/?q=notfound");
    await expect(page.locator(".archive-row").first()).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(page.locator(".archive-row h3 a").first()).toHaveAttribute(
      "href",
      /^\/blog\//,
    );
  } finally {
    await context.close();
  }
});
