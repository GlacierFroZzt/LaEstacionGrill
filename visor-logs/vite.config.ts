import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Configuración de Vite para el Monitor Privado de Logs
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
  },
  build: {
    target: 'es2020',
    cssMinify: true,
  },
})
