type DeploymentEnv = {
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  GITHUB_TOKEN: string;
  PUBLIC_SITE_URL: string;
};
type Run = {
  id: number;
  head_sha: string;
  status: string;
  conclusion: string | null;
};
export type DeploymentStatus = {
  state: "waiting" | "building" | "live" | "failed" | "cancelled";
  message: string;
  detailsUrl?: string;
};
const cache = new Map<string, { expires: number; data: unknown }>();
async function read<T>(
  url: string,
  headers: Record<string, string> = {},
): Promise<T> {
  const saved = cache.get(url);
  if (saved && saved.expires > Date.now()) return saved.data as T;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Brendon-Busker-CMS",
      ...headers,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error("Deployment status is temporarily unavailable.");
  const data: unknown = await response.json();
  if (cache.size >= 60) cache.delete(cache.keys().next().value!);
  cache.set(url, { data, expires: Date.now() + 30000 });
  return data as T;
}
export async function getDeploymentStatus(
  env: DeploymentEnv,
  version: string,
): Promise<DeploymentStatus> {
  const repo = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
  const includes = async (head: string) => {
    if (head === version) return true;
    if (!/^[a-f0-9]{40}$/i.test(head)) return false;
    const comparison = await read<{ status: string }>(
      `${repo}/compare/${version}...${head}?per_page=1`,
      {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      },
    );
    return comparison.status === "ahead" || comparison.status === "identical";
  };
  // Confirm the deployed artifact, not just a green build. A later build may
  // contain this commit when Pages cancels an earlier run in favor of a new one.
  let live: { version?: string } | undefined;
  try {
    const url = new URL(
      "deployment.json",
      env.PUBLIC_SITE_URL.replace(/\/?$/, "/"),
    );
    url.searchParams.set("check", String(Math.floor(Date.now() / 30000)));
    live = await read<{ version?: string }>(url.href);
  } catch {
    /* A missing marker or CDN delay is not evidence of a live publish. */
  }
  if (live?.version && (await includes(live.version)))
    return { state: "live", message: "Your changes are live on the website." };

  // Public Actions metadata needs no additional permissions on the publishing token.
  const { workflow_runs: runs } = await read<{ workflow_runs: Run[] }>(
    `${repo}/actions/workflows/pages.yml/runs?branch=${encodeURIComponent(env.GITHUB_BRANCH)}&per_page=20`,
  );
  const exact = runs.find((run) => run.head_sha === version);
  const newest = runs[0];
  const run = newest && (await includes(newest.head_sha)) ? newest : exact;
  if (!run)
    return {
      state: "waiting",
      message: "Changes saved. Waiting for the website build to start.",
    };
  const detailsUrl = `https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/runs/${run.id}`;
  if (run.status !== "completed")
    return {
      state: run.status === "in_progress" ? "building" : "waiting",
      message:
        run.status === "in_progress"
          ? "Building and deploying your changes…"
          : "Changes saved. The website build is queued.",
      detailsUrl,
    };
  if (run.conclusion === "success")
    return {
      state: "building",
      message: "Deployment finished. Checking that the website has updated…",
      detailsUrl,
    };
  if (run.conclusion === "cancelled")
    return {
      state: "cancelled",
      message:
        "This build was cancelled. A newer publish may replace it. Check again shortly.",
      detailsUrl,
    };
  return {
    state: "failed",
    message:
      "The website deployment did not finish successfully. Your changes are saved in GitHub. Open build details to investigate.",
    detailsUrl,
  };
}
