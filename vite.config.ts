import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

// The overlay SPA lives in ./overlay and is the only thing Vite builds.
// PostCSS/Tailwind configs live at the streamkit root, so point Vite at them explicitly.
export default defineConfig({
  root: fileURLToPath(new URL('./overlay', import.meta.url)),
  plugins: [vue()],
  css: {
    postcss: fileURLToPath(new URL('./', import.meta.url)),
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: fileURLToPath(new URL('./overlay-dist', import.meta.url)),
    emptyOutDir: true,
  },
})
