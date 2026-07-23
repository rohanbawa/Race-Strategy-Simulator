import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Override with ML_TARGET=http://localhost:8001 to point the dev proxy at an alternate
// ML service instance; defaults to the standard port 8000.
const mlTarget = process.env.ML_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        configure: (proxy) => {
          // The Spring backend's CORS whitelists specific origins. When Vite runs on a
          // non-whitelisted port (e.g. 5174 because 5173 was already taken), a same-origin
          // POST still carries an Origin header, which the backend would 403. Normalize it
          // to a whitelisted origin so the dev proxy works regardless of Vite's actual port.
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('origin', 'http://localhost:5173')
          })
        }
      },
      // The Python ML service (FastAPI) serves its routes at the root; strip the
      // /ml prefix the frontend uses to keep the two backends on separate paths.
      '/ml': {
        target: mlTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ml/, '')
      }
    }
  }
})
