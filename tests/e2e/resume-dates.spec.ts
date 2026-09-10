import { expect, test } from "@playwright/test";
import resume from "../../apps/site/src/data/resume.json";

test("current roles can become past roles and retain their end date through saving and publishing", async ({
  page,
}) => {
  const published = structuredClone(resume);
  published.experience[0]!.current = true;
  published.experience[0]!.endDate = "";
  let draft: typeof resume | null = null;
  let publishedChanges = 0;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let response: unknown;
    if (path === "/api/session")
      response = { authenticated: true, csrfToken: "test" };
    else if (path === "/api/published/resume")
      response = {
        content: published,
        path: "apps/site/src/data/resume.json",
        sha: `published-${publishedChanges}`,
      };
    else if (path === "/api/drafts/resume/main") {
      if (request.method() === "DELETE") draft = null;
      response = { draft };
    } else if (path === "/api/drafts" && request.method() === "PUT") {
      draft = request.postDataJSON().payload;
      response = { savedAt: new Date().toISOString() };
    } else if (path === "/api/publish") {
      const data = request.postDataJSON();
      expect(data.contentType).toBe("resume");
      expect(data.expectedSha).toBe(`published-${publishedChanges}`);
      Object.assign(published, data.payload);
      publishedChanges++;
      response = {
        contentSha: `published-${publishedChanges}`,
        path: "apps/site/src/data/resume.json",
      };
    } else throw new Error(`Unexpected API request: ${path}`);
    await route.fulfill({ json: response });
  });
  await page.goto(process.env.ADMIN_TEST_URL || "http://127.0.0.1:5173/");
  const openResume = async () => {
    await page.getByRole("button", { name: "Résumé", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Generate PDF", exact: true }),
    ).toBeEnabled();
  };
  await openResume();
  const current = page
    .getByRole("checkbox", { name: "I currently work here", exact: true })
    .first();
  const end = page.getByLabel("End", { exact: true }).first();
  await expect(current).toBeChecked();
  await expect(end).toHaveValue("Present");
  await expect(end).toBeDisabled();
  await current.uncheck();
  await expect(end).toBeEnabled();
  await end.fill("September 2026");
  await expect
    .poll(() => draft?.experience[0])
    .toMatchObject({ current: false, endDate: "September 2026" });
  await page.reload();
  await openResume();
  await expect(current).not.toBeChecked();
  await expect(end).toHaveValue("September 2026");
  await current.check();
  await expect(end).toHaveValue("Present");
  await expect(end).toBeDisabled();
  await current.uncheck();
  await expect(end).toHaveValue("September 2026");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect.poll(() => publishedChanges).toBe(1);
  expect(published.experience[0]).toMatchObject({
    current: false,
    endDate: "September 2026",
  });
  await expect.poll(() => draft).toBeNull();
  await page.reload();
  await openResume();
  await expect(current).not.toBeChecked();
  await expect(end).toHaveValue("September 2026");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".resume-preview article").first()).toContainText(
    "September 2026",
  );
  await expect(
    page.locator(".resume-preview article").first(),
  ).not.toContainText("Present");
});
