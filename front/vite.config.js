import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // فصل مكتبات الـ PDF
          if (id.includes('@react-pdf') || id.includes('jspdf') || id.includes('html2pdf')) {
            return 'pdf-vendor';
          }
          // فصل مكتبة الرسوم البيانية
          if (id.includes('recharts')) {
            return 'charts-vendor';
          }
          // فصل باقي مكتبات React الأساسية
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
})