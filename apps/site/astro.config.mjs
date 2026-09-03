import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
export default defineConfig({ site: process.env.PUBLIC_SITE_URL || 'https://brendonbusker.github.io', output: 'static', integrations: [sitemap()], markdown: { shikiConfig: { theme: 'github-light' } }, build: { format: 'directory' }, devToolbar: { enabled: false } });
