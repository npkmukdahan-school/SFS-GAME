// src/App.jsx
import React, { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './components/HomePage';

const AdminPortal = lazy(() => import('./components/AdminPortal'));
const RoomCreator = lazy(() => import('./components/RoomCreator'));
const GameMain = lazy(() => import('./components/GameMain'));

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#06111f] text-white flex items-center justify-center p-6">
          <div className="max-w-xl w-full rounded-3xl border border-red-400/30 bg-red-500/10 p-6 shadow-2xl">
            <h1 className="text-2xl font-black mb-3">โหลดหน้าเกมไม่สำเร็จ</h1>
            <p className="text-slate-200 font-semibold leading-relaxed">
              กรุณาตรวจสอบค่า Firebase ใน GitHub Secrets และเปิด Console เพื่อดูข้อความ error เพิ่มเติม
            </p>
            <pre className="mt-4 overflow-auto rounded-2xl bg-black/40 p-4 text-sm text-red-100">
              {this.state.error?.message || 'Unknown error'}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#06111f] text-white flex items-center justify-center p-6">
      <div className="rounded-3xl border border-cyan-300/20 bg-white/10 px-6 py-4 font-black text-cyan-100">
        กำลังโหลดเกม...
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <HashRouter>
        <Suspense fallback={<LoadingScreen />}>
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
        </Suspense>
      </HashRouter>
    </AppErrorBoundary>
  );
}
