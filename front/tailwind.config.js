/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', 
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          500: '#f97316',
          600: '#ea580c',
          900: '#7c2d12',
        },
        // تعديل درجات الرمادي لتكون "صريحة" وتلغي الأبيض
        zinc: {
          50: '#dcdcdd',  // رمادي فاتح (بديل الأبيض للكروت والسايدبار) - Light Concrete
          100: '#c8c8ca', // رمادي واضح (للخلفية العامة) - Medium Concrete
          200: '#bcbcbe', // رمادي للحدود الخفيفة
          300: '#A1A1AA', // رمادي معدني للحدود الواضحة (Crisp Borders)
          400: '#71717A',
          500: '#52525B',
          600: '#3F3F46',
          700: '#27272A',
          800: '#18181B',
          900: '#09090B', // للخلفية الداكنة جداً
          950: '#000000',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      // 👇 الإضافات الجديدة الخاصة بالحركة (Animations)
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in-right':'slideInRight 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      // 👆 نهاية الإضافات
    },
  },
  plugins: [],
}