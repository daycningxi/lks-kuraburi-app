// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    // 💡 โค้ดที่เจาะจงไฟล์ .jsx ที่มี Class ทั้งหมด
    "./src/**/*.{js,ts,jsx,tsx}", 
    "./src/App.jsx" // 👈 ชี้ไปที่ไฟล์หลักโดยตรง
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}