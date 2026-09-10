import { expect, test } from "@playwright/test";
import resume from "../../apps/site/src/data/resume.json";

test("generate, download, regenerate and publish the exact reviewed résumé PDF", async ({
  page,
}) => {
  test.setTimeout(90000);
  let uploads = 0;
  let uploadedBytes = Buffer.alloc(0);
  const source = {
    ...resume,
    fullName: "Brendon Busker",
    links: [
      ...resume.links,
      {
        label: "Private",
        value: "DO-NOT-EXPORT-PRIVATE",
        url: "",
        public: false,
      },
    ],
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = {};
    if (path === "/api/session")
      response = { authenticated: true, csrfToken: "test" };
    else if (path === "/api/published/resume")
      response = {
        content: source,
        path: "apps/site/src/data/resume.json",
        sha: "loaded-sha",
      };
    else if (path === "/api/drafts/resume/main") response = { draft: null };
    else if (path === "/api/drafts")
      response = { savedAt: new Date().toISOString() };
    else if (path === "/api/publish/resume-pdf") {
      uploads++;
      const request = route.request();
      const form = await new Response(request.postDataBuffer(), {
        headers: { "Content-Type": request.headers()["content-type"]! },
      }).formData();
      uploadedBytes = Buffer.from(
        await (form.get("file") as File).arrayBuffer(),
      );
      response = {
        version: "a".repeat(40),
        path: "/resume/Brendon-Busker-Resume.pdf",
        publicUrl:
          "https://brendonbusker.github.io/resume/Brendon-Busker-Resume.pdf",
      };
    } else if (path.startsWith("/api/deployment/"))
      response = {
        state: "live",
        message: "Your changes are live on the website.",
      };
    else throw new Error(`Unexpected API request: ${path}`);
    await route.fulfill({ json: response });
  });
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Résumé", exact: true }).click();
  await page.getByRole("button", { name: "Generate PDF", exact: true }).click();
  await expect(
    page.getByText("PDF ready. Review the preview before publishing."),
  ).toBeVisible({ timeout: 45000 });
  await expect(page.getByTitle("Generated résumé PDF preview")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  expect(uploads).toBe(0);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF", exact: true }).click();
  const downloaded = await downloadPromise;
  expect(downloaded.suggestedFilename()).toBe("Brendon-Busker-Resume.pdf");
  await downloaded.saveAs("test-results/generated-resume.pdf");
  await page
    .getByLabel("Professional summary")
    .fill("Current editor changes included in the reviewed PDF.");
  await expect(
    page.getByRole("button", { name: "Publish PDF to website" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Download PDF", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Regenerate PDF" }).click();
  await expect(
    page.getByRole("link", { name: "Download PDF", exact: true }),
  ).toBeVisible({ timeout: 45000 });
  const bytes = await page
    .getByRole("link", { name: "Download PDF", exact: true })
    .evaluate(async (el) =>
      Array.from(
        new Uint8Array(
          await (await fetch((el as HTMLAnchorElement).href)).arrayBuffer(),
        ),
      ),
    );
  await page.getByRole("button", { name: "Publish PDF to website" }).click();
  await expect(
    page.getByText(
      "Résumé PDF published. Follow the publication status above.",
    ),
  ).toBeVisible();
  expect(uploads).toBe(1);
  expect(uploadedBytes).toEqual(Buffer.from(bytes));
});

test("PDF generation stays disabled if the current published résumé cannot load", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session")
      await route.fulfill({ json: { authenticated: true, csrfToken: "test" } });
    else if (path === "/api/published/resume")
      await route.fulfill({
        status: 503,
        json: { error: "Could not load current résumé." },
      });
    else await route.fulfill({ json: { draft: null } });
  });
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Résumé", exact: true }).click();
  await expect(page.getByText("Could not load current résumé.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate PDF", exact: true }),
  ).toBeDisabled();
});
