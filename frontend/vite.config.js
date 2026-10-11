import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '..',
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
          if (id.includes('/@supabase/')) return 'supabase-vendor';
          if (id.includes('/react-router/')) return 'router-vendor';
          if (id.includes('/lucide-react/')) return 'icons-vendor';
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts-vendor';
          return undefined;
        },
      },
    },
  },
});
