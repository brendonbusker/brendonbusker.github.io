import { afterEach, describe, expect, it, vi } from "vitest";
import { getDeploymentStatus } from "./deployment";
import worker from "./index";

const version = "a".repeat(40);
const later = "b".repeat(40);
function setup({
  marker = "",
  runs = [] as Array<{
    id: number;
    head_sha: string;
    status: string;
    conclusion: string | null;
  }>,
  relation = "ahead",
  unavailable = false,
} = {}) {
  const env = {
    GITHUB_OWNER: "owner",
    GITHUB_REPO: crypto.randomUUID(),
    GITHUB_BRANCH: "main",
    GITHUB_TOKEN: "private-token",
    PUBLIC_SITE_URL: `https://${crypto.randomUUID()}.example.com`,
  };
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.includes("deployment.json")) {
      expect(options?.headers).not.toHaveProperty("Authorization");
      return Response.json({ version: marker });
    }
    if (url.includes("/compare/")) return Response.json({ status: relation });
    expect(url).toContain("/actions/workflows/pages.yml/runs?branch=main");
    expect(options?.headers).not.toHaveProperty("Authorization");
    return unavailable
      ? new Response("rate limited", { status: 403 })
      : Response.json({ workflow_runs: runs });
  });
  vi.stubGlobal("fetch", fetcher);
  return { env, fetcher };
}
const run = (
  status: string,
  conclusion: string | null = null,
  head = version,
) => ({ id: 123, head_sha: head, status, conclusion });
describe("deployment tracking", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("only confirms live when the deployed artifact includes the publication", async () => {
    for (const marker of [version, later]) {
      const { env } = setup({ marker });
      expect((await getDeploymentStatus(env, version)).state).toBe("live");
    }
    const { env } = setup({
      marker: later,
      relation: "behind",
      runs: [run("completed", "success")],
    });
    expect((await getDeploymentStatus(env, version)).state).toBe("building");
  });
  it("distinguishes queued, running, failed and cancelled builds", async () => {
    for (const [status, conclusion, state] of [
      ["queued", null, "waiting"],
      ["in_progress", null, "building"],
      ["completed", "failure", "failed"],
      ["completed", "cancelled", "cancelled"],
    ] as const) {
      const { env } = setup({ runs: [run(status, conclusion)] });
      const result = await getDeploymentStatus(env, version);
      expect(result.state).toBe(state);
      expect(result.detailsUrl).toBe(
        `https://github.com/owner/${env.GITHUB_REPO}/actions/runs/123`,
      );
    }
  });
  it("follows a newer build containing a cancelled publication", async () => {
    const { env } = setup({
      runs: [run("in_progress", null, later), run("completed", "cancelled")],
    });
    expect((await getDeploymentStatus(env, version)).state).toBe("building");
  });
  it("does not follow an unrelated newer successful build", async () => {
    const { env } = setup({
      relation: "diverged",
      runs: [run("completed", "success", later), run("completed", "failure")],
    });
    expect((await getDeploymentStatus(env, version)).state).toBe("failed");
  });
  it("waits when the workflow has not appeared and caches public metadata", async () => {
    const { env, fetcher } = setup();
    expect((await getDeploymentStatus(env, version)).state).toBe("waiting");
    await getDeploymentStatus(env, version);
    expect(
      fetcher.mock.calls.filter(([url]) => url.includes("/actions/")),
    ).toHaveLength(1);
  });
  it("reports unavailable status without inventing a failed deployment", async () => {
    const { env } = setup({ unavailable: true });
    await expect(getDeploymentStatus(env, version)).rejects.toThrow(
      "temporarily unavailable",
    );
  });
  it("requires a session and rejects malformed versions before external reads", async () => {
    const { env, fetcher } = setup();
    let row: object | null = null;
    const bindings = {
      ...env,
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
    expect(
      (await worker.request(`/api/deployment/${version}`, {}, bindings)).status,
    ).toBe(401);
    const future = new Date(Date.now() + 3600000).toISOString();
    row = {
      id: "session",
      last_seen_at: new Date().toISOString(),
      expires_at: future,
      absolute_expires_at: future,
    };
    expect(
      (
        await worker.request(
          "/api/deployment/not-a-sha",
          { headers: { Cookie: "__Host-admin_session=test" } },
          bindings,
        )
      ).status,
    ).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
