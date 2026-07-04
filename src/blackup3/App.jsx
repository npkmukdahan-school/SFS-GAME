// src/App.jsx
import React from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom'; // ⚠️ เปลี่ยนมาใช้ HashRouter

// นำเข้าหน้าต่างทั้ง 3 ส่วน
import AdminDashboard from './components/AdminDashboard';
import RoomCreator from './components/RoomCreator';
import GameMain from './components/GameMain'; 

import { Gamepad2, ShieldCheck, MonitorPlay, ScanLine } from 'lucide-react';

function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a192f] p-4 text-center font-sans relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
         <div className="absolute top-[10%] left-[20%] w-[30rem] h-[30rem] bg-blue-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-pulse"></div>
         <div className="absolute bottom-[10%] right-[20%] w-[30rem] h-[30rem] bg-sky-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="z-10 bg-[#112240]/80 backdrop-blur-xl p-12 rounded-[3rem] shadow-[0_0_50px_rgba(37,99,235,0.2)] border border-blue-500/30 max-w-md w-full">
        <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-sky-400 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(56,189,248,0.5)] rotate-12 hover:rotate-0 transition-transform duration-500">
            <Gamepad2 className="w-16 h-16 text-white" />
        </div>
        
        <h1 className="text-5xl font-black mb-2 text-white tracking-widest drop-shadow-lg uppercase">SFS <span className="text-sky-400">Game</span></h1>
        <p className="text-blue-300 font-bold mb-10 tracking-wider text-sm uppercase bg-blue-900/50 inline-block px-4 py-2 rounded-lg border border-blue-500/30">ภารกิจลับ จับ หวาน มัน เค็ม</p>
        
        <div className="flex flex-col gap-4 w-full">
          {/* ปุ่มครูสร้างห้อง */}
          <Link to="/host" className="w-full flex justify-center items-center gap-3 py-5 px-4 border-0 text-xl font-black rounded-2xl text-slate-900 bg-amber-400 hover:bg-amber-300 focus:outline-none uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all transform active:scale-95 overflow-hidden">
            <MonitorPlay size={24}/> สร้างห้องเกม (ครู)
          </Link>
          
          {/* ปุ่มนักเรียนเล่นเกม */}
          <Link to="/game" className="w-full flex justify-center items-center gap-3 py-5 px-4 border-2 border-blue-500/50 text-xl font-black rounded-2xl text-white bg-blue-900/40 hover:bg-blue-600/60 focus:outline-none uppercase tracking-widest transition-all transform active:scale-95">
            <ScanLine size={24} className="text-cyan-400" /> เข้าร่วมภารกิจ (นักเรียน)
          </Link>
          
          {/* ปุ่มแอดมินจัดการคลัง */}
          <Link to="/admin" className="mt-4 w-full flex justify-center items-center gap-2 py-4 px-4 text-sm font-bold rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all uppercase tracking-widest">
            <ShieldCheck size={18} /> จัดการคลังข้อมูล (Admin)
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    // ⚠️ ครอบด้วย HashRouter แทน BrowserRouter และไม่ต้องใส่ basename แล้ว
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/host" element={<RoomCreator />} />
        <Route path="/game" element={<GameMain />} />
      </Routes>
    </HashRouter>
  );
}