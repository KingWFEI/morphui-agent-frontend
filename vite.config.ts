import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 前后端连接方式：开发期 /api 请求和 WebSocket 连接由 Vite 转发到 FastAPI（127.0.0.1:8000）。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
