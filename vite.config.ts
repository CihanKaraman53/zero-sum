import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    open: true,
    host: true, // 0.0.0.0 — wifi'deki telefondan da erişilebilir
  },
  build: {
    assetsInlineLimit: 0, // Ensure assets aren't inlined as base64 to keep things clean if needed
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) {
            return 'phaser';
          }
        }
      }
    }
  }
});
