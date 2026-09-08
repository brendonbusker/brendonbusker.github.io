import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { parseManagedMarkdown, serializeContent } from "./index";

const post = {
  id: "3b1f7d4b-d695-4b02-9f8f-977c06e84b1e",
  title: "A late post",
  slug: "late-post",
  publishedAt: "2026-09-07T23:59:59-05:00",
  updatedAt: "2026-09-08T04:59:59.000Z",
  body: "Keep this body.",
  status: "published",
};
const path = "apps/site/src/content/posts/2026-09-07-late-post.md";
const profile = {
  fullName: "Test",
  professionalHeadline: "Test",
  intro: "Test",
  socialLinks: [],
  siteTitle: "Test",
  siteDescription: "Test",
  timezone: "CST",
  adminUrl: "https://admin.example.com",
};

describe("publication API timestamps", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function publish(
    payload: unknown,
    existing?: typeof post,
    expectedSha?: string,
  ) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T04:59:59Z"));
    const hash = Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode("csrf")),
    ).toString("base64");
    const row = {
      id: "session",
      csrf_hash: hash,
      last_seen_at: new Date().toISOString(),
      expires_at: "2026-09-08T05:30:00Z",
      absolute_expires_at: "2026-09-08T12:00:00Z",
    };
    const env = {
      ADMIN_ORIGIN: "https://admin.example.com",
      SESSION_IDLE_MINUTES: "45",
      SESSION_ABSOLUTE_HOURS: "8",
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
    const writes: Array<{ message: string; content: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        if (options?.method === "PUT") {
          writes.push(JSON.parse(String(options.body)));
          return Response.json({
            content: { path, sha: "next-sha" },
            commit: { sha: "commit", html_url: "https://github.test/commit" },
          });
        }
        if (url.includes("src/data/site.json"))
          return Response.json({
            path: "apps/site/src/data/site.json",
            sha: "profile",
            type: "file",
            encoding: "base64",
            content: Buffer.from(JSON.stringify(profile)).toString("base64"),
          });
        if (existing)
          return Response.json({
            path,
            sha: "current-sha",
            type: "file",
            encoding: "base64",
            content: Buffer.from(
              serializeContent("post", existing, path).content,
            ).toString("base64"),
          });
        return new Response("Not found", { status: 404 });
      }),
    );
    const response = await worker.request(
      "/api/publish",
      {
        method: "POST",
        headers: {
          Origin: env.ADMIN_ORIGIN,
          Cookie: "__Host-admin_session=test",
          "X-CSRF-Token": "csrf",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType: "post",
          payload,
          ...(existing ? { targetPath: path, expectedSha } : {}),
        }),
      },
      env,
    );
    return {
      response,
      writes,
      data: (await response.json()) as { path: string; publishedAt: string },
    };
  }

  it("uses the server publish instant instead of the draft date and returns it to the editor", async () => {
    const { response, writes, data } = await publish({
      ...post,
      publishedAt: "2026-08-01",
    });
    expect(response.status).toBe(200);
    expect(data.publishedAt).toBe("2026-09-07T23:59:59-05:00");
    expect(data.path).toBe(path);
    const saved = parseManagedMarkdown(
      Buffer.from(writes[0]!.content, "base64").toString(),
    );
    expect(saved.data.publishedAt).toBe(data.publishedAt);
    expect(saved.body).toBe(post.body);
  });
  it("retains publication time on republish and accepts an explicit time correction", async () => {
    const original = { ...post, publishedAt: "2026-09-07T09:00:00-05:00" };
    expect(
      (await publish(original, original, "current-sha")).data.publishedAt,
    ).toBe(original.publishedAt);
    const edited = { ...original, publishedAt: "2026-09-07T10:15:32-05:00" };
    expect(
      (await publish(edited, original, "current-sha")).data.publishedAt,
    ).toBe(edited.publishedAt);
    expect(
      (
        await publish(
          { ...original, publishedAt: "2026-09-07" },
          original,
          "current-sha",
        )
      ).data.publishedAt,
    ).toBe(original.publishedAt);
  });
  it("rejects conflicts and invalid timestamps without writing content", async () => {
    const conflict = await publish(post, post, "old-sha");
    expect(conflict.response.status).toBe(400);
    expect(conflict.writes).toHaveLength(0);
    const invalid = await publish({
      ...post,
      publishedAt: "2026-09-07T25:00:00-05:00",
    });
    expect(invalid.response.status).toBe(400);
    expect(invalid.writes).toHaveLength(0);
  });
});
