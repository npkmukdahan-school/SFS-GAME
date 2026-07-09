// src/components/HomePage.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Camera,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Play,
  QrCode,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Users,
} from 'lucide-react';

const PUBLIC_BASE_URL = import.meta.env.BASE_URL || '/';
const GAME_LOGO_URL = `${PUBLIC_BASE_URL}sfs_logo.png`;
const GDA_BANNER_URL = `${PUBLIC_BASE_URL}gda-healthy-banner.png`;
const LOGO_ORYOR_URL = `${PUBLIC_BASE_URL}logo_oryor.png`;
const SCORE_CRITERIA_BANNER_URL = `${PUBLIC_BASE_URL}score-criteria-banner.png`;

const KNOWLEDGE_LINKS = [
  {
    title: 'ใบความรู้ที่ 1',
    subtitle: 'เอกสารประกอบกิจกรรม',
    url: 'https://drive.google.com/file/d/1wDKVBtkIqsdO5GH6zu7AF_Eo_e7f5pwh/view?usp=sharing',
  },
  {
    title: 'ใบความรู้ที่ 2',
    subtitle: 'เอกสารเพิ่มเติม',
    url: 'https://drive.google.com/file/d/1mXO5u-LG2MJ-qxFFOFYF-W-oDrmAUV5h/view?usp=sharing',
  },
];

const learningSteps = [
  {
    icon: BookOpen,
    color: 'from-sky-400 to-cyan-400',
    title: 'เรียนรู้ฉลาก GDA',
    text: 'เข้าใจข้อมูลน้ำตาล ไขมัน และโซเดียมบนฉลากอาหารก่อนเลือกบริโภค',
  },
  {
    icon: QrCode,
    color: 'from-violet-400 to-fuchsia-400',
    title: 'สแกน QR Code',
    text: 'ใช้กล้องมือถือสแกน QR ที่แปลงจากรหัสอาหาร ขนม เครื่องดื่ม หรือไอศกรีม',
  },
  {
    icon: ShieldCheck,
    color: 'from-emerald-400 to-lime-400',
    title: 'วิเคราะห์ความปลอดภัย',
    text: 'ระบบคำนวณคะแนนและแสดงระดับสี เพื่อช่วยตัดสินใจเลือกอาหารที่เหมาะสม',
  },
  {
    icon: ClipboardList,
    color: 'from-orange-400 to-amber-300',
    title: 'สรุปผลการเรียนรู้',
    text: 'ครูดูผลรายคนและภาพรวม เพื่อสะท้อนพฤติกรรมการเลือกบริโภคของผู้เรียน',
  },
];

const missionRules = [
  'เข้าห้องด้วยรหัสที่ครูสร้าง',
  'เลือกตัวละครและตั้งชื่อสายลับ',
  'สแกน QR Code ของอาหารให้ครบตามจำนวนที่กำหนด',
  'ห้ามสแกนรายการเดิมซ้ำ เพื่อส่งเสริมการเลือกอย่างหลากหลาย',
  'อ่านผลคะแนน สี และคำแนะนำหลังสแกนทุกครั้ง',
];

const foodCards = [
  { emoji: '🥤', label: 'เครื่องดื่ม', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { emoji: '🍪', label: 'ขนม', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { emoji: '🍦', label: 'ไอศกรีม', color: 'bg-pink-100 text-pink-700 border-pink-200' },
];

const heroSlides = [
  {
    src: GAME_LOGO_URL,
    alt: 'โลโก้เกมลับ จับหวานมันเค็ม SFS-GAME',
    label: 'SFS-GAME',
    imageClass: 'object-contain bg-white p-4',
  },
  {
    src: LOGO_ORYOR_URL,
    alt: 'ก่อนกินเช็ก GDA สนุกได้ สุขภาพดีด้วย',
    label: 'เช็ก GDA',
    imageClass: 'object-contain bg-white',
  },
  {
    src: SCORE_CRITERIA_BANNER_URL,
    alt: 'เกณฑ์การคำนวณคะแนนเกมลับ จับหวาน มัน เค็ม',
    label: 'เกณฑ์คะแนน',
    imageClass: 'object-contain bg-white',
  },
];

export default function HomePage() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const slideTimer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 4500);

    return () => window.clearInterval(slideTimer);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-28 -left-24 w-96 h-96 rounded-full bg-cyan-200/60 blur-[90px]" />
        <div className="absolute top-28 -right-32 w-[34rem] h-[34rem] rounded-full bg-yellow-200/70 blur-[110px]" />
        <div className="absolute bottom-0 left-1/4 w-[28rem] h-[28rem] rounded-full bg-lime-200/60 blur-[110px]" />
      </div>

      <header className="relative z-10 max-w-7xl mx-auto px-5 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={GAME_LOGO_URL}
            alt="เกมลับ จับหวานมันเค็ม SFS-GAME"
            className="w-16 h-16 object-contain rounded-2xl border-2 border-cyan-200 bg-white shadow-lg"
          />
          <div>
            <div className="text-xl font-black tracking-wide text-slate-950">เกมลับ จับหวานมันเค็ม</div>
            <div className="text-cyan-600 text-xs font-black tracking-[0.22em] uppercase">SFS-GAME Learning Media</div>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-2 text-sm font-black">
          <a href="#learn" className="px-4 py-2 rounded-full bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200">
            วิธีเล่น
          </a>
          <a href="#mission" className="px-4 py-2 rounded-full bg-lime-100 text-lime-700 border border-lime-200 hover:bg-lime-200">
            ภารกิจ
          </a>
          <a href="#knowledge" className="px-4 py-2 rounded-full bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200">
            ใบความรู้
          </a>
          <Link to="/admin" className="px-4 py-2 rounded-full bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-200 hover:bg-fuchsia-600">
            Admin
          </Link>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="max-w-7xl mx-auto px-5 pt-6 pb-10 md:pt-12 md:pb-16 grid lg:grid-cols-[1.03fr_0.97fr] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-cyan-200 text-cyan-700 px-4 py-2 rounded-full font-black mb-5 shadow-sm">
              <Sparkles size={18} /> เกมเรียนรู้ฉลากโภชนาการสำหรับเด็ก
            </div>

            <div className="relative max-w-2xl">
              <img
                src={GDA_BANNER_URL}
                alt="ก่อนกินเช็ก GDA สนุกได้ สุขภาพดีด้วย"
                className="w-full rounded-[2rem] border-4 border-white bg-white shadow-2xl shadow-cyan-100"
              />
            </div>

            <p className="mt-5 text-lg md:text-xl text-slate-600 font-semibold leading-relaxed">
              สื่อเกมสำหรับกิจกรรม อย.น้อย ให้นักเรียนเรียนรู้เรื่องหวาน มัน เค็ม ผ่านการสแกน QR Code
              วิเคราะห์คะแนน และเลือกอาหารให้หลากหลายอย่างมีเหตุผล
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/play"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-lime-300 to-cyan-300 text-slate-950 font-black px-7 py-4 rounded-2xl shadow-xl shadow-cyan-200 hover:scale-[1.02] transition"
              >
                <Play className="fill-slate-950" /> เข้าร่วมเกม
              </Link>
              <Link
                to="/create-room"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black px-7 py-4 rounded-2xl shadow-xl shadow-fuchsia-200 hover:scale-[1.02] transition"
              >
                <Users /> สร้างห้องเรียน
              </Link>
              <a
                href="#knowledge"
                className="inline-flex items-center justify-center gap-2 bg-white border-2 border-amber-200 text-amber-700 font-black px-7 py-4 rounded-2xl shadow-md hover:bg-amber-50 transition"
              >
                <FileText /> ใบความรู้ 2 ชุด
              </a>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-3 max-w-xl">
              {foodCards.map((item) => (
                <div key={item.label} className={`rounded-2xl border p-3 text-center font-black ${item.color}`}>
                  <div className="text-3xl mb-1">{item.emoji}</div>
                  <div className="text-xs">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[420px]">
            <div className="absolute inset-x-8 top-16 bottom-8 rounded-[2rem] bg-gradient-to-br from-cyan-100 via-white to-lime-100 shadow-2xl border border-white" />

            <div className="relative mx-auto max-w-[560px] rounded-[2.25rem] bg-white border-4 border-white shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-400 via-lime-300 to-amber-300 px-5 py-4 flex items-center justify-between">
                <div className="font-black text-slate-950 flex items-center gap-2">
                  <QrCode size={22} /> SFS Mission
                </div>
                <div className="flex gap-1">
                  <span className="w-3 h-3 rounded-full bg-rose-400" />
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="w-3 h-3 rounded-full bg-lime-500" />
                </div>
              </div>

              <div className="p-5 md:p-6">
                <div className="relative">
                  <img
                    src={heroSlides[activeSlide].src}
                    alt={heroSlides[activeSlide].alt}
                    className={`w-full h-[280px] md:h-[320px] rounded-[2rem] border-4 border-white shadow-lg transition-all duration-500 ${heroSlides[activeSlide].imageClass}`}
                  />
                  <div className="absolute -bottom-4 left-4 flex items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 shadow-lg border border-cyan-100">
                    <img
                      src={GAME_LOGO_URL}
                      alt="SFS-GAME"
                      className="w-12 h-12 object-contain rounded-xl border border-cyan-100"
                    />
                    <div>
                      <div className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">
                        Learning Game
                      </div>
                      <div className="text-sm font-black text-slate-900">เกมลับจับหวานมันเค็ม</div>
                    </div>
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                  {heroSlides.map((slide, index) => (
                    <button
                      key={slide.label}
                      type="button"
                      onClick={() => setActiveSlide(index)}
                      className={`h-3 rounded-full transition-all ${
                        activeSlide === index
                          ? 'w-10 bg-cyan-500'
                          : 'w-3 bg-slate-300 hover:bg-slate-400'
                      }`}
                      aria-label={`แสดงภาพ ${slide.label}`}
                      title={slide.label}
                    />
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-cyan-50 p-4 text-center border border-cyan-100">
                    <Camera className="mx-auto text-cyan-600 mb-2" />
                    <div className="text-xs font-black text-cyan-700">สแกนง่าย</div>
                  </div>
                  <div className="rounded-2xl bg-lime-50 p-4 text-center border border-lime-100">
                    <Star className="mx-auto text-lime-600 mb-2 fill-lime-300" />
                    <div className="text-xs font-black text-lime-700">ได้คะแนน</div>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4 text-center border border-amber-100">
                    <Trophy className="mx-auto text-amber-600 mb-2" />
                    <div className="text-xs font-black text-amber-700">จัดอันดับ</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute top-8 left-0 rotate-[-8deg] rounded-3xl bg-white px-5 py-4 shadow-xl border border-sky-100">
              <div className="text-4xl">🕵️</div>
              <div className="text-xs font-black text-sky-700 mt-1">สายลับ GDA</div>
            </div>
            <div className="absolute bottom-4 right-0 rotate-[8deg] rounded-3xl bg-white px-5 py-4 shadow-xl border border-pink-100">
              <div className="text-4xl">🥗</div>
              <div className="text-xs font-black text-pink-700 mt-1">เลือกให้หลากหลาย</div>
            </div>
          </div>
        </section>

        <section id="learn" className="max-w-7xl mx-auto px-5 py-10">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <div className="text-cyan-600 font-black uppercase tracking-[0.24em] text-xs">Learning Flow</div>
              <h2 className="text-3xl font-black mt-2 text-slate-950">เรียนรู้ผ่าน 4 ขั้นตอน</h2>
            </div>
            <GraduationCap className="hidden md:block text-lime-500 w-12 h-12" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {learningSteps.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-lg hover:-translate-y-1 transition">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} text-white flex items-center justify-center mb-4 shadow-md`}>
                    <Icon />
                  </div>
                  <h3 className="text-lg font-black mb-2 text-slate-950">{item.title}</h3>
                  <p className="text-slate-600 font-semibold leading-relaxed text-sm">{item.text}</p>
                </div>
              );
            })}
          </div>

          <div id="knowledge" className="mt-6 bg-gradient-to-r from-amber-50 to-lime-50 border border-amber-100 rounded-3xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-black flex items-center gap-2 text-slate-950">
                  <FileText className="text-amber-500" /> ใบความรู้ประกอบกิจกรรม
                </h3>
                <p className="text-slate-600 font-semibold mt-2">
                  เปลี่ยนจากใบความรู้เดิม เป็นเอกสาร Google Drive 2 ชุด สำหรับอ่านก่อนเริ่มเกมและทบทวนหลังจบกิจกรรม
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {KNOWLEDGE_LINKS.map((item, index) => (
                <a
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`group flex items-center justify-between gap-4 rounded-2xl border p-4 shadow-md transition hover:-translate-y-1 ${
                    index === 0
                      ? 'bg-white border-amber-200 hover:bg-amber-50'
                      : 'bg-white border-lime-200 hover:bg-lime-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${
                      index === 0 ? 'bg-amber-400' : 'bg-lime-500'
                    }`}>
                      <FileText />
                    </div>
                    <div>
                      <div className="font-black text-slate-950">{item.title}</div>
                      <div className="text-sm font-bold text-slate-500">{item.subtitle}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 group-hover:bg-white">
                    เปิดไฟล์
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="mission" className="max-w-7xl mx-auto px-5 py-10 pb-16 grid lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-cyan-50 to-sky-50 border border-cyan-100 rounded-3xl p-7 shadow-sm">
            <h2 className="text-3xl font-black mb-4 text-slate-950">กติกาภารกิจสายลับ</h2>
            <div className="space-y-3">
              {missionRules.map((rule, index) => (
                <div key={rule} className="flex gap-3 bg-white rounded-2xl p-4 border border-cyan-100 shadow-sm">
                  <span className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-lime-300 to-cyan-300 text-slate-950 font-black flex items-center justify-center">
                    {index + 1}
                  </span>
                  <p className="font-bold text-slate-700">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-fuchsia-50 to-rose-50 border border-fuchsia-100 rounded-3xl p-7 shadow-sm">
            <h2 className="text-3xl font-black mb-4 text-slate-950">เหมาะกับการใช้ในชั้นเรียน</h2>
            <div className="space-y-4 text-slate-600 font-semibold leading-relaxed">
              <p>ครูสามารถสร้างห้องเกม ตั้งเวลา กำหนดจำนวนรายการที่ต้องสแกน และติดตามผลแบบเรียลไทม์ได้</p>
              <p>Admin แต่ละคนมีฐานข้อมูลอาหารของตนเอง ทำให้จัดกิจกรรมแยกตามห้องเรียน โรงเรียน หรือชุดสื่อได้สะดวก</p>
              <p>หลังจบเกมสามารถนำผลสแกนไปวิเคราะห์พฤติกรรมการเลือกบริโภคของนักเรียนได้ต่อ</p>
            </div>
            <Link
              to="/admin"
              className="mt-6 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-500 to-rose-500 text-white font-black px-6 py-4 rounded-2xl shadow-lg shadow-fuchsia-100 hover:scale-[1.02] transition"
            >
              <LayoutDashboard /> จัดการฐานข้อมูล Admin
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
