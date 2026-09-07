# AI Haskell Compiler blog

An Astro static blog for https://blog.aihc.app, hosted on Cloudflare Workers Static Assets.

## Local development

Use Node.js 22.12 or newer. Run `npm ci`, then `npm run dev`.
Run `npm run check` and `npm run build` before pushing.

## Publishing posts

Add a Markdown file under `src/content/posts/`. The filename becomes the URL:
`src/content/posts/my-post.md` → `/posts/my-post/`.

```yaml
---
title: "My post"
description: "A short summary."
date: 2026-09-07
draft: false
---
```

Write the article below the frontmatter. Put images in `public/images/` and
reference them as `/images/example.png`. Drafts and future-dated posts are
excluded from pages, RSS, and the sitemap. A future-dated post requires a new
build after its date; publication is not scheduled automatically.

The included first post is a draft, so the initial site has no published posts.

## Connect Cloudflare (one-time setup)

In Cloudflare Workers & Pages, create/import a Worker from the GitHub repository
`ai-haskell-compiler/blog.aihc.app`. Grant the Cloudflare GitHub integration access
to this repository. Use:

- Worker name: `aihc-blog` (must match `wrangler.jsonc`)
- Production branch: `main`
- Build command: `npm run check && npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root
- Node version: 22 (set `NODE_VERSION=22` if needed)

The committed Wrangler configuration serves `dist/` and attaches `blog.aihc.app`
as a custom domain. The Cloudflare account must contain the active `aihc.app`
zone. Cloudflare manages DNS and TLS for the custom domain.

Enable non-production branch builds in Workers Builds for previews, using
`npx wrangler versions upload` as the non-production deploy command. Verify that
preview URLs are enabled. Preview links may be publicly accessible.

After the connection is configured, every push to `main` builds and deploys.
The GitHub Actions workflow checks the site; deployment is owned by Workers Builds.
Connecting Workers Builds is required; pushing this repository alone does not deploy.

For a manual deployment, authenticate with `npx wrangler login` and run `npm run deploy`.
Revert and push a commit to roll back both source and deployment.
