import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', proxyRequest => proxyRequest.removeHeader('origin'))
        }
      },
      '/ai-api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/ai-api/, '/api')
      }
    }
  }
})
