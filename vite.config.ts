import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// "base" must match the repo name so GitHub Pages finds the JS/CSS files
// at https://<user>.github.io/RAPEX-DASH/
export default defineConfig({
  base: '/RAPEX-DASH/',
  plugins: [react()],
})
