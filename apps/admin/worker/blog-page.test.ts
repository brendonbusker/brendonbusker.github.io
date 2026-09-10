import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

const path = "apps/site/src/data/blog-page.json";
const content = {
  schemaVersion: 1,
  eyebrow: "Journal",
  headline: "Things on my mind.",
  description: "A place for everyday stories.",
};

describe("blog page introduction API", () => {
  afterEach(() => vi.unstubAllGlobals());
  async function request(payload?: unknown, expectedSha = "current-sha") {
    const now = Date.now();
    const csrf = Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode("csrf")),
    ).toString("base64");
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
      GITHUB_OWNER: "owner",
      PUBLIC_SITE_URL: "https://site.example.com",
      GITHUB_REPO: "repo",
      GITHUB_BRANCH: "main",
      GITHUB_TOKEN: "test",
      IP_HASH_SECRET: "test",
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
    const writes: Array<{
      url: string;
      payload: { content: string; sha: string; message: string };
    }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        expect(url).toContain(`/contents/${path}`);
        if (options?.method === "PUT") {
          writes.push({ url, payload: JSON.parse(String(options.body)) });
          return Response.json({
            content: { path, sha: "next-sha" },
            commit: { sha: "commit", html_url: "https://github.test/commit" },
          });
        }
        return Response.json({
          type: "file",
          path,
          sha: "current-sha",
          content: Buffer.from(JSON.stringify(content)).toString("base64"),
        });
      }),
    );
    const response = await worker.request(
      payload ? "/api/publish" : "/api/published/blog-page",
      {
        method: payload ? "POST" : "GET",
        headers: {
          Origin: env.ADMIN_ORIGIN,
          Cookie: "__Host-admin_session=test",
          "X-CSRF-Token": "csrf",
          "Content-Type": "application/json",
        },
        ...(payload
          ? {
              body: JSON.stringify({
                contentType: "blogPage",
                payload,
                expectedSha,
              }),
            }
          : {}),
      },
      env,
    );
    return { response, writes };
  }
  it("loads the latest published introduction through its allowlisted singleton path", async () => {
    const { response, writes } = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      content,
      path,
      sha: "current-sha",
    });
    expect(writes).toHaveLength(0);
  });
  it("publishes validated fields using the loaded SHA, independently of posts", async () => {
    const edited = { ...content, headline: "My blog." };
    const { response, writes } = await request(edited);
    expect(response.status).toBe(200);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.payload.sha).toBe("current-sha");
    expect(writes[0]!.payload.message).toBe(
      "cms: update blog page introduction",
    );
    expect(
      JSON.parse(Buffer.from(writes[0]!.payload.content, "base64").toString()),
    ).toEqual(edited);
  });
  it("rejects invalid copy and stale versions before writing", async () => {
    for (const [payload, sha] of [
      [{ ...content, headline: "" }, "current-sha"],
      [content, "outdated-sha"],
    ] as const) {
      const { response, writes } = await request(payload, sha);
      expect(response.status).toBe(400);
      expect(writes).toHaveLength(0);
    }
  });
});
