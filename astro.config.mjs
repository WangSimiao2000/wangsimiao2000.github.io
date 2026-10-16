// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://blog.mickeymiao.cn',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
