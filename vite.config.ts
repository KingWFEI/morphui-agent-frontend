import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 前后端连接方式：开发期 /api 请求由 Vite 代理转发到 FastAPI（127.0.0.1:8000），
// 前端代码统一使用相对路径（见 src/api.ts），无需关心后端地址与 CORS。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
