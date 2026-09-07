import { getCollection, type CollectionEntry } from 'astro:content';
export type Post = CollectionEntry<'posts'>;
export async function publishedPosts() {
  return (await getCollection('posts', ({ data }) => !data.draft && data.date <= new Date()))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
export const postUrl = (id: string) => `/posts/${id.split('/').map(encodeURIComponent).join('/')}/`;
export const displayDate = (date: Date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const readingTime = (body = '') => `${Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 230))} min read`;
