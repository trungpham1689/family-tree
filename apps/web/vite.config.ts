import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Tách thư viện ra chunk riêng để trình duyệt cache lâu dài giữa các lần deploy.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            // Thư viện Excel chỉ nạp khi nhập/xuất, không gộp vào vendor.
            { name: 'excel', test: /node_modules[\\/](read-excel-file|write-excel-file|fflate|unzipper|@xmldom)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
});
