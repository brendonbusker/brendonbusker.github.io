import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import site from "../../apps/site/src/data/site.json";

const gif = readFileSync("tests/fixtures/animated.gif").toString("base64");
const avif =
  "AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAKgAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAEAAAABAAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAMm1kYXQSAAoJGAz/2iAhoNCAMhsUx4eGZQIIIJ5QAAAAOtxBfmJLp5yfpwswk+g=";
const adminUrl = process.env.ADMIN_TEST_URL || "http://127.0.0.1:5173/";
type Upload = { file: File; alt: string; path: string };

async function setup(
  page: Page,
  uploadHook?: (upload: Upload) => Promise<boolean>,
) {
  const uploads: Upload[] = [];
  let publishedBody = "";
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let json: unknown = {};
    if (path === "/api/session")
      json = { authenticated: true, csrfToken: "test" };
    else if (path === "/api/published/homepage")
      json = { content: site, sha: "site" };
    else if (path.startsWith("/api/published/")) json = { items: [] };
    else if (path === "/api/drafts")
      json =
        request.method() === "PUT"
          ? { savedAt: new Date().toISOString() }
          : { drafts: [] };
    else if (path.startsWith("/api/drafts/")) json = { draft: null };
    else if (path.startsWith("/api/publish/media/")) {
      const form = await new Response(
        new Uint8Array(request.postDataBuffer()!),
        { headers: { "content-type": request.headers()["content-type"]! } },
      ).formData();
      const file = form.get("file") as File;
      const upload = {
        file,
        alt: String(form.get("alt")),
        path: `/uploads/posts/paste-test/${uploads.length}-${file.name}`,
      };
      uploads.push(upload);
      if (uploadHook && !(await uploadHook(upload))) {
        await route.fulfill({
          status: 503,
          json: { error: "Upload temporarily unavailable." },
        });
        return;
      }
      json = { path: upload.path, alt: upload.alt };
    } else if (path === "/api/publish") {
      publishedBody = request.postDataJSON().payload.body;
      json = {
        contentSha: "published",
        path: "apps/site/src/content/posts/paste-test.md",
        version: "a".repeat(40),
        publishedAt: "2026-09-10T12:00:00-05:00",
      };
    }
    await route.fulfill({ json });
  });
  await page.goto(adminUrl);
  await page.getByRole("button", { name: "Blog", exact: true }).click();
  await expect(page.getByText("Loading blog posts…")).toHaveCount(0);
  await page.getByRole("textbox", { name: /^Title/ }).fill("Paste test");
  await page.locator(".document-surface").fill("Before\nAfter");
  return { uploads, body: () => publishedBody };
}

async function paste(
  page: Page,
  types: string[],
  options: { toolbar?: boolean; invalid?: boolean } = {},
) {
  await page.locator(".document-surface").evaluate(
    async (element, args) => {
      const files: File[] = [];
      for (const type of args.types) {
        let blob: Blob;
        if (args.invalid) blob = new Blob(["not a GIF"], { type });
        else if (type === "image/gif" || type === "image/avif") {
          blob = new Blob(
            [
              Uint8Array.from(
                atob(type === "image/gif" ? args.gif : args.avif),
                (c) => c.charCodeAt(0),
              ),
            ],
            { type },
          );
        } else {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 16;
          const context = canvas.getContext("2d")!;
          context.fillStyle = "red";
          context.fillRect(0, 0, 16, 16);
          blob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((value) => resolve(value!), type),
          );
          if (blob.type !== type)
            throw new Error(`Browser cannot create fixture ${type}`);
        }
        files.push(new File([blob], `image.${type.split("/")[1]}`, { type }));
      }
      if (args.toolbar) {
        Object.defineProperty(navigator.clipboard, "read", {
          configurable: true,
          value: async () =>
            files.map((file) => ({
              types: [file.type, "image/png"],
              getType: async (type: string) => {
                if (type !== file.type)
                  throw new Error("Chose flattened rendition");
                return file;
              },
            })),
        });
      } else {
        const data = new DataTransfer();
        files.forEach((file) => data.items.add(file));
        data.setData(
          "text/html",
          '<img src="https://example.test/duplicate.gif">',
        );
        element.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData: data,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
    },
    { types, gif, avif, ...options },
  );
  if (options.toolbar)
    await page.getByRole("button", { name: "Paste", exact: true }).click();
}

test("pastes every supported format in order, maps position while typing, and publishes permanent paths", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { uploads, body } = await setup(page, async () => {
    await gate;
    return true;
  });
  const surface = page.locator(".document-surface");
  await surface.press("Control+a");
  await surface.press("ArrowLeft");
  page.on("dialog", (dialog) => dialog.accept("Pasted picture"));
  await paste(page, [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
  ]);
  await expect.poll(() => uploads.length).toBe(1);
  await expect(page.getByText(/Uploading 5 images to GitHub/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeDisabled();
  await surface.press("Control+End");
  await surface.press("End");
  await page.keyboard.type(" keeps its place");
  release();
  await expect(surface.locator("img")).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeEnabled();
  expect(uploads.map(({ file }) => file.type)).toEqual([
    "image/webp",
    "image/webp",
    "image/webp",
    "image/webp",
    "image/gif",
  ]);
  expect(Buffer.from(await uploads[4]!.file.arrayBuffer())).toEqual(
    Buffer.from(gif, "base64"),
  );
  expect(
    await surface
      .locator("img")
      .evaluateAll((images) =>
        images.map((image) => image.getAttribute("data-cms-path")),
      ),
  ).toEqual(uploads.map(({ path }) => path));
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect.poll(body).toContain("keeps its place");
  expect(body().indexOf("<img"), body()).toBeLessThan(body().indexOf("Before"));
  expect(body()).not.toMatch(/blob:|example.test/);
  for (const upload of uploads) expect(body()).toContain(upload.path);
});

test("real Ctrl+V uploads a clipboard screenshot and leaves text pasting intact", async ({
  page,
  context,
}) => {
  const { uploads } = await setup(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/png"),
    );
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  });
  page.once("dialog", (dialog) => dialog.accept("Clipboard screenshot"));
  await page.locator(".document-surface").press("Control+v");
  await expect(page.locator(".document-surface img")).toHaveCount(1);
  expect(uploads[0]!.file.type).toBe("image/webp");
  await page.evaluate(() => navigator.clipboard.writeText("Plain pasted text"));
  await page.locator(".document-surface").press("Control+End");
  await page.keyboard.press("Control+v");
  await expect(page.locator(".document-surface")).toContainText(
    "Plain pasted text",
  );
  expect(uploads).toHaveLength(1);
});

test("ribbon Paste chooses original GIF bytes over a static clipboard rendition", async ({
  page,
}) => {
  const { uploads } = await setup(page);
  page.once("dialog", (dialog) => dialog.accept("Animated ribbon paste"));
  await paste(page, ["image/gif"], { toolbar: true });
  await expect(page.locator(".document-surface img")).toHaveCount(1);
  expect(Buffer.from(await uploads[0]!.file.arrayBuffer())).toEqual(
    Buffer.from(gif, "base64"),
  );
});

test("cancel, missing title, invalid GIF and upload failure leave text intact and allow retry", async ({
  page,
}) => {
  let fail = true;
  const { uploads } = await setup(page, async () => !fail);
  const surface = page.locator(".document-surface");
  await page.getByRole("textbox", { name: /^Title/ }).fill("");
  await page.getByRole("textbox", { name: "Slug", exact: true }).fill("");
  await paste(page, ["image/gif"]);
  await expect(
    page.getByRole("status").filter({ hasText: "Add a post title" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: /^Title/ }).fill("Paste test");
  page.once("dialog", (dialog) => dialog.dismiss());
  await paste(page, ["image/gif"]);
  expect(uploads).toHaveLength(0);
  page.on("dialog", (dialog) => dialog.accept("Test picture"));
  await paste(page, ["image/gif"], { invalid: true });
  await expect(
    page.getByRole("status").filter({ hasText: "not a valid GIF" }),
  ).toBeVisible();
  expect(uploads).toHaveLength(0);
  await paste(page, ["image/gif"]);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Upload temporarily unavailable" }),
  ).toBeVisible();
  await expect(surface.locator("img")).toHaveCount(0);
  await expect(surface).toContainText("Before");
  fail = false;
  await paste(page, ["image/gif"]);
  await expect(surface.locator("img")).toHaveCount(1);
});

test("a delayed upload cannot insert into a different post", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { uploads } = await setup(page, async () => {
    await gate;
    return true;
  });
  page.once("dialog", (dialog) => dialog.accept("Old post picture"));
  await paste(page, ["image/gif"]);
  await expect.poll(() => uploads.length).toBe(1);
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue("");
  release();
  await expect(page.getByText(/Uploading 1 image to GitHub/)).toHaveCount(0);
  await expect(page.locator(".document-surface img")).toHaveCount(0);
});
