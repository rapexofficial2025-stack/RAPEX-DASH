import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://rapexofficial2025-stack.github.io/rapex-dash/
export default defineConfig({
  base: '/rapex-dash/',
  plugins: [react()],
})
