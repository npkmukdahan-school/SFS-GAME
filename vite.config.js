// vite.config.js สำหรับ deploy บน GitHub Pages repository ชื่อ SFS-GAME
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/SFS-GAME/',
});
