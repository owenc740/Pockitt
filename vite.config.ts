import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    root: 'Pockitt/wwwroot',
    build: {
        outDir: '../../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'Pockitt/wwwroot/index.html'),
                chat: resolve(__dirname, 'Pockitt/wwwroot/chat.html'),
            }
        }
    },
    server: {
        port: 5173,
        host: '0.0.0.0',
        proxy: {
            '/hub': {
                target: 'http://localhost:5290',
                ws: true,
                changeOrigin: true
            }
        }
    }
});