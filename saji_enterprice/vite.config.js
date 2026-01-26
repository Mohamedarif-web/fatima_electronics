import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for Electron
  build: {
    target: 'es2017',       // compatible with older Chromium
    cssTarget: 'chrome78',  // safer CSS support
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
