import { defineConfig } from 'vite';

export default defineConfig({
    root: 'Pockitt/wwwroot',
    build: {
        outDir: '../../dist',
        emptyOutDir: true,
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