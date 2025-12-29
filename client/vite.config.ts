import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
            fs: {
                allow: [
                    // Allow serving files from one level up to the project root
                    '..',
                ],
            },
            proxy: {
                '/hl-api': {
                    target: 'https://api.hyperliquid-testnet.xyz',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/hl-api/, ''),
                    secure: false,
                },
                '/polymarket-api': {
                    target: 'https://clob.polymarket.com',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/polymarket-api/, ''),
                    secure: false,
                },
            },
        },
        plugins: [
            react(),
            nodePolyfills({
                include: ['crypto', 'os', 'stream', 'util', 'buffer', 'process', 'vm'],
                globals: {
                    Buffer: true,
                    global: true,
                    process: true,
                },
                protocolImports: true,
            }),
        ],
        define: {
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'global': 'globalThis',
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
                'adapters': path.resolve(__dirname, '../adapters'),
                'core': path.resolve(__dirname, '../core'),
                'infra': path.resolve(__dirname, '../infra'),
                process: 'process/browser',
                stream: 'stream-browserify',
                zlib: 'browserify-zlib',
                util: 'util',
                buffer: 'buffer',
                assert: 'assert',
            },
        }
    };
});
