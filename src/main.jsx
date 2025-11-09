import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// 💡 ลบบรรทัดเดิม และใช้การ Import ใหม่:
// import './index.css'; 
import '../styles.css'; // 👈 นำเข้าไฟล์จาก Root Directory แทน

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);