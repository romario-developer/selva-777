import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// "npm run build"        -> build normal (pasta dist/) para GitHub Pages, Cloudflare etc.
// "npm run build:single" -> tudo num único index.html (útil para compartilhar um arquivo só)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
}));
