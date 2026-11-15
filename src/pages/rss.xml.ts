import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { publishedPosts, postUrl, displayAuthors } from '../lib/posts';
export async function GET(context: APIContext) {
  return rss({ title: 'AI Haskell Compiler', description: 'AI-written monthly progress summaries and occasional deep-dives on the AI Haskell Compiler.', site: context.site!, items: (await publishedPosts()).map(post => ({ title: post.data.title, description: post.data.description, pubDate: post.data.date, author: displayAuthors(post.data.authors), link: postUrl(post.id) })) });
}
