import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    open: true
  },
  build: {
    assetsInlineLimit: 0, // Ensure assets aren't inlined as base64 to keep things clean if needed
    chunkSizeWarningLimit: 1500
  }
});
