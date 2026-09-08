import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { postUrl } from '@brendon/shared';
export async function GET(context){const posts=(await getCollection('posts',({data})=>data.status==='published')).sort((a,b)=>Date.parse(b.data.publishedAt)-Date.parse(a.data.publishedAt));return rss({title:'Blog — Brendon Busker',description:'Posts about projects, experiments, and ideas.',site:context.site,items:posts.map(post=>({title:post.data.title,pubDate:new Date(post.data.publishedAt),description:post.data.excerpt,link:postUrl(post.data.publishedAt, post.data.slug)}))});}
