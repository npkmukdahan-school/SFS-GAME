// src/components/RoomCreator.jsx
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Pause, RotateCcw, Users, Clock, Trophy, Settings, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebase'; // นำเข้า auth/db จาก firebase.js
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const FDA_JUNIOR_LOGO_URL = 'https://i.postimg.cc/VL8jfMz0/FKVHoyve-Sk-Sp-SWu-Aq-D5xth-KQ.png';

const MIN_TARGET_ITEMS = 5;
const MAX_TARGET_ITEMS = 10;

const clampTargetItems = (value, fallback = MIN_TARGET_ITEMS) => {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) && numericValue > 0 ? numericValue : Number(fallback || MIN_TARGET_ITEMS);
  return Math.min(MAX_TARGET_ITEMS, Math.max(MIN_TARGET_ITEMS, Math.round(safeValue)));
};
// วางไฟล์เพลงไว้ที่ public/audio/waiting-music.mp3
// เวลาเว็บรัน Vite จะเรียกใช้ได้ด้วย path /audio/waiting-music.mp3
const PUBLIC_BASE_URL = import.meta.env.BASE_URL || '/';
const WAITING_MUSIC_URL = `${PUBLIC_BASE_URL}audio/waiting-music.mp3`;
const ACTION_MUSIC_URL = 'https://cdn.pixabay.com/download/audio/2022/10/18/audio_31c2730e64.mp3?filename=action-dramatic-sport-rock-trailer-122763.mp3';
const CELEBRATION_MUSIC_URL = 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_c8c8a73467.mp3?filename=success-fanfare-trumpets-6185.mp3';
const ENABLE_TEACHER_WAITING_VOICE = false;

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  }

  return 0;
};

const getRoomTimeLimitSeconds = (room, fallbackMinutes = 3) => {
  const seconds = Number(room?.timeLimitSeconds || room?.durationSeconds);
  if (seconds > 0) return seconds;

  const minutes = Number(room?.timeLimit || room?.durationMinutes || fallbackMinutes);
  return minutes > 0 ? minutes * 60 : 0;
};

const getRoomElapsedSeconds = (room, nowMs = Date.now()) => {
  const pausedElapsedSeconds = Number(room?.pausedElapsedSeconds);
  if (room?.status === 'paused' && pausedElapsedSeconds >= 0) {
    return Math.floor(pausedElapsedSeconds);
  }

  const startMs = toMillis(room?.startedAt || room?.startTime || room?.gameStartedAt);
  const elapsedOffsetSeconds = Number(room?.elapsedOffsetSeconds || 0);
  if (!startMs) return Math.max(0, Math.floor(elapsedOffsetSeconds));

  const elapsedMs = Math.max(0, nowMs - startMs);

  return Math.max(0, Math.floor(elapsedOffsetSeconds + elapsedMs / 1000));
};

export default function RoomCreator() {
  const [roomState, setRoomState] = useState('setup'); 
  const [settings, setSettings] = useState({ timeLimit: 3, itemLimit: 5 });
  const [roomCode, setRoomCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [players, setPlayers] = useState([]);
  const [roomData, setRoomData] = useState(null);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [currentAdminProfile, setCurrentAdminProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const waitingMusic = useRef(new Audio(WAITING_MUSIC_URL));
  const adventureMusic = useRef(new Audio(ACTION_MUSIC_URL));
  const celebrationMusic = useRef(new Audio(CELEBRATION_MUSIC_URL));
  const teacherVoiceTimer = useRef(null);
  const finishRequested = useRef(false);

  const stopAllMusic = () => {
    [waitingMusic.current, adventureMusic.current, celebrationMusic.current].forEach((audio) => {
      audio.pause();
    });
  };

  const playAudio = async (audio) => {
    try {
      await audio.play();
    } catch {
      console.log("Audio block");
    }
  };

  const playWaitingMusic = () => {
    waitingMusic.current.loop = true;
    waitingMusic.current.volume = 0.32;
    adventureMusic.current.pause();
    adventureMusic.current.currentTime = 0;
    celebrationMusic.current.pause();
    celebrationMusic.current.currentTime = 0;
    playAudio(waitingMusic.current);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentAdmin(user);
      setCurrentAdminProfile(null);

      if (user) {
        try {
          const adminSnap = await getDoc(doc(db, 'admins', user.uid));
          setCurrentAdminProfile(adminSnap.exists() ? adminSnap.data() : null);
        } catch {
          setCurrentAdminProfile(null);
        }
      }

      setAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  // --- Real-time Firebase Listener ---
  useEffect(() => {
    if (!roomCode) return;

    const roomRef = doc(db, "rooms", roomCode);
    const unsubscribeRoom = onSnapshot(roomRef, (roomSnap) => {
      if (!roomSnap.exists()) return;

      const data = roomSnap.data();
      setRoomData(data);
      setRoomState(data.status || 'waiting');
    });

    // ฟังการเปลี่ยนแปลงของนักเรียนในห้องนี้
    const playersRef = collection(db, "rooms", roomCode, "players");
    const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // เรียงลำดับคะแนนจากมากไปน้อย
      setPlayers(playersData.sort((a, b) => b.score - a.score));
    });

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
    };
  }, [roomCode]);

  // --- Audio Control ---
  useEffect(() => {
    waitingMusic.current.loop = true;
    waitingMusic.current.volume = 0.25;
    adventureMusic.current.loop = true;
    adventureMusic.current.volume = 0.38;
    celebrationMusic.current.loop = true;
    celebrationMusic.current.volume = 0.45;

    if (roomState === 'waiting') {
      playWaitingMusic();
    } else if (roomState === 'playing') {
      waitingMusic.current.pause();
      waitingMusic.current.currentTime = 0;
      celebrationMusic.current.pause();
      celebrationMusic.current.currentTime = 0;
      playAudio(adventureMusic.current);
    } else if (roomState === 'paused') {
      waitingMusic.current.pause();
      adventureMusic.current.pause();
      celebrationMusic.current.pause();
    } else if (roomState === 'finished') {
      waitingMusic.current.pause();
      adventureMusic.current.pause();
      adventureMusic.current.currentTime = 0;
      playAudio(celebrationMusic.current);
      triggerConfetti();
    } else {
      stopAllMusic();
    }
  }, [roomState]);

  // --- Teacher Waiting Voice ---
  // ปิดไว้เพื่อให้ช่วงรอเริ่มเกมเล่นเฉพาะไฟล์ public/audio/waiting-music.mp3
  useEffect(() => {
    if (!ENABLE_TEACHER_WAITING_VOICE) {
      window.clearInterval(teacherVoiceTimer.current);
      window.speechSynthesis?.cancel();
      return;
    }

    if (roomState !== 'waiting') {
      window.clearInterval(teacherVoiceTimer.current);
      window.speechSynthesis?.cancel();
      return;
    }

    const speakWaitingMessage = () => {
      if (!('speechSynthesis' in window)) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        'ห้องเกมพร้อมแล้ว นักเรียนเตรียมตัวให้พร้อม รอครูกดเริ่มเกม',
      );
      utterance.lang = 'th-TH';
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 0.85;
      window.speechSynthesis.speak(utterance);
    };

    speakWaitingMessage();
    teacherVoiceTimer.current = window.setInterval(speakWaitingMessage, 15000);

    return () => {
      window.clearInterval(teacherVoiceTimer.current);
      window.speechSynthesis?.cancel();
    };
  }, [roomState]);

  // --- Timer & State Sync ---
  useEffect(() => {
    let timer;

    const syncTimeFromRoom = () => {
      const fallbackMinutes = Number(settings.timeLimit || 3);
      const limitSeconds = getRoomTimeLimitSeconds(roomData, fallbackMinutes);
      const elapsedSeconds = getRoomElapsedSeconds(roomData);
      const remainingSeconds = Math.max(0, limitSeconds - elapsedSeconds);

      setTimeLeft(remainingSeconds);

      if (
        roomState === 'playing' &&
        limitSeconds > 0 &&
        elapsedSeconds >= limitSeconds &&
        !finishRequested.current
      ) {
        finishRequested.current = true;
        handleFinishGame();
      }
    };

    if ((roomState === 'playing' || roomState === 'paused') && roomData) {
      syncTimeFromRoom();
      timer = setInterval(syncTimeFromRoom, 1000);
    }

    return () => clearInterval(timer);
  }, [roomState, roomData, settings.timeLimit]);

  // --- Firebase Actions ---
  const handleCreateRoom = async () => {
    if (!currentAdmin) {
      alert('กรุณาเข้าสู่ระบบ Admin ก่อนสร้างห้องเกม');
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const timeLimitSeconds = Number(settings.timeLimit || 3) * 60;
    const itemLimit = clampTargetItems(settings.itemLimit);

    finishRequested.current = false;
    setRoomCode(code);
    setTimeLeft(timeLimitSeconds);
    setRoomData(null);
    setRoomState('waiting');

    // สร้างห้องใน Firestore
    await setDoc(doc(db, "rooms", code), {
      status: 'waiting',
      adminId: currentAdmin.uid,
      adminEmail: currentAdmin.email || '',
      adminName: currentAdmin.displayName || currentAdmin.email || 'Admin',
      schoolName: currentAdminProfile?.schoolName || '',
      foodCollectionPath: `admins/${currentAdmin.uid}/foods`,
      timeLimit: Number(settings.timeLimit || 3),
      timeLimitSeconds,
      itemLimit,
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      elapsedOffsetSeconds: 0,
      pausedElapsedSeconds: 0,
      finishedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    playWaitingMusic();
  };

  const handleStartGame = async () => {
    if (players.length === 0 && !window.confirm("ยังไม่มีผู้เล่นในห้อง ต้องการเริ่มเกมหรือไม่?")) return;
    const timeLimitSeconds = Number(settings.timeLimit || roomData?.timeLimit || 3) * 60;

    finishRequested.current = false;
    setTimeLeft(timeLimitSeconds);
    setRoomState('playing');

    // อัปเดตสถานะห้องเป็น playing เพื่อให้นักเรียนเริ่มเกมได้
    await updateDoc(doc(db, "rooms", roomCode), {
      status: 'playing',
      startedAt: serverTimestamp(),
      pausedAt: null,
      totalPausedMs: 0,
      elapsedOffsetSeconds: 0,
      pausedElapsedSeconds: 0,
      timeLimit: Number(settings.timeLimit || roomData?.timeLimit || 3),
      timeLimitSeconds,
      updatedAt: serverTimestamp(),
    });
  };

  const handlePauseGame = async () => {
    const elapsedSeconds = getRoomElapsedSeconds(roomData);
    setRoomState('paused');
    adventureMusic.current.pause();
    await updateDoc(doc(db, "rooms", roomCode), {
      status: 'paused',
      pausedAt: serverTimestamp(),
      pausedElapsedSeconds: elapsedSeconds,
      updatedAt: serverTimestamp(),
    });
  };

  const handleResumeGame = async () => {
    const roomRef = doc(db, "rooms", roomCode);

    await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(roomRef);
      const room = roomSnap.data() || {};
      const pausedElapsedSeconds = Number(room.pausedElapsedSeconds || 0);

      transaction.update(roomRef, {
        status: 'playing',
        startedAt: serverTimestamp(),
        pausedAt: null,
        elapsedOffsetSeconds: pausedElapsedSeconds,
        updatedAt: serverTimestamp(),
      });
    });

    setRoomState('playing');
    playAudio(adventureMusic.current);
  };

  const handleFinishGame = async () => {
    if (!roomCode) return;

    setRoomState('finished');
    await updateDoc(doc(db, "rooms", roomCode), {
      status: 'finished',
      finishedAt: serverTimestamp(),
      finishedElapsedSeconds: getRoomElapsedSeconds(roomData),
      updatedAt: serverTimestamp(),
    });
  };

  const handleReset = async () => {
    // ลบห้องทิ้งเมื่อกดเริ่มใหม่
    if(roomCode) await deleteDoc(doc(db, "rooms", roomCode));
    finishRequested.current = false;
    setRoomState('setup');
    setRoomCode('');
    setRoomData(null);
    setTimeLeft(0);
    setPlayers([]);
    stopAllMusic();
  };

  const triggerConfetti = () => {
    const duration = 15 * 1000;
    const animationEnd = Date.now() + duration;
    const frame = () => {
      if (animationEnd - Date.now() <= 0) return;
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#3b82f6', '#06b6d4', '#10b981'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#3b82f6', '#06b6d4', '#10b981'] });
      requestAnimationFrame(frame);
    };
    frame();
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0a192f] text-white flex items-center justify-center p-6">
        <div className="bg-[#112240]/80 border border-cyan-500/30 rounded-3xl p-8 font-black text-cyan-300">
          กำลังตรวจสอบสิทธิ์ Admin...
        </div>
      </div>
    );
  }

  if (!currentAdmin) {
    return (
      <div className="min-h-screen bg-[#0a192f] text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-[#112240]/90 border border-cyan-500/30 rounded-[2rem] p-8 text-center shadow-[0_0_40px_rgba(6,182,212,0.2)]">
          <ShieldAlert className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
          <h1 className="text-3xl font-black mb-3">Admin Required</h1>
          <p className="text-slate-300 font-bold mb-6">
            กรุณาสมัครสมาชิกหรือเข้าสู่ระบบ Admin ก่อนสร้างห้อง เพื่อแยกฐานข้อมูลอาหารของแต่ละ Admin
          </p>
          <Link
            to="/admin"
            className="inline-flex items-center justify-center bg-cyan-500 text-slate-950 font-black px-8 py-4 rounded-2xl"
          >
            ไปหน้า Admin
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a192f] text-slate-200 font-sans relative overflow-hidden flex flex-col">
      <div className="absolute top-[-20%] left-[-10%] w-[40rem] h-[40rem] bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 pointer-events-none"></div>

      <header className="bg-[#112240]/80 backdrop-blur-md border-b border-blue-500/30 p-6 flex flex-col md:flex-row justify-between items-center gap-5 z-10 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-white rounded-2xl p-2 shadow-[0_0_22px_rgba(6,182,212,0.25)] border border-cyan-300/60">
            <img
              src={FDA_JUNIOR_LOGO_URL}
              alt="โลโก้ อย.น้อย"
              className="w-16 h-16 object-contain"
            />
          </div>
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-cyan-400 w-8 h-8" />
            <div>
              <h1 className="text-2xl font-black text-white tracking-widest uppercase">SFS Command Center</h1>
              <p className="text-cyan-300 text-xs md:text-sm font-bold tracking-widest uppercase">อย.น้อย Nutrition Mission</p>
            </div>
          </div>
        </div>
        {roomState !== 'setup' && (
          <div className="bg-blue-950/50 border border-blue-500/50 px-6 py-2 rounded-full flex items-center gap-4 shadow-[0_0_15px_rgba(37,99,235,0.3)]">
            <span className="text-cyan-400 font-bold uppercase tracking-widest text-sm">Room Code</span>
            <span className="text-3xl font-black text-white tracking-[0.2em]">{roomCode}</span>
          </div>
        )}
      </header>

      <main className="flex-1 p-8 relative z-10 flex flex-col items-center justify-center">
        
        {roomState === 'setup' && (
          <div className="bg-[#112240]/80 backdrop-blur-xl border border-blue-500/30 p-10 rounded-[2.5rem] shadow-[0_0_50px_rgba(37,99,235,0.2)] max-w-xl w-full animate-in zoom-in-95 duration-300">
            <Link
              to="/admin"
              className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-300/20"
            >
              <ArrowLeft size={18} /> กลับหน้า Admin
            </Link>
            <h2 className="text-3xl font-black text-white mb-8 text-center flex items-center justify-center gap-3"><Settings className="text-blue-500"/> ตั้งค่าภารกิจ</h2>
            {currentAdminProfile?.schoolName && (
              <div className="mb-6 rounded-2xl border border-lime-300/30 bg-lime-300/10 px-5 py-4 text-center font-black text-lime-200">
                โรงเรียน/วิทยาลัย: {currentAdminProfile.schoolName}
              </div>
            )}
            <div className="space-y-8">
              <div>
                <label className="block text-sm font-bold text-cyan-400 uppercase tracking-widest mb-3"><Clock className="inline w-4 h-4 mr-1"/> เวลาในการเล่น (นาที)</label>
                <div className="grid grid-cols-2 gap-4">
                  {[3, 5].map(time => (
                    <button key={time} onClick={() => setSettings({...settings, timeLimit: time})}
                      className={`py-4 rounded-2xl font-black text-xl transition-all ${settings.timeLimit === time ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.5)] border-2 border-blue-400' : 'bg-[#0a192f] text-slate-400 border-2 border-blue-900/50 hover:border-blue-500/50'}`}>
                      {time} นาที
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-cyan-400 uppercase tracking-widest mb-3"><Trophy className="inline w-4 h-4 mr-1"/> จำนวนไอเทมเป้าหมาย</label>
                <input type="range" min="5" max="10" step="1" value={settings.itemLimit} onChange={(e) => setSettings({ ...settings, itemLimit: clampTargetItems(e.target.value) })}
                  className="w-full accent-blue-500 h-2 bg-blue-950 rounded-lg appearance-none cursor-pointer" />
                <div className="text-center mt-4 font-black text-4xl text-white">{settings.itemLimit} <span className="text-lg text-slate-400">ชิ้น</span></div>
              </div>
              <button onClick={handleCreateRoom} className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-2xl py-5 rounded-2xl transition-transform active:scale-95 uppercase tracking-widest">
                สร้างห้องเกม
              </button>
            </div>
          </div>
        )}

        {roomState === 'waiting' && (
          <div className="w-full max-w-5xl flex flex-col items-center animate-in fade-in duration-500">
             <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-900/30 rounded-full mb-4 border-4 border-blue-500/50 animate-pulse">
                  <Users className="w-10 h-10 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-cyan-400 tracking-widest uppercase">รอสายลับเข้าสู่ระบบ...</h2>
             </div>
             <div className="bg-[#112240]/80 backdrop-blur-xl border border-blue-500/30 rounded-[2rem] p-8 w-full min-h-[300px]">
                <h3 className="text-xl font-bold text-white mb-6 border-b border-blue-500/30 pb-4">พร้อมปฏิบัติงาน ({players.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {players.map((p) => (
                    <div key={p.id} className="bg-blue-900/40 border border-blue-500/40 rounded-xl p-4 flex items-center gap-3">
                      <span className="text-2xl">{p.avatar}</span>
                      <span className="font-bold text-blue-100">{p.name}</span>
                    </div>
                  ))}
                </div>
             </div>
             <button onClick={handleStartGame} className="mt-10 bg-green-500 text-slate-900 font-black text-2xl py-5 px-16 rounded-2xl active:scale-95 uppercase tracking-widest flex items-center gap-3">
                <Play className="fill-slate-900" /> เริ่มเกม
             </button>
          </div>
        )}

        {(roomState === 'playing' || roomState === 'paused') && (
          <div className="w-full max-w-6xl animate-in fade-in duration-500">
            {roomState === 'paused' && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a192f]/80 backdrop-blur-sm">
                <div className="text-center">
                  <h2 className="text-6xl font-black text-amber-500 tracking-widest uppercase mb-8">เกมหยุดชั่วคราว</h2>
                  <button onClick={handleResumeGame} className="bg-amber-500 text-slate-900 font-black text-2xl py-4 px-12 rounded-2xl flex items-center justify-center gap-3 mx-auto">
                    <Play className="fill-slate-900" /> เล่นต่อ
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-between items-end mb-8">
               <div className="bg-[#112240] border-2 border-blue-500/50 rounded-3xl p-6">
                  <span className="block text-cyan-400 font-bold uppercase tracking-widest text-sm mb-1">เวลาที่เหลือ</span>
                  <span className={`text-6xl font-black tracking-wider ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{formatTime(timeLeft)}</span>
               </div>
               <button onClick={handlePauseGame} disabled={roomState === 'paused'} className={`bg-amber-500 text-slate-900 font-black py-4 px-8 rounded-2xl flex items-center gap-2 uppercase tracking-widest ${roomState === 'paused' ? 'opacity-50' : 'active:scale-95'}`}>
                 <Pause className="fill-slate-900" /> หยุดชั่วคราว
               </button>
            </div>

            <div className="bg-[#112240]/80 backdrop-blur-xl border border-blue-500/30 rounded-[2rem] overflow-hidden shadow-2xl">
               <div className="bg-blue-900/40 p-4 border-b border-blue-500/30 flex justify-between items-center">
                 <h3 className="text-xl font-bold text-white flex items-center gap-2"><Trophy className="text-amber-400"/> กระดานคะแนนเรียลไทม์</h3>
                 <span className="flex items-center gap-2 text-green-400 text-sm font-bold"><span className="w-2 h-2 bg-green-400 rounded-full animate-ping"></span> Live Update</span>
               </div>
               <div className="p-6">
                 <table className="w-full text-left border-separate border-spacing-y-3">
                   <thead>
                     <tr className="text-cyan-600 uppercase tracking-widest text-sm">
                       <th className="pb-2 px-4 font-black">อันดับ</th>
                       <th className="pb-2 px-4 font-black">สายลับ</th>
                       <th className="pb-2 px-4 font-black text-right">คะแนนรวม</th>
                     </tr>
                   </thead>
                   <tbody>
                     {players.map((p, index) => (
                       <tr key={p.id} className="bg-blue-950/30">
                         <td className="p-4 rounded-l-xl">
                            <span className={`inline-flex w-8 h-8 rounded-full items-center justify-center font-black ${index === 0 ? 'bg-amber-500 text-slate-900' : index === 1 ? 'bg-slate-300 text-slate-900' : index === 2 ? 'bg-orange-400 text-slate-900' : 'bg-slate-800 text-slate-400'}`}>{index + 1}</span>
                         </td>
                         <td className="p-4 font-bold text-lg text-white flex items-center gap-2"><span className="text-2xl">{p.avatar}</span> {p.name}</td>
                         <td className="p-4 rounded-r-xl font-black text-2xl text-cyan-400 text-right drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
                           {p.score > 0 ? p.score.toFixed(3) : "0.000"}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {roomState === 'finished' && (
          <div className="w-full max-w-5xl text-center animate-in zoom-in duration-700 z-20 relative">
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 uppercase tracking-widest mb-4">สรุปผลภารกิจ</h1>
            <p className="text-blue-300 font-bold text-xl mb-12">สุดยอดสายลับ 5 อันดับแรก</p>
            <div className="flex flex-col gap-4 max-w-3xl mx-auto mb-12">
              {players.slice(0, 5).map((p, index) => (
                <div key={p.id} className={`flex items-center justify-between p-6 rounded-2xl border-2 shadow-2xl ${index === 0 ? 'bg-gradient-to-r from-amber-600/20 to-amber-900/40 border-amber-500' : 'bg-[#112240] border-blue-900/50'}`}>
                  <div className="flex items-center gap-6">
                    <span className={`text-4xl font-black ${index === 0 ? 'text-amber-400' : 'text-blue-500'}`}>#{index + 1}</span>
                    <span className="text-3xl font-black text-white tracking-wider flex items-center gap-3"><span className="text-4xl">{p.avatar}</span> {p.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs uppercase tracking-widest text-slate-400 mb-1">Total Score</span>
                    <span className={`text-4xl font-black ${index === 0 ? 'text-amber-400' : 'text-cyan-400'}`}>{p.score.toFixed(3)}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleReset} className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xl py-5 px-12 rounded-2xl flex items-center justify-center gap-3 mx-auto">
              <RotateCcw /> ปิดห้องเกม
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
