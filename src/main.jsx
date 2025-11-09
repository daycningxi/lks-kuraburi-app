// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// 💡 แก้ Path ให้ชี้ตรงไปที่ index.css (เพราะอยู่ในโฟลเดอร์เดียวกัน)
import './index.css'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);