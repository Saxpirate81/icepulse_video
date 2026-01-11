import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['tus-js-client', 'hls.js'],
  },
  resolve: {
    dedupe: ['tus-js-client', 'hls.js'],
    preserveSymlinks: false,
  },
  build: {
    commonjsOptions: {
      include: [/tus-js-client/, /hls\.js/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
