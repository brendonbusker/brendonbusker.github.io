import { expect, test, type Page, type Route } from "@playwright/test";
import source from "../../apps/site/src/data/resume.json";

async function setup(
  page: Page,
  options: {
    loadFailure?: boolean;
    holdDraft?: boolean;
    holdPublish?: boolean;
    saveFailure?: boolean;
    publishFailure?: boolean;
  } = {},
) {
  const state = {
    ...options,
    published: structuredClone(source),
    draft: null as typeof source | null,
    draftWrites: [] as Array<typeof source>,
    webWrites: [] as Array<{ payload: typeof source; expectedSha?: string }>,
    pendingDraft: null as Route | null,
    pendingPublish: null as Route | null,
  };
  state.published.fullName = "Current published name";
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let json: unknown = {},
      status = 200;
    if (path === "/api/session")
      json = { authenticated: true, csrfToken: "test" };
    else if (path === "/api/published/resume") {
      if (state.loadFailure) {
        status = 503;
        json = { error: "Resume load failed" };
      } else
        json = {
          content: state.published,
          path: "apps/site/src/data/resume.json",
          sha: "current-sha",
        };
    } else if (path === "/api/drafts/resume/main") {
      if (request.method() === "DELETE") state.draft = null;
      json = { draft: state.draft };
    } else if (path === "/api/drafts" && request.method() === "PUT") {
      const payload = request.postDataJSON().payload;
      state.draftWrites.push(payload);
      if (state.holdDraft) {
        state.holdDraft = false;
        state.pendingDraft = route;
        return;
      }
      if (state.saveFailure) {
        status = 503;
        json = { error: "Draft save failed" };
      } else {
        state.draft = payload;
        json = { savedAt: new Date().toISOString() };
      }
    } else if (path === "/api/publish") {
      const body = request.postDataJSON();
      state.webWrites.push(body);
      if (state.holdPublish) {
        state.pendingPublish = route;
        return;
      }
      if (state.publishFailure) {
        status = 409;
        json = {
          error: "The published resume changed. Reload before publishing.",
        };
      } else {
        state.published = body.payload;
        json = {
          contentSha: "next-sha",
          path: "apps/site/src/data/resume.json",
        };
      }
    } else throw new Error(`Unexpected API request: ${path}`);
    await route.fulfill({ status, json });
  });
  await page.goto(process.env.ADMIN_TEST_URL || "http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Résumé", exact: true }).click();
  if (!options.loadFailure)
    await expect(
      page.getByRole("button", { name: "Publish", exact: true }),
    ).toBeEnabled();
  return state;
}

test("failed content loading blocks publishing and editing until retry succeeds", async ({
  page,
}) => {
  const state = await setup(page, { loadFailure: true });
  await expect(
    page.getByText("Resume load failed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Generate PDF", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Name", { exact: true })).toBeDisabled();
  await page.keyboard.press("Control+s");
  expect(state.draftWrites).toHaveLength(0);
  expect(state.webWrites).toHaveLength(0);
  state.loadFailure = false;
  await page
    .getByRole("button", { name: "Retry loading résumé", exact: true })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Current published name",
  );
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeEnabled();
});

test("publishing drains autosaves, locks editing and duplicate submission, then resumes normally", async ({
  page,
}) => {
  const state = await setup(page, { holdDraft: true, holdPublish: true });
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("Earlier autosave");
  await expect.poll(() => !!state.pendingDraft).toBe(true);
  await name.fill("Latest snapshot");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(name).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Publishing…", exact: true }),
  ).toBeDisabled();
  expect(state.webWrites).toHaveLength(0);
  state.draft = state.draftWrites[0]!;
  await state.pendingDraft!.fulfill({
    json: { savedAt: new Date().toISOString() },
  });
  await expect.poll(() => !!state.pendingPublish).toBe(true);
  expect(state.draftWrites.map((draft) => draft.fullName)).toEqual([
    "Earlier autosave",
    "Latest snapshot",
  ]);
  expect(state.webWrites[0]).toMatchObject({
    expectedSha: "current-sha",
    payload: { fullName: "Latest snapshot" },
  });
  await page.keyboard.press("Control+s");
  await page
    .getByRole("button", { name: "Publishing…", exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  expect(state.webWrites).toHaveLength(1);
  state.published = state.webWrites[0]!.payload;
  await state.pendingPublish!.fulfill({
    json: { contentSha: "next-sha", path: "apps/site/src/data/resume.json" },
  });
  await expect(name).toBeEnabled();
  await expect(name).toHaveValue("Latest snapshot");
  await expect.poll(() => state.draft).toBeNull();
  await name.fill("Next edit after publishing");
  await expect
    .poll(() => state.draft?.fullName)
    .toBe("Next edit after publishing");
});

for (const failure of ["saveFailure", "publishFailure"] as const) {
  test(`${failure} preserves edits and unlocks the form`, async ({ page }) => {
    const state = await setup(page, { [failure]: true });
    await page.getByLabel("Name", { exact: true }).fill("Keep these edits");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(
      page.getByText(
        failure === "saveFailure"
          ? "Could not save your draft. Your edits are still here; try publishing again."
          : "The published resume changed. Reload before publishing.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toBeEnabled();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Keep these edits",
    );
    expect(state.webWrites).toHaveLength(failure === "saveFailure" ? 0 : 1);
  });
}

test("comma lists support normal typing and the web preview contains every resume section", async ({
  page,
}) => {
  const state = await setup(page);
  const skills = page.getByRole("textbox", {
    name: "Technical skills",
    exact: true,
  });
  await skills.fill("Python");
  await skills.press("End");
  await skills.pressSequentially(", SQL (Oracle, SQL Server)");
  await expect(skills).toHaveValue("Python, SQL (Oracle, SQL Server)");
  const technologies = page.getByLabel("Project 1 technologies", {
    exact: true,
  });
  await technologies.fill("Astro");
  await technologies.press("End");
  await technologies.pressSequentially(", React");
  await expect(technologies).toHaveValue("Astro, React");
  await page
    .getByLabel("Contact 2 text", { exact: true })
    .fill("PRIVATE-CONTACT");
  await page
    .getByRole("checkbox", { name: "Show Phone publicly", exact: true })
    .uncheck();
  await page
    .getByLabel("Education 1 location", { exact: true })
    .fill("Education test location");
  await expect
    .poll(() => state.draft?.education[0]?.location)
    .toBe("Education test location");
  expect(
    state.draft?.skillGroups.find((group) => group.name === "Technical")
      ?.skills,
  ).toEqual(["Python", "SQL (Oracle, SQL Server)"]);
  await page.reload();
  await page.getByRole("button", { name: "Résumé", exact: true }).click();
  await expect(skills).toHaveValue("Python, SQL (Oracle, SQL Server)");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.locator(".resume-preview");
  for (const heading of [
    "Contact",
    "Skills",
    "Experience",
    "Education",
    "Certifications",
    "Selected work",
  ])
    await expect(
      preview.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  for (const text of [
    source.links[0]!.value,
    source.selectedWork[0]!.name,
    source.certifications[0]!.name,
    source.education[0]!.startDate,
    source.education[0]!.endDate,
    "Education test location",
  ])
    await expect(preview).toContainText(text);
  await expect(preview).not.toContainText("PRIVATE-CONTACT");
});
