import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// 1. استيراد مكتبة التحليلات
import { Analytics } from "@vercel/analytics/react"

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* 2. إضافة مكون التحليلات ليعمل في الخلفية */}
    <Analytics />
  </StrictMode>,
)