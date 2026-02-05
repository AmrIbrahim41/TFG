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
      }
    },
  },
  plugins: [],
}