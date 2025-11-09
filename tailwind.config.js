// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  // 💡 Path นี้คือ Path ที่ Tailwind V3/V4 ใช้ค้นหาไฟล์
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Path ที่ถูกต้องที่สุด
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}