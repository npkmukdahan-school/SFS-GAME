import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// เปลี่ยน base ให้ตรงกับชื่อ repository บน GitHub
// ตัวอย่าง URL: https://USERNAME.github.io/SFS-GAME/
export default defineConfig({
  plugins: [react()],
  base: '/SFS-GAME/',
});
