import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { sanitizePostBody } from "./index";
import { MAX_IMAGE_BYTES } from "@brendon/shared";

const gif = readFileSync(
  new URL("../../../tests/fixtures/animated.gif", import.meta.url),
);

describe("GIF publishing", () => {
  afterEach(() => vi.unstubAllGlobals());
  async function upload(bytes: Uint8Array, filename = "animation.gif") {
    const csrf = Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode("csrf")),
    ).toString("base64");
    const now = Date.now();
    const row = {
      id: "session",
      csrf_hash: csrf,
      last_seen_at: new Date(now).toISOString(),
      expires_at: new Date(now + 3600000).toISOString(),
      absolute_expires_at: new Date(now + 7200000).toISOString(),
    };
    const env = {
      ADMIN_ORIGIN: "https://admin.example.com",
      SESSION_IDLE_MINUTES: "45",
      IP_HASH_SECRET: "test",
      GITHUB_OWNER: "owner",
      GITHUB_REPO: "repo",
      GITHUB_BRANCH: "main",
      GITHUB_TOKEN: "test",
      DB: {
        prepare: () => ({
          bind() {
            return this;
          },
          first: async () => row,
          run: async () => ({ success: true }),
        }),
      },
    };
    const writes: Array<{ url: string; payload: { content: string } }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        if (options?.method === "PUT") {
          writes.push({ url, payload: JSON.parse(String(options.body)) });
          return Response.json({
            content: { path: url.split("/contents/")[1], sha: "sha" },
            commit: { sha: "commit", html_url: "https://github.test/commit" },
          });
        }
        return new Response("Not found", { status: 404 });
      }),
    );
    const form = new FormData();
    form.set(
      "file",
      new File([new Uint8Array(bytes)], filename, { type: "image/gif" }),
    );
    form.set("alt", "Red and blue animation");
    const response = await worker.request(
      "/api/publish/media/posts/gif-test",
      {
        method: "POST",
        headers: {
          Origin: env.ADMIN_ORIGIN,
          Cookie: "__Host-admin_session=test",
          "X-CSRF-Token": "csrf",
        },
        body: form,
      },
      env,
    );
    return {
      response,
      writes,
      data: (await response.json()) as { path: string; publishedAt: string },
    };
  }
  it("publishes exact animated bytes to a generated GIF path and preserves its image markup", async () => {
    const { response, writes, data } = await upload(gif, "untrusted.png");
    expect(response.status).toBe(200);
    expect(data.path).toMatch(/^\/uploads\/posts\/gif-test\/[a-z0-9-]+\.gif$/);
    expect(writes).toHaveLength(1);
    expect(Buffer.from(writes[0]!.payload.content, "base64")).toEqual(gif);
    const html = sanitizePostBody(
      `<img src="${data.path}" alt="Red and blue animation" data-layout="left" width="320" onerror="alert(1)">`,
    );
    expect(html).toContain(`src="${data.path}"`);
    expect(html).toContain('data-layout="left"');
    expect(html).not.toContain("onerror");
  });
  it("rejects fake, truncated and oversized GIFs before GitHub writes", async () => {
    for (const bytes of [
      Buffer.from("<script>not a GIF</script>"),
      gif.subarray(0, 6),
      gif.subarray(0, gif.length - 1),
    ]) {
      const { response, writes } = await upload(bytes);
      expect(response.status).toBe(415);
      expect(writes).toHaveLength(0);
    }
    const { response, writes } = await upload(
      new Uint8Array(MAX_IMAGE_BYTES + 1),
    );
    expect(response.status).toBe(413);
    expect(writes).toHaveLength(0);
  });
});
