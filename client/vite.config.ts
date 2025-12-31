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
                '/meteora-api': {
                    target: 'https://dlmm-api.meteora.ag',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/meteora-api/, ''),
                    secure: false,
                },
                '/raydium-api': {
                    target: 'https://api-v3.raydium.io',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/raydium-api/, ''),
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
        },
        build: {
            rollupOptions: {
                // These are optional SDKs loaded dynamically at runtime
                // Mark as external to prevent build errors when not installed
                external: [
                    '@meteora-ag/dlmm',
                    '@raydium-io/raydium-sdk-v2'
                ],
                output: {
                    // Provide a way to load these at runtime if they exist
                    globals: {
                        '@meteora-ag/dlmm': 'MeteoraDLMM',
                        '@raydium-io/raydium-sdk-v2': 'RaydiumSDK'
                    }
                }
            }
        }
    };
});
