// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Path เดิม
    // 💡 เพิ่มการชี้ไปที่ App.jsx โดยตรง
    "./src/App.jsx" // <--- เพิ่มบรรทัดนี้
  ],
  // ...
}