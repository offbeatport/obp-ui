import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getRobots = createServerFn().handler(async () => {
  const base = process.env.BETTER_AUTH_URL ?? "https://liveaipulse.com";
  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;
});

export const Route = createFileRoute("/robots.txt")({
  loader: () => getRobots(),
  component: () => null,
  headers: () => ({ "Content-Type": "text/plain" }),
});
