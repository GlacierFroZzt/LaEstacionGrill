import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Configuración de Vite para el Monitor Privado de Logs
export default defineConfig({
  base: process.env.VERCEL ? '/' : './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
  },
  build: {
    target: 'es2020',
    cssMinify: true,
  },
})
