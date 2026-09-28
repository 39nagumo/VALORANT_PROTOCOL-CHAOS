import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        // ルーム用の同期サーバー（worker/ で `npm run dev`）へ中継する
        proxy: {
            '/rs': { target: 'http://127.0.0.1:8787', ws: true },
        },
    },
})
