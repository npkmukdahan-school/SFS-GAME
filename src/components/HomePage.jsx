// src/components/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Camera,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

const PUBLIC_BASE_URL = import.meta.env.BASE_URL || '/';
const GAME_LOGO_URL = `${PUBLIC_BASE_URL}sfs-game-logo.png`;
const KNOWLEDGE_PDF_URL = 'https://phan.moph.go.th/kanya/download/page02/16.pdf';

const learningSteps = [
  {
    icon: BookOpen,
    title: 'เรียนรู้ฉลาก GDA',
    text: 'เข้าใจข้อมูลน้ำตาล ไขมัน และโซเดียมบนฉลากอาหารก่อนเลือกบริโภค',
  },
  {
    icon: Camera,
    title: 'สแกนบาร์โค้ด',
    text: 'ใช้กล้องมือถือสแกนอาหาร ขนม เครื่องดื่ม หรือไอศกรีมที่อยู่ในฐานข้อมูลของครู',
  },
  {
    icon: ShieldCheck,
    title: 'วิเคราะห์ความปลอดภัย',
    text: 'ระบบคำนวณคะแนนและแสดงระดับสี เพื่อช่วยตัดสินใจเลือกอาหารที่เหมาะสม',
  },
  {
    icon: ClipboardList,
    title: 'สรุปผลการเรียนรู้',
    text: 'ครูดูผลรายคนและภาพรวม เพื่อใช้สะท้อนพฤติกรรมการเลือกบริโภคของผู้เรียน',
  },
];

const missionRules = [
  'เข้าห้องด้วยรหัสที่ครูสร้าง',
  'เลือกตัวละครและตั้งชื่อสายลับ',
  'สแกนอาหารให้ครบตามจำนวนที่กำหนด',
  'ห้ามสแกนบาร์โค้ดเดิมซ้ำ เพื่อส่งเสริมการเลือกอย่างหลากหลาย',
  'อ่านผลคะแนน สี และคำแนะนำหลังสแกนทุกครั้ง',
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#06111f] text-white overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] rounded-full bg-blue-600/20 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full bg-lime-400/10 blur-[120px]" />
      </div>

      <header className="relative z-10 max-w-7xl mx-auto px-5 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={GAME_LOGO_URL} alt="เกมลับ จับหวานมันเค็ม SFS-GAME" className="w-16 h-16 object-contain" />
          <div>
            <div className="text-xl font-black tracking-wide">เกมลับ จับหวานมันเค็ม</div>
            <div className="text-cyan-300 text-xs font-bold tracking-[0.24em] uppercase">SFS-GAME Learning Media</div>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-2 text-sm font-black">
          <a href="#learn" className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10">วิธีเล่น</a>
          <a href="#mission" className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10">ภารกิจ</a>
          <a
            href={KNOWLEDGE_PDF_URL}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10"
          >
            ใบความรู้
          </a>
          <Link to="/admin" className="px-4 py-2 rounded-full bg-cyan-500 text-slate-950 hover:bg-cyan-300">Admin</Link>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="max-w-7xl mx-auto px-5 py-8 md:py-14 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-cyan-400/10 border border-cyan-300/30 text-cyan-200 px-4 py-2 rounded-full font-black mb-5">
              <Sparkles size={18} /> สื่อการเรียนรู้แบบเกม
            </div>

            <h1 className="text-4xl md:text-6xl font-black leading-tight">
              ฝึกอ่านฉลาก
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-lime-300 via-yellow-300 to-cyan-300">
                ก่อนเลือกกิน
              </span>
            </h1>

            <p className="mt-5 text-lg md:text-xl text-slate-300 font-semibold leading-relaxed">
              เกมสำหรับกิจกรรม อย.น้อย ที่ช่วยให้นักเรียนเรียนรู้เรื่องน้ำตาล ไขมัน และโซเดียม
              ผ่านภารกิจสแกนบาร์โค้ด วิเคราะห์คะแนน และเลือกอาหารให้หลากหลายอย่างมีเหตุผล
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/play"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-lime-300 to-cyan-300 text-slate-950 font-black px-7 py-4 rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.25)]"
              >
                <Play className="fill-slate-950" /> เข้าร่วมเกม
              </Link>
              <Link
                to="/create-room"
                className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/15 text-white font-black px-7 py-4 rounded-2xl hover:bg-white/15"
              >
                <Users /> สร้างห้องเรียน
              </Link>
              <a
                href={KNOWLEDGE_PDF_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-cyan-500/15 border border-cyan-300/30 text-cyan-100 font-black px-7 py-4 rounded-2xl hover:bg-cyan-500/25"
              >
                <FileText /> ใบความรู้
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-8 rounded-full bg-cyan-400/20 blur-[80px]" />
            <img
              src={GAME_LOGO_URL}
              alt="โลโก้ SFS-GAME"
              className="relative mx-auto w-full max-w-[520px] object-contain drop-shadow-[0_0_45px_rgba(56,189,248,0.45)]"
            />
          </div>
        </section>

        <section id="learn" className="max-w-7xl mx-auto px-5 py-10">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <div className="text-cyan-300 font-black uppercase tracking-[0.24em] text-xs">Learning Flow</div>
              <h2 className="text-3xl font-black mt-2">เรียนรู้ผ่าน 4 ขั้นตอน</h2>
            </div>
            <GraduationCap className="hidden md:block text-lime-300 w-12 h-12" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {learningSteps.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="bg-white/[0.06] border border-white/10 rounded-2xl p-5">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-400/15 text-cyan-200 flex items-center justify-center mb-4">
                    <Icon />
                  </div>
                  <h3 className="text-lg font-black mb-2">{item.title}</h3>
                  <p className="text-slate-300 font-semibold leading-relaxed text-sm">{item.text}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 bg-lime-300/10 border border-lime-200/20 rounded-3xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-xl font-black flex items-center gap-2">
                <FileText className="text-lime-300" /> ใบความรู้ประกอบกิจกรรม
              </h3>
              <p className="text-slate-300 font-semibold mt-2">
                ใช้เป็นเอกสารอ่านก่อนเริ่มเกม เพื่อทบทวนความรู้เรื่องการเลือกบริโภคและข้อมูลบนฉลากอาหาร
              </p>
            </div>
            <a
              href={KNOWLEDGE_PDF_URL}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 inline-flex items-center justify-center gap-2 bg-lime-300 text-slate-950 font-black px-6 py-4 rounded-2xl"
            >
              เปิด PDF ใบความรู้
            </a>
          </div>
        </section>

        <section id="mission" className="max-w-7xl mx-auto px-5 py-10 pb-16 grid lg:grid-cols-2 gap-6">
          <div className="bg-cyan-400/10 border border-cyan-300/20 rounded-3xl p-7">
            <h2 className="text-3xl font-black mb-4">กติกาภารกิจสายลับ</h2>
            <div className="space-y-3">
              {missionRules.map((rule, index) => (
                <div key={rule} className="flex gap-3 bg-slate-950/35 rounded-2xl p-4 border border-white/10">
                  <span className="w-8 h-8 shrink-0 rounded-full bg-lime-300 text-slate-950 font-black flex items-center justify-center">
                    {index + 1}
                  </span>
                  <p className="font-bold text-slate-100">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.06] border border-white/10 rounded-3xl p-7">
            <h2 className="text-3xl font-black mb-4">เหมาะกับการใช้ในชั้นเรียน</h2>
            <div className="space-y-4 text-slate-300 font-semibold leading-relaxed">
              <p>ครูสามารถสร้างห้องเกม ตั้งเวลา กำหนดจำนวนรายการที่ต้องสแกน และติดตามผลแบบเรียลไทม์ได้</p>
              <p>Admin แต่ละคนมีฐานข้อมูลอาหารของตนเอง ทำให้จัดกิจกรรมแยกตามห้องเรียน โรงเรียน หรือชุดสื่อได้สะดวก</p>
              <p>หลังจบเกมสามารถนำผลสแกนไปวิเคราะห์พฤติกรรมการเลือกบริโภคของนักเรียนได้ต่อ</p>
            </div>
            <Link
              to="/admin"
              className="mt-6 inline-flex items-center justify-center gap-2 bg-cyan-500 text-slate-950 font-black px-6 py-4 rounded-2xl"
            >
              <LayoutDashboard /> จัดการฐานข้อมูล Admin
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
