// ตัวอย่างการผูก route ใน src/App.jsx
// ปรับ import path ให้ตรงกับตำแหน่งไฟล์จริงในโปรเจกต์ของครู

import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import HomePage from './components/HomePage';
import AdminPortal from './components/AdminPortal';
import RoomCreator from './components/RoomCreator';
import GameMain from './components/GameMain';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPortal />} />
        <Route path="/create-room" element={<RoomCreator />} />
        <Route path="/play" element={<GameMain />} />
      </Routes>
    </BrowserRouter>
  );
}
