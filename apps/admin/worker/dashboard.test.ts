import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { serializeContent } from "./index";
import profile from "../../site/src/data/site.json";

const post = serializeContent("post", {
  id: "1cec15a3-2305-4e97-81e6-7ceb37d8acaf",
  title: "My Admin Page",
  slug: "test",
  publishedAt: "2026-09-10T20:57:06-05:00",
  updatedAt: "2026-09-10",
  body: "Test content",
  status: "published",
}).content;
const project = serializeContent("project", {
  id: "dd36582b-12d3-4ab0-87ed-e96f81cc7503",
  title: "Test project",
  slug: "test",
  summary: "Example",
  published: true,
  icon: "calculator",
  accent: "#315b71",
  techStack: [],
  screenshots: [],
  features: [],
  createdAt: "2026-09-01",
  updatedAt: "2026-09-10",
}).content;
const root = "apps/site/src/content/";

function fixture(options: { empty?: boolean; failHistory?: boolean } = {}) {
  const files: Record<string, string> = {
    "apps/site/src/data/site.json": JSON.stringify(profile),
    ...(!options.empty
      ? {
          [`${root}posts/first.md`]: post
            .replace('"My Admin Page"', '"Earlier same day"')
            .replace("20:57:06-05:00", "09:00:00-05:00"),
          [`${root}posts/latest.md`]: post,
          [`${root}posts/draft.md`]: post
            .replace("status: published", "status: draft")
            .replace("2026-09-10T20:57", "2026-09-11T20:57"),
          [`${root}projects/visible.md`]: project,
          [`${root}projects/hidden.md`]: project.replace(
            "published: true",
            "published: false",
          ),
        }
      : {}),
  };
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    expect(init?.method ?? "GET").toBe("GET");
    const url = new URL(input);
    if (url.pathname.endsWith("/commits")) {
      expect(url.searchParams.get("sha")).toBe("main");
      expect(url.searchParams.get("per_page")).toBe("1");
      const path = url.searchParams.get("path");
      expect([
        "apps/site/src/data/resume.json",
        "apps/site/public/resume/Brendon-Busker-Resume.pdf",
      ]).toContain(path);
      if (options.failHistory)
        return new Response("unavailable", { status: 503 });
      return Response.json(
        options.empty
          ? []
          : [
              {
                commit: {
                  author: { date: "2026-08-31T12:00:00Z" },
                  committer: {
                    date: path!.endsWith(".pdf")
                      ? "2026-09-11T00:05:00Z"
                      : "2026-09-10T23:47:00Z",
                  },
                },
              },
            ],
      );
    }
    expect(url.searchParams.get("ref")).toBe("main");
    const path = url.pathname.split("/contents/")[1]!;
    if (files[path])
      return Response.json({
        type: "file",
        path,
        sha: "test-sha",
        content: Buffer.from(files[path]).toString("base64"),
      });
    return Response.json(
      Object.keys(files)
        .filter((key) => key.startsWith(path + "/"))
        .map((key) => ({ type: "file", path: key, sha: "test-sha" })),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  const env = {
    GITHUB_OWNER: "owner",
    GITHUB_REPO: "repo",
    GITHUB_BRANCH: "main",
    GITHUB_TOKEN: "test",
    SESSION_IDLE_MINUTES: "45",
    DB: {
      prepare: () => ({
        bind() {
          return this;
        },
        first: async () => ({
          id: "session",
          csrf_hash: "unused",
          last_seen_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          absolute_expires_at: new Date(Date.now() + 7200000).toISOString(),
        }),
        run: async () => ({ success: true }),
      }),
    },
  };
  return {
    fetchMock,
    request: (authenticated = true) =>
      worker.request(
        "/api/dashboard",
        {
          headers: authenticated ? { Cookie: "__Host-admin_session=test" } : {},
        },
        env,
      ),
  };
}

describe("current dashboard data", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("selects the latest published timestamp, counts visible projects and reads independent resume commit dates", async () => {
    const { request } = fixture();
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      fullName: profile.fullName,
      timezone: profile.timezone,
      latestPost: { title: "My Admin Page" },
      projectCount: 1,
      webUpdatedAt: "2026-09-10T23:47:00Z",
      pdfUpdatedAt: "2026-09-11T00:05:00Z",
    });
  });
  it("returns explicit empty states without seed content", async () => {
    const { request } = fixture({ empty: true });
    const response = await request();
    expect(await response.json()).toMatchObject({
      latestPost: null,
      projectCount: 0,
      webUpdatedAt: null,
      pdfUpdatedAt: null,
    });
  });
  it("reports upstream failure instead of inventing update dates", async () => {
    const { request } = fixture({ failHistory: true });
    expect((await request()).status).toBe(502);
  });
  it("requires an authenticated session before reading GitHub", async () => {
    const { request, fetchMock } = fixture();
    expect((await request(false)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
