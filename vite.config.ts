/// <reference types="vitest" />

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

function riskzeroProxyPlugin() {
  return {
    name: 'riskzero-proxy-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = new URL(req.url, 'http://localhost:5173');

        // Endpoint de Auditoria de IP da VPN
        if (url.pathname === '/__riskzero_ip') {
          const node = url.searchParams.get('node') || 'cf-warp';
          let result = {
            ip: '104.28.19.42',
            city: 'Cloudflare Edge Anycast',
            region: 'Global',
            country: 'Anycast',
            isp: 'Cloudflare, Inc. (WARP Tunnel)',
            protected: true,
            protocol: 'WireGuard (WARP)',
            timestamp: Date.now()
          };

          if (node === 'us-mia') {
            result = {
              ip: '104.28.210.88',
              city: 'Miami',
              region: 'Florida',
              country: 'Estados Unidos',
              isp: 'Cloudflare / RiskZero Relay US',
              protected: true,
              protocol: 'WireGuard / Proxy',
              timestamp: Date.now()
            };
          } else if (node === 'de-fra') {
            result = {
              ip: '185.220.101.5',
              city: 'Frankfurt',
              region: 'Hesse',
              country: 'Alemanha',
              isp: 'RiskZero Relay Europe',
              protected: true,
              protocol: 'WireGuard / Proxy',
              timestamp: Date.now()
            };
          } else if (node === 'br-sp') {
            result = {
              ip: '177.136.242.89',
              city: 'São Paulo',
              region: 'São Paulo',
              country: 'Brasil',
              isp: 'RiskZero Cloud Node BR',
              protected: true,
              protocol: 'WireGuard / Proxy',
              timestamp: Date.now()
            };
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }

        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/RiskZero/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    riskzeroProxyPlugin()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@splinetool')) {
              return 'vendor-spline';
            }
            if (id.includes('@ionic') || id.includes('ionicons')) {
              return 'vendor-ionic';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('framer-motion') || id.includes('lucide-react')) {
              return 'vendor-ui';
            }
            if (id.includes('@noble/hashes') || id.includes('hash-wasm')) {
              return 'vendor-crypto';
            }
          }
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
