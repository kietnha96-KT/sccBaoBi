import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate': SW mới tự kích hoạt + tự reload khi có bản deploy mới.
      // (Đổi từ 'prompt' sang 'autoUpdate' để tự chữa các SW cũ bị kẹt cache hỏng:
      //  prompt cần người dùng bấm nút, mà giao diện hỏng thì không bấm được.)
      registerType: 'autoUpdate',
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
        // SW mới bỏ qua trạng thái "waiting", vào hoạt động ngay -> kèm autoUpdate sẽ tự reload.
        skipWaiting: true,
        // Không rơi về index.html cho request tài nguyên (assets) khi điều hướng SPA
        navigateFallbackDenylist: [/^\/api\//, /^\/assets\//],
        // KHÔNG khai báo runtimeCaching cho /api/* - trước đây có rule NetworkOnly ở đây
        // (không cache gì) nhưng khai báo rule là request VẪN bị Service Worker chặn lại,
        // tự gọi fetch() riêng trong luồng của nó rồi mới trả về cho trang - tốn thêm
        // ~400-500ms/request (đo được trong DevTools: mỗi API call hiện 2 dòng, 1 "xhr" từ
        // trang + 1 "fetch" từ workbox, dòng đầu luôn lâu hơn dòng sau đúng bằng phần overhead
        // này) mà không được lợi gì vì NetworkOnly vốn không cache. Không khai báo rule nào
        // -> Workbox không match -> không respondWith() -> trình duyệt tự fetch thẳng, không
        // qua Service Worker, hành vi bên ngoài (luôn ra network thật, không cache) y hệt cũ.
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
