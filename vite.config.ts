import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <-- This import is needed

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss()
  ],
  // This is required to help Vite's dev server find the driver.js module.
  optimizeDeps: { include: ['driver.js'] },
})