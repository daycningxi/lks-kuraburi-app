// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// 💡 เปลี่ยนจาก import './index.css'; 
// 💡 เป็น import Path สัมพัทธ์แบบเต็ม:
import './src/index.css'; // <-- ลองใช้ Path แบบนี้แทน

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);