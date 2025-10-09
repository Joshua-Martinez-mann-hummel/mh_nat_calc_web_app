// This is the corrected version
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <-- This import is needed

export default defineConfig({
  plugins: [react(), tailwindcss()], // <-- The plugin must be added here
})