import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: 'Pockitt/wwwroot',
  plugins: [tailwindcss()],
  build: {
    outDir: '.',
    emptyOutDir: false,
  },
  server: {
    host: true,
    proxy: {
      '/hub': {
        target: 'http://localhost:5290',
        ws: true,
      },
    },
  },
})
