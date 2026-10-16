import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Chunk lớn nhất là bộ xuất PDF (~230 kB gzip), chỉ tải khi bấm Xuất PDF ở màn Phả đồ.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // Tách thư viện ra chunk riêng để trình duyệt cache lâu dài giữa các lần deploy.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            // Thư viện Excel chỉ nạp khi nhập/xuất, không gộp vào vendor.
            { name: 'excel', test: /node_modules[\\/](read-excel-file|write-excel-file|fflate|unzipper|@xmldom)[\\/]/ },
            // Bộ xuất PDF (jsPDF và các thư viện nó tự nạp khi cần) chỉ tải ở màn Phả đồ.
            {
              name: 'pdf',
              test: /node_modules[\\/](jspdf|fast-png|iobuffer|pako|@babel[\\/]runtime|canvg|html2canvas|dompurify|core-js|raf|rgbcolor|stackblur-canvas|svg-pathdata|performance-now)[\\/]/,
            },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
});
