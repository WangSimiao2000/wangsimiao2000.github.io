import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import pagefind from 'astro-pagefind';
import AstroPWA from '@vite-pwa/astro';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { rehypeCdnAssets } from './src/utils/rehype-cdn-assets';

export default defineConfig({
  site: 'https://blog.mickeymiao.cn',
  output: 'static',

  vite: {
    build: {
      rollupOptions: {
        external: ['/pagefind/pagefind.js'],
      },
    },
  },

  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex, rehypeCdnAssets],
    // Mermaid diagrams are rendered client-side via the mermaid package
  },

  integrations: [
    sitemap(),
    pagefind(),
    AstroPWA({
      registerType: 'prompt',
      manifest: {
        name: 'MickeyMiao Blog',
        short_name: 'MickeyMiao',
        description: 'MickeyMiao 的个人博客',
        theme_color: '#f8f9fa',
        background_color: '#f8f9fa',
        display: 'standalone',
        icons: [
          {
            src: '/assets/img/avatar/avatar-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/assets/img/avatar/avatar-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,css,js,png,jpg,svg,woff2}'],
      },
    }),
  ],
});
