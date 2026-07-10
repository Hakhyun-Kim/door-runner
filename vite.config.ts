import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages가 /door-runner/ 하위 경로에 배포하므로 상대 경로 사용
  base: './',
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5174,
  },
});
