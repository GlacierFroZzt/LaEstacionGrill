import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

const versionJsonRaw = fs.readFileSync(path.resolve(import.meta.dirname, 'public/version.json'), 'utf-8')
const versionInfo = JSON.parse(versionJsonRaw)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VERCEL ? '/' : './',
  define: {
    __APP_VERSION_INFO__: JSON.stringify(versionInfo),
  },
  build: {
    target: 'es2020',
    cssMinify: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react/') || id.includes('react-dom/')) {
              return 'vendor-react';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }
        },
      },
    },
  },
})

