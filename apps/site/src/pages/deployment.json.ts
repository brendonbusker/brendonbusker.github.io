import type { APIRoute } from "astro";

// Generated into the same Pages artifact as the content it identifies.
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      version: process.env.GITHUB_SHA || null,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
