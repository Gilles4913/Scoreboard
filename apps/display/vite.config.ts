import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: { 
    port: 5174,
    host: true,
    strictPort: true
  },
  envDir: resolve(__dirname, '../../'),
  resolve: {
    alias: {
      '@pkg/logic': resolve(__dirname, '../../packages/logic/src'),
      '@pkg/types': resolve(__dirname, '../../packages/types/src'),
      '@pkg/supa': resolve(__dirname, '../../packages/supa/src'),
    },
  },
});
