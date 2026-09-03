export type Session = {
  authenticated: boolean;
  csrfToken?: string;
  expiresAt?: string;
};
let csrfToken = "";
export function setCsrf(value?: string) {
  csrfToken = value || "";
}
export async function api<T>(path: string, options: RequestInit = {}) {
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
  const data = (await response
    .json()
    .catch(() => ({
      error: "The server returned an unreadable response.",
    }))) as Record<string, unknown>;
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : `Request failed (${response.status})`,
    );
  return data as T;
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
    }>("/api/publish", {
      method: "POST",
      body: JSON.stringify({ contentType, payload, ...options }),
    }),
};
export const publishedApi = {
  one: <T>(type: "homepage" | "resume") =>
    api<PublishedItem<T>>(`/api/published/${type}`),
  collection: <T>(type: "posts" | "projects") =>
    api<{ items: Array<PublishedItem<T>> }>(`/api/published/${type}`),
};
