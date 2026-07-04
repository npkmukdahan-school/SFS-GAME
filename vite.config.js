import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 1. นำเข้าปลั๊กอิน Tailwind v4

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // 2. เปิดใช้งาน Tailwind
  ],
  base: '/SFSGame/', // 3. ตั้งค่า Base URL สำหรับ GitHub Pages (อย่าลืมลูกน้ำตรงนี้ถ้ามีโค้ดต่อ)
})