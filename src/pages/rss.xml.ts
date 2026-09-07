import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { publishedPosts, postUrl } from '../lib/posts';
export async function GET(context: APIContext) {
  return rss({ title: 'AI Haskell Compiler', description: 'Notes on Haskell, compilers, and building with AI.', site: context.site!, items: (await publishedPosts()).map(post => ({ title: post.data.title, description: post.data.description, pubDate: post.data.date, link: postUrl(post.id) })) });
}
