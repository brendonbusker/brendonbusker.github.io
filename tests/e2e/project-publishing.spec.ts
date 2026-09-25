import { expect, test, type Page, type Route } from "@playwright/test";
import type { Project } from "@brendon/shared";
import { dashboardFixture } from "../fixtures/dashboard";
import {
  serializeContent,
  parseManagedMarkdown,
} from "../../apps/admin/worker/index";

const original: Project = {
  schemaVersion: 1,
  id: "979ca838-f91f-41c4-bb88-af8f7a14f945",
  title: "Hidden project",
  slug: "hidden-project",
  summary: "Keep this project description",
  category: "Desktop Application",
  status: "Release 1.0",
  published: false,
  featured: false,
  sortOrder: 0,
  liveUrl: "https://example.com",
  githubUrl: "https://github.com/example/project",
  icon: "folder",
  accent: "#008000",
  techStack: [],
  screenshots: [],
  overview: "Original overview",
  why: "Original reasoning",
  implementation: "Original implementation",
  features: ["Original feature"],
  createdAt: "2026-09-25",
  updatedAt: "2026-09-25",
};

async function setup(page: Page, existing = false) {
  const state = {
    item: existing
      ? {
          content: structuredClone(original),
          path: "apps/site/src/content/projects/hidden-project.md",
          sha: "original-sha",
        }
      : null,
    drafts: new Map<string, Project>(),
    writes: [] as Array<{
      payload: Project;
      expectedSha?: string;
      targetPath?: string;
    }>,
    holdSave: false,
    saveFailure: false,
    held: null as Route | null,
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let json: unknown = {};
    if (path === "/api/session")
      json = { authenticated: true, csrfToken: "test" };
    else if (path === "/api/dashboard") json = dashboardFixture;
    else if (path === "/api/published/projects")
      json = { items: state.item ? [state.item] : [] };
    else if (path === "/api/drafts" && request.method() === "PUT") {
      if (state.holdSave) {
        state.holdSave = false;
        state.held = route;
        return;
      }
      if (state.saveFailure) {
        await route.fulfill({
          status: 503,
          json: { error: "Draft save failed" },
        });
        return;
      }
      const body = request.postDataJSON();
      state.drafts.set(body.contentKey, body.payload);
      json = { savedAt: new Date().toISOString() };
    } else if (path.startsWith("/api/drafts/project/")) {
      const key = path.split("/").pop()!;
      if (request.method() === "DELETE") state.drafts.delete(key);
      json = { draft: state.drafts.get(key) ?? null };
    } else if (path === "/api/publish") {
      const body = request.postDataJSON();
      state.writes.push(body);
      const serialized = serializeContent(
        "project",
        body.payload,
        body.targetPath,
      );
      // Verify the actual Markdown serializer, not just the editor request flag.
      expect(parseManagedMarkdown(serialized.content).data.published).toBe(
        body.payload.published,
      );
      state.item = {
        content: body.payload,
        path: serialized.path,
        sha: `sha-${state.writes.length}`,
      };
      json = {
        path: serialized.path,
        contentSha: state.item.sha,
        version: "a".repeat(40),
      };
    }
    await route.fulfill({ json });
  });
  await page.goto(process.env.ADMIN_TEST_URL || "http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeEnabled();
  if (existing) {
    await page
      .getByRole("combobox", { name: "Choose a project to edit" })
      .selectOption(original.slug);
    await expect(
      page.getByRole("textbox", { name: "Project name", exact: true }),
    ).toHaveValue(original.title);
    await expect(
      page.getByRole("button", { name: "Publish", exact: true }),
    ).toBeEnabled();
  }
  return state;
}

test("new project Publish makes it visible, retains content on reopen, and hiding is explicit", async ({
  page,
}) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("textbox", { name: "Project name", exact: true })
    .fill("A brand new project");
  await page
    .getByRole("textbox", { name: "Short summary", exact: true })
    .fill("New project content");
  await expect(
    page.getByRole("checkbox", { name: "Published", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Not listed on the website. Publish makes this project visible.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hide from website", exact: true }),
  ).toBeEnabled();
  expect(state.writes[0]!.payload).toMatchObject({
    published: true,
    title: "A brand new project",
    summary: "New project content",
  });
  expect(state.drafts.size).toBe(0);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Choose a project to edit" })
    .selectOption("a-brand-new-project");
  await expect(
    page.getByRole("textbox", { name: "Short summary", exact: true }),
  ).toHaveValue("New project content");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Hide from website", exact: true })
    .click();
  expect(state.writes).toHaveLength(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Hide from website", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Project hidden" }),
  ).toBeVisible();
  expect(state.item?.content.published).toBe(false);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hide from website", exact: true }),
  ).toBeEnabled();
  expect(state.item?.content.published).toBe(true);
});

test("publishing a hidden project drains stale autosaves and publishes the latest edits with its SHA", async ({
  page,
}) => {
  const state = await setup(page, true);
  state.holdSave = true;
  const summary = page.getByRole("textbox", {
    name: "Short summary",
    exact: true,
  });
  await summary.fill("Older autosave");
  await expect.poll(() => !!state.held).toBe(true);
  await summary.fill("Latest edits must survive");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(summary).toBeDisabled();
  await page.keyboard.press("Control+s");
  expect(state.writes).toHaveLength(0);
  const old = state.held!.request().postDataJSON();
  state.drafts.set(old.contentKey, old.payload);
  await state.held!.fulfill({ json: { savedAt: new Date().toISOString() } });
  await expect(
    page.getByRole("button", { name: "Hide from website", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    expectedSha: "original-sha",
    targetPath: "apps/site/src/content/projects/hidden-project.md",
    payload: {
      ...original,
      published: true,
      summary: "Latest edits must survive",
      updatedAt: expect.any(String),
    },
  });
  expect(state.drafts.size).toBe(0);
  await expect(summary).toHaveValue("Latest edits must survive");
});

test("a failed draft save does not publish or lose project edits", async ({
  page,
}) => {
  const state = await setup(page, true);
  state.saveFailure = true;
  await page
    .getByRole("textbox", { name: "Short summary", exact: true })
    .fill("Retained edits");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Could not save your draft" }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await expect(
    page.getByRole("textbox", { name: "Short summary", exact: true }),
  ).toHaveValue("Retained edits");
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeEnabled();
});
