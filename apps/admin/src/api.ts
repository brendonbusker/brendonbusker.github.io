import { publishing } from "./publishing";
export type Session = {
  authenticated: boolean;
  csrfToken?: string;
  expiresAt?: string;
};
let csrfToken = "";
let sessionGeneration = 0;
let authenticationRequired = false;
const authenticationListeners = new Set<(required: boolean) => void>();
function requireAuthentication(required: boolean) {
  if (authenticationRequired === required) return;
  authenticationRequired = required;
  authenticationListeners.forEach((listener) => listener(required));
}
export function subscribeAuthentication(listener: (required: boolean) => void) {
  authenticationListeners.add(listener);
  listener(authenticationRequired);
  return () => {
    authenticationListeners.delete(listener);
  };
}
export function setCsrf(value?: string) {
  csrfToken = value || "";
  sessionGeneration += 1;
  requireAuthentication(false);
}
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function api<T>(path: string, options: RequestInit = {}) {
  const protectedRequest = ![
    "/api/auth/login",
    "/api/session",
    "/api/config",
  ].includes(path);
  const requestGeneration = sessionGeneration;
  if (
    protectedRequest &&
    authenticationRequired &&
    options.method &&
    !["GET", "HEAD"].includes(options.method)
  )
    throw new ApiError(
      "Your session has expired. Sign in again to save your work.",
      401,
    );
  const tracksPublish =
    (options.method === "POST" && path.startsWith("/api/publish")) ||
    (options.method === "DELETE" &&
      ["/api/published/posts", "/api/published/recipes"].includes(path));
  const id = tracksPublish ? crypto.randomUUID() : null;
  if (id)
    publishing.set({
      id,
      state: "publishing",
      message: "Sending your changes to GitHub…",
    });
  try {
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    if (options.method && options.method !== "GET")
      headers.set("X-CSRF-Token", csrfToken);
    const response = await fetch(path, {
      ...options,
      headers,
      credentials: "same-origin",
    });
    const data = (await response.json().catch(() => ({
      error: "The server returned an unreadable response.",
    }))) as Record<string, unknown>;
    if (!response.ok) {
      const expiredSecurityToken =
        response.status === 403 &&
        (data.code === "csrf_expired" ||
          data.error === "Security token expired. Refresh and try again.");
      if (
        (response.status === 401 || expiredSecurityToken) &&
        protectedRequest &&
        requestGeneration === sessionGeneration
      )
        requireAuthentication(true);
      if (expiredSecurityToken)
        data.error =
          "Your security token has expired. Sign in again to save your work.";
      throw new ApiError(
        typeof data.error === "string"
          ? data.error
          : `Request failed (${response.status})`,
        response.status,
      );
    }
    if (id) {
      if (
        typeof data.version === "string" &&
        /^[a-f0-9]{40}$/i.test(data.version) &&
        typeof data.publicUrl === "string"
      )
        publishing.update(id, {
          version: data.version,
          publicUrl: data.publicUrl,
          state: "waiting",
          message: "Changes saved. Waiting for the website build…",
        });
      else
        publishing.update(id, {
          state: "unavailable",
          message:
            "Changes saved, but deployment tracking is unavailable for this publication.",
        });
    }
    return data as T;
  } catch (error) {
    if (id)
      publishing.update(id, {
        state: "failed",
        message:
          "Publication could not be confirmed. Review the editor message and reload the published content before trying again.",
      });
    throw error;
  }
}
export type PublishedItem<T> = { content: T; path: string; sha: string };
export type PublishOptions = { expectedSha?: string; targetPath?: string };
export const draftsApi = {
  list: () =>
    api<{
      drafts: Array<{
        id: string;
        content_type: string;
        content_key: string;
        updated_at: string;
        payload_json: string;
      }>;
    }>("/api/drafts"),
  get: <T>(type: string, key: string) =>
    api<{ draft: T | null }>(`/api/drafts/${type}/${encodeURIComponent(key)}`),
  save: (body: unknown) =>
    api<{ savedAt: string }>("/api/drafts", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (type: string, key: string) =>
    api("/api/drafts/" + type + "/" + encodeURIComponent(key), {
      method: "DELETE",
    }),
  publish: (
    contentType: string,
    payload: unknown,
    options: PublishOptions = {},
  ) =>
    api<{
      commitUrl: string;
      version: string;
      contentSha: string;
      path: string;
      publishedAt?: string;
    }>("/api/publish", {
      method: "POST",
      body: JSON.stringify({ contentType, payload, ...options }),
    }),
};
export const publishedApi = {
  one: <T>(
    type: "homepage" | "resume" | "appearance" | "projects-page" | "blog-page",
  ) => api<PublishedItem<T>>(`/api/published/${type}`),
  collection: <T>(type: "posts" | "projects" | "recipes") =>
    api<{ items: Array<PublishedItem<T>> }>(`/api/published/${type}`),
  removePost: (input: {
    path: string;
    expectedSha: string;
    contentKey: string;
    title: string;
  }) =>
    api<{ commitUrl: string; version: string }>("/api/published/posts", {
      method: "DELETE",
      body: JSON.stringify(input),
    }),
  removeRecipe: (input: {
    path: string;
    expectedSha: string;
    contentKey: string;
    title: string;
  }) =>
    api<{ commitUrl: string; version: string }>("/api/published/recipes", {
      method: "DELETE",
      body: JSON.stringify(input),
    }),
};
