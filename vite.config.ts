import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Keep the dev server on a fixed port so the backend CORS allowlist
    // (localhost/127.0.0.1/LAN-IP on 3000, 4000, 5173) always matches.
    port: 4000,
    strictPort: true,
    watch: {
      // Wait until a file has stopped changing before re-reading it.
      // Without this the dev server can read a half-written module, cache
      // the truncated transform and keep serving stale code until the next
      // edit (or a manual `touch`).
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
    },
  },
  preview: {
    port: 4000,
    strictPort: true,
  },
})
