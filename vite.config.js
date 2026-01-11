import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['tus-js-client', 'hls.js'],
  },
  build: {
    commonjsOptions: {
      include: [/tus-js-client/, /hls\.js/, /node_modules/],
    },
  },
})
