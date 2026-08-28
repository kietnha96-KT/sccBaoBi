import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': KHÔNG tự reload (tránh mất dữ liệu khi nhân viên đang nhập báo cáo).
      // Khi có bản mới, hiện nút nhỏ cạnh "Đăng xuất" để người dùng bấm tải lại.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'SCC Bao Bi - Quản lý báo cáo lựa vật tư',
        short_name: 'SCC Bao Bi',
        description: 'Hệ thống quản lý báo cáo lựa vật tư, dashboard năng suất - SCC Bao Bi',
        lang: 'vi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f5f6f8',
        theme_color: '#111827',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Dọn cache của các bản build cũ ngay khi SW mới kích hoạt.
        cleanupOutdatedCaches: true,
        // SW mới giành quyền điều khiển mọi tab ngay khi active (không cần đóng hết tab).
        clientsClaim: true,
        // KHÔNG bật skipWaiting ở đây (sẽ tự cập nhật ngầm như cũ). Việc "skip waiting"
        // do nút bấm trong app kích hoạt qua updateServiceWorker(true) -> SW mới vào ngay.
        skipWaiting: false,
        // Không cache API (dữ liệu báo cáo/dashboard luôn cần mới nhất) - chỉ cache app shell (JS/CSS/HTML)
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
