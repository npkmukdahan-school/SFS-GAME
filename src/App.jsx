// src/App.jsx
import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './components/HomePage';
import AdminPortal from './components/AdminPortal';
import RoomCreator from './components/RoomCreator';
import GameMain from './components/GameMain';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />

        {/* ระบบ Admin ใหม่: สมัครสมาชิก, เข้าสู่ระบบ, และจัดการฐานอาหารแยกตาม Admin */}
        <Route path="/admin" element={<AdminPortal />} />
        <Route path="/admin-dashboard" element={<AdminPortal />} />
        <Route path="/dashboard" element={<AdminPortal />} />

        {/* ห้องเกมสำหรับครู ต้องเข้าสู่ระบบ Admin ก่อนสร้างห้อง */}
        <Route path="/create-room" element={<RoomCreator />} />
        <Route path="/room" element={<RoomCreator />} />

        {/* หน้าผู้เล่นสำหรับนักเรียน */}
        <Route path="/play" element={<GameMain />} />
        <Route path="/game" element={<GameMain />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
