// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// 💡 ไม่มี import CSS ที่นี่แล้ว! (เพราะ Style อยู่ใน App.jsx แล้ว)

ReactDOM.createRoot(document.getElementById('root')).render(
  // 💡 โครงสร้างต้องสมบูรณ์
  <React.StrictMode>
    <App />
  </React.StrictMode>,
); // 💡 ต้องมีวงเล็บปิดและเซมิโคลอนตรงนี้!