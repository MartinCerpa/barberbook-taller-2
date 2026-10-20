import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  plugins: [react()],
})
