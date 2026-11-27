import { defineConfig, loadEnv } from 'vite';
import { seo, pages } from './seo.js';

export default defineConfig(({ mode }) => ({
  plugins: [seo(loadEnv(mode, process.cwd(), ''))],
  build: { rollupOptions: { input: Object.keys(pages) } },
}));
