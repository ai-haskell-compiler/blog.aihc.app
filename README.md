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

## Automatic deployment with GitHub Actions

Every push to `main` checks and builds the site, then deploys it to Cloudflare.
Pull requests run checks and a deployment dry run without production credentials.

Configure these repository Actions secrets (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_ACCOUNT_ID`: the account containing the `aihc.app` zone.
- `CLOUDFLARE_API_TOKEN`: a dedicated Cloudflare deployment API token.

The deployment token has Workers Scripts Write permission for the hosting
account. It can modify other Workers in that account too. Wrangler's local OAuth login is
not a substitute for a CI API token. Never commit tokens or put them in workflow files.

The committed Wrangler configuration serves `dist/` and attaches `blog.aihc.app`
as a custom domain. Cloudflare manages DNS and TLS. CI uploads a version tagged
with its run ID and deploys that exact version to all traffic, preserving domain
routing. Changes to domain routing require a manual `npm run deploy` using a
login with zone permissions. GitHub Actions owns deployment;
leave Workers Builds disconnected to avoid duplicate deployments.

For a manual deployment, authenticate with `npx wrangler login` and run `npm run deploy`.
Revert and push a commit to roll back both source and deployment.
