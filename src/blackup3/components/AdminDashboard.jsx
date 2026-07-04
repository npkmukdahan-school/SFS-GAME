import React, { useState, useEffect, useMemo } from 'react';
import { LogIn, LogOut, Plus, Trash2, Edit, Save, X, Users, SearchCheck, Gamepad2, Settings, ShieldCheck, Zap, Activity, AlertTriangle, CheckCircle2, Trophy } from 'lucide-react';
import { db } from '../firebase'; 
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs } from 'firebase/firestore';

const getNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const getScanDate = (scan) => {
  const rawDate = scan.scannedAt || scan.createdAt || scan.updatedAt || scan.timestamp || scan.time;

  if (!rawDate) return null;
  if (typeof rawDate.toDate === 'function') return rawDate.toDate();
  if (typeof rawDate === 'number') return new Date(rawDate);
  if (typeof rawDate === 'string') {
    const parsedDate = new Date(rawDate);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
};

const isInPeriod = (date, period) => {
  if (period === 'all') return true;
  if (!date) return false;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);

  if (period === 'week') {
    startDate.setDate(now.getDate() - 6);
    return date >= startDate;
  }

  if (period === 'month') {
    startDate.setDate(1);
    return date >= startDate;
  }

  return true;
};

const getFoodFromScan = (scan) => {
  const food = scan.food || scan.foodData || scan.item || {};

  return {
    name: food.name || scan.foodName || scan.itemName || scan.name || 'ไม่ระบุชื่ออาหาร',
    type: food.type || food.category || scan.foodType || scan.category || scan.type || 'ไม่ระบุประเภท',
    barcode: food.barcode || scan.barcode || '-',
    sugar: getNumber(food.sugar ?? scan.sugar),
    fat: getNumber(food.fat ?? scan.fat),
    salt: getNumber(food.salt ?? food.sodium ?? scan.salt ?? scan.sodium),
    score: getNumber(scan.foodScore ?? scan.averageScore ?? scan.average ?? scan.score ?? food.score),
  };
};

const average = (list, selector) => {
  if (!list.length) return 0;
  return list.reduce((sum, item) => sum + selector(item), 0) / list.length;
};

const getScoreLabel = (score) => {
  if (score >= 4.2) return { label: 'เลือกได้ดีมาก', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (score >= 3.2) return { label: 'พอใช้ ควรสังเกตฉลาก', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
  if (score >= 2.2) return { label: 'ควรลดความถี่', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
  return { label: 'ควรแนะนำเป็นพิเศษ', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' };
};

export default function AdminDashboard() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('foods'); // 'foods' or 'students'

  // --- Foods Data State ---
  const [foods, setFoods] = useState([]);
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [editingFoodId, setEditingFoodId] = useState(null); 
  const [newFood, setNewFood] = useState({ name: '', type: 'ขนม', sugar: 0, fat: 0, salt: 0, barcode: '', videoUrl: '' });

  // --- Players/Analytics Data State ---
  const [allPlayers, setAllPlayers] = useState([]);
  const [allScans, setAllScans] = useState([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedPlayerId, setSelectedPlayerId] = useState('all');
  const [selectedRoomId, setSelectedRoomId] = useState('all');
  const [analytics, setAnalytics] = useState({
      totalPlayers: 0,
      totalScanned: 0,
      avgScore: 0,
      topPlayer: null
  });

  // --- Real-time Fetching (Foods) ---
  useEffect(() => {
    if (isAdminLoggedIn && activeTab === 'foods') {
      const foodsCollectionRef = collection(db, 'foods');
      const unsubscribe = onSnapshot(foodsCollectionRef, (snapshot) => {
        const foodsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFoods(foodsData);
      });
      return () => unsubscribe();
    }
  }, [isAdminLoggedIn, activeTab]);

  // --- Fetching Analytics Data (Students Tab) ---
  useEffect(() => {
    if (isAdminLoggedIn && activeTab === 'students') {
        fetchAllPlayersData();
    }
  }, [isAdminLoggedIn, activeTab]);

  const fetchAllPlayersData = async () => {
      setIsLoadingPlayers(true);
      try {
          // ในโครงสร้าง Firebase ของเรา ข้อมูลผู้เล่นอยู่ใต้ Collection 'rooms' -> 'players'
          // เราต้องดึงทุกห้องออกมาก่อน แล้วค่อยไปดึงผู้เล่นในแต่ละห้อง
          const roomsRef = collection(db, 'rooms');
          const roomsSnap = await getDocs(roomsRef);
          
          let playersTemp = [];
          let scansTemp = [];
          let totalScanned = 0;
          let totalScore = 0;

          for (const roomDoc of roomsSnap.docs) {
              const roomId = roomDoc.id;
              const roomData = roomDoc.data();
              const playersRef = collection(db, 'rooms', roomId, 'players');
              const playersSnap = await getDocs(playersRef);
              
              playersSnap.forEach((playerDoc) => {
                  const data = playerDoc.data();
                  playersTemp.push({
                      id: playerDoc.id,
                      roomId: roomId,
                      roomName: roomData.name || roomData.title || roomId,
                      ...data
                  });
                  totalScanned += getNumber(data.itemsScanned);
                  totalScore += getNumber(data.score);
              });

              const scansRef = collection(db, 'rooms', roomId, 'scans');
              const scansSnap = await getDocs(scansRef);

              scansSnap.forEach((scanDoc) => {
                  const data = scanDoc.data();
                  const food = getFoodFromScan(data);
                  const scanDate = getScanDate(data);

                  scansTemp.push({
                      id: scanDoc.id,
                      roomId,
                      roomName: roomData.name || roomData.title || roomId,
                      playerId: data.playerId || data.uid || data.userId || '',
                      playerName: data.playerName || data.name || data.studentName || 'ไม่ระบุชื่อ',
                      avatar: data.avatar || '',
                      scanDate,
                      dateText: scanDate ? scanDate.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : 'ไม่ระบุวันที่',
                      ...food,
                  });
              });
          }

          // เรียงลำดับตามคะแนน (มากไปน้อย) ป้องกันกรณี score เป็น undefined
          playersTemp.sort((a, b) => getNumber(b.score) - getNumber(a.score));
          scansTemp.sort((a, b) => (b.scanDate?.getTime() || 0) - (a.scanDate?.getTime() || 0));
          setAllPlayers(playersTemp);
          setAllScans(scansTemp);

          // คำนวณสถิติภาพรวม
          const playerCount = playersTemp.length;
          const scanCount = scansTemp.length || totalScanned;
          setAnalytics({
              totalPlayers: playerCount,
              totalScanned: scanCount,
              avgScore: playerCount > 0 ? (totalScore / playerCount).toFixed(2) : "0.00",
              topPlayer: playerCount > 0 ? playersTemp[0] : null
          });

      } catch (error) {
          console.error("Error fetching players data:", error);
      } finally {
          setIsLoadingPlayers(false);
      }
  };

  const roomOptions = useMemo(() => {
      const uniqueRooms = new Map();
      allPlayers.forEach((player) => uniqueRooms.set(player.roomId, player.roomName || player.roomId));
      allScans.forEach((scan) => uniqueRooms.set(scan.roomId, scan.roomName || scan.roomId));
      return Array.from(uniqueRooms, ([id, name]) => ({ id, name }));
  }, [allPlayers, allScans]);

  const playerOptions = useMemo(() => {
      const uniquePlayers = new Map();

      allPlayers.forEach((player) => {
          uniquePlayers.set(player.id, {
              id: player.id,
              name: player.name || 'ไม่ระบุชื่อ',
              roomId: player.roomId,
              avatar: player.avatar || '',
          });
      });

      allScans.forEach((scan) => {
          if (!scan.playerId) return;
          uniquePlayers.set(scan.playerId, {
              id: scan.playerId,
              name: scan.playerName || 'ไม่ระบุชื่อ',
              roomId: scan.roomId,
              avatar: scan.avatar || uniquePlayers.get(scan.playerId)?.avatar || '',
          });
      });

      return Array.from(uniquePlayers.values()).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [allPlayers, allScans]);

  const filteredScans = useMemo(() => {
      return allScans.filter((scan) => {
          const matchPeriod = isInPeriod(scan.scanDate, selectedPeriod);
          const matchPlayer = selectedPlayerId === 'all' || scan.playerId === selectedPlayerId;
          const matchRoom = selectedRoomId === 'all' || scan.roomId === selectedRoomId;
          return matchPeriod && matchPlayer && matchRoom;
      });
  }, [allScans, selectedPeriod, selectedPlayerId, selectedRoomId]);

  const selectedPlayer = useMemo(() => {
      if (selectedPlayerId === 'all') return null;
      return playerOptions.find((player) => player.id === selectedPlayerId) || null;
  }, [playerOptions, selectedPlayerId]);

  const scanSummary = useMemo(() => {
      const categoryMap = new Map();
      const playerMap = new Map();
      const dailyMap = new Map();

      filteredScans.forEach((scan) => {
          categoryMap.set(scan.type, (categoryMap.get(scan.type) || 0) + 1);
          const playerKey = scan.playerId || `${scan.roomId}-${scan.playerName}`;
          const currentPlayer = playerMap.get(playerKey) || {
              id: playerKey,
              name: scan.playerName,
              avatar: scan.avatar,
              roomId: scan.roomId,
              count: 0,
              score: 0,
              sugar: 0,
              fat: 0,
              salt: 0,
          };

          currentPlayer.count += 1;
          currentPlayer.score += scan.score;
          currentPlayer.sugar += scan.sugar;
          currentPlayer.fat += scan.fat;
          currentPlayer.salt += scan.salt;
          playerMap.set(playerKey, currentPlayer);

          dailyMap.set(scan.dateText, (dailyMap.get(scan.dateText) || 0) + 1);
      });

      const categorySummary = Array.from(categoryMap, ([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count);

      const playerSummary = Array.from(playerMap.values())
          .map((player) => ({
              ...player,
              avgScore: player.count ? player.score / player.count : 0,
              avgSugar: player.count ? player.sugar / player.count : 0,
              avgFat: player.count ? player.fat / player.count : 0,
              avgSalt: player.count ? player.salt / player.count : 0,
          }))
          .sort((a, b) => b.avgScore - a.avgScore);

      const dailySummary = Array.from(dailyMap, ([date, count]) => ({ date, count })).slice(0, 7);

      return {
          totalScans: filteredScans.length,
          avgScore: average(filteredScans, (scan) => scan.score),
          avgSugar: average(filteredScans, (scan) => scan.sugar),
          avgFat: average(filteredScans, (scan) => scan.fat),
          avgSalt: average(filteredScans, (scan) => scan.salt),
          categorySummary,
          playerSummary,
          dailySummary,
          latestScans: filteredScans.slice(0, 10),
      };
  }, [filteredScans]);

  const scoreLevel = getScoreLabel(scanSummary.avgScore);

  const handleLogin = (e) => {
    e.preventDefault();
    if (email === 'admin@sfs.com' && password === '123456') {
      setIsAdminLoggedIn(true);
    } else {
      alert("รหัสผ่านไม่ถูกต้อง (ทดสอบใช้: admin@sfs.com / 123456)");
    }
  };

  const handleLogout = () => {
    setIsAdminLoggedIn(false);
    setEmail('');
    setPassword('');
  };

  // --- Firebase CRUD Operations (Foods) ---
  const handleAddFood = async (e) => {
    e.preventDefault();
    try {
      if (editingFoodId) {
        const foodDocRef = doc(db, 'foods', editingFoodId);
        await updateDoc(foodDocRef, { ...newFood });
        alert('แก้ไขข้อมูลสำเร็จ');
      } else {
        const foodsCollectionRef = collection(db, 'foods');
        await addDoc(foodsCollectionRef, { ...newFood });
        alert('เพิ่มข้อมูลสำเร็จ');
      }
      setIsAddingFood(false);
      setEditingFoodId(null);
      setNewFood({ name: '', type: 'ขนม', sugar: 0, fat: 0, salt: 0, barcode: '', videoUrl: '' });
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
    }
  };

  const startEditFood = (food) => {
    setNewFood({
        name: food.name, type: food.type, sugar: food.sugar, fat: food.fat, salt: food.salt,
        barcode: food.barcode || '', videoUrl: food.videoUrl || ''
    });
    setEditingFoodId(food.id);
    setIsAddingFood(true);
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const handleDeleteFood = async (id) => {
    if(window.confirm("ยืนยันการลบข้อมูลใช่หรือไม่? ข้อมูลนี้จะหายไปจากระบบอย่างถาวร")) {
      try {
        await deleteDoc(doc(db, 'foods', id));
      } catch (error) {
         alert("ลบข้อมูลไม่สำเร็จ: " + error.message);
      }
    }
  };

  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a192f] p-4 font-sans relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-sky-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="bg-[#112240]/80 backdrop-blur-xl border border-blue-500/30 rounded-[2rem] shadow-[0_0_50px_rgba(37,99,235,0.2)] w-full max-w-md overflow-hidden relative z-10">
          <div className="p-10 text-center border-b border-blue-500/20">
            <div className="w-20 h-20 mx-auto bg-gradient-to-tr from-blue-600 to-sky-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/50 rotate-3">
              <ShieldCheck className="w-12 h-12 text-white -rotate-3" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-wider uppercase drop-shadow-md">Admin Portal</h1>
            <p className="text-blue-300 mt-2 font-bold tracking-widest text-sm uppercase">SFS Game Control</p>
          </div>
          
          <form onSubmit={handleLogin} className="p-10 space-y-6">
            <div className="space-y-1">
              <label className="text-xs font-black text-blue-400 uppercase tracking-wider">Access ID (Email)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-5 py-4 rounded-xl border-2 border-blue-900/50 focus:border-blue-500 bg-[#0a192f] text-white font-medium outline-none transition-all placeholder:text-blue-800"
                placeholder="admin@sfs.com" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-blue-400 uppercase tracking-wider">Passcode</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-5 py-4 rounded-xl border-2 border-blue-900/50 focus:border-blue-500 bg-[#0a192f] text-white font-medium outline-none transition-all placeholder:text-blue-800"
                placeholder="••••••••" />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black text-lg py-4 px-4 rounded-xl flex justify-center items-center gap-3 transition-all transform active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] uppercase tracking-wider mt-4">
              <LogIn size={24} /> Initialize
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col md:flex-row font-sans selection:bg-blue-300">
      {/* Sidebar - Game Style */}
      <aside className="w-full md:w-72 bg-[#0a192f] text-slate-300 flex flex-col shadow-2xl z-20">
        <div className="p-8 border-b border-blue-900/50 flex flex-col items-center">
          <div className="bg-blue-600 p-3 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.5)] mb-4">
            <Gamepad2 size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-widest uppercase">SFS Dashboard</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">System Online</span>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-4">
          <button onClick={() => setActiveTab('foods')}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl font-bold transition-all duration-300 relative overflow-hidden group ${activeTab === 'foods' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'hover:bg-[#112240] hover:text-white'}`}>
            {activeTab === 'foods' && <span className="absolute left-0 top-0 w-1 h-full bg-sky-400"></span>}
            <Settings size={20} className={activeTab === 'foods' ? 'text-sky-300' : 'text-blue-500 group-hover:text-sky-400'} /> 
            <span className="tracking-wide">จัดการคลังอาหาร</span>
          </button>
          
          <button onClick={() => setActiveTab('students')}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl font-bold transition-all duration-300 relative overflow-hidden group ${activeTab === 'students' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'hover:bg-[#112240] hover:text-white'}`}>
             {activeTab === 'students' && <span className="absolute left-0 top-0 w-1 h-full bg-sky-400"></span>}
            <Activity size={20} className={activeTab === 'students' ? 'text-sky-300' : 'text-blue-500 group-hover:text-sky-400'} /> 
            <span className="tracking-wide">ตรวจสอบผู้เล่น (Analytics)</span>
          </button>
        </nav>
        
        <div className="p-6 border-t border-blue-900/50 bg-[#061020]">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-xl bg-transparent border-2 border-rose-900/50 text-rose-500 hover:bg-rose-900/30 hover:border-rose-500 font-bold transition-all uppercase tracking-widest text-sm">
            <LogOut size={18} /> System Exit
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNjYmQ1ZTEiIG9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==')] opacity-50 z-0 pointer-events-none"></div>

        <div className="relative z-10 max-w-6xl mx-auto">
          {/* ========================================== */}
          {/* TAB 1: FOODS MANAGEMENT                      */}
          {/* ========================================== */}
          {activeTab === 'foods' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Header Panel */}
              <div className="bg-white rounded-3xl p-8 mb-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-5">
                  <div className="bg-blue-100 p-4 rounded-2xl">
                    <Zap className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">ฐานข้อมูลโภชนาการ</h1>
                    <p className="text-slate-500 font-medium mt-1">จัดการข้อมูลอาหารที่เชื่อมโยงกับ Firebase โดยตรง</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsAddingFood(true); setEditingFoodId(null);
                    setNewFood({ name: '', type: 'ขนม', sugar: 0, fat: 0, salt: 0, barcode: '', videoUrl: '' });
                  }} 
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-3 shadow-[0_8px_20px_rgba(37,99,235,0.3)] transition-transform active:scale-95"
                >
                  <Plus size={22} strokeWidth={3} /> เพิ่มรายการใหม่
                </button>
              </div>

              {/* Add/Edit Food Form Module */}
              {isAddingFood && (
                <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.1)] mb-8 border border-slate-200 overflow-hidden relative border-t-8 border-t-blue-500">
                  <div className="bg-slate-50 px-8 py-5 flex justify-between items-center border-b border-slate-200">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                       {editingFoodId ? <><Edit className="text-blue-500"/> แก้ไขข้อมูลไอเทม</> : <><Plus className="text-blue-500"/> บันทึกข้อมูลไอเทมใหม่</>}
                    </h3>
                    <button onClick={() => { setIsAddingFood(false); setEditingFoodId(null); }} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-full transition-colors">
                      <X size={24} />
                    </button>
                  </div>
                  
                  <form onSubmit={handleAddFood} className="p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
                    {/* Basic Info */}
                    <div className="md:col-span-8">
                      <label className="block text-sm font-bold text-slate-600 uppercase tracking-wider mb-2">ชื่ออาหาร (Item Name)</label>
                      <input type="text" required value={newFood.name} onChange={(e)=>setNewFood({...newFood, name: e.target.value})} className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-blue-500 outline-none font-bold text-lg text-slate-800" placeholder="ระบุชื่อไอเทม..." />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-sm font-bold text-slate-600 uppercase tracking-wider mb-2">ประเภท (Category)</label>
                      <select value={newFood.type} onChange={(e)=>setNewFood({...newFood, type: e.target.value})} className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-blue-500 outline-none font-black text-slate-700 bg-white cursor-pointer text-lg">
                        <option value="ขนม">🍪 ขนม (Snack)</option><option value="เครื่องดื่ม">🥤 เครื่องดื่ม (Drink)</option><option value="ไอศกรีม">🍦 ไอศกรีม (Ice Cream)</option>
                      </select>
                    </div>

                    {/* Game Link Info */}
                    <div className="md:col-span-6">
                      <label className="block text-sm font-bold text-slate-600 uppercase tracking-wider mb-2">รหัสบาร์โค้ด (Barcode)</label>
                      <input type="text" value={newFood.barcode} onChange={(e)=>setNewFood({...newFood, barcode: e.target.value})} className="w-full px-5 py-3 rounded-2xl border-2 border-slate-200 focus:border-blue-500 outline-none transition-all font-medium text-slate-800 bg-slate-50" placeholder="เช่น 8850001 (เว้นว่างได้)" />
                    </div>
                    <div className="md:col-span-6">
                      <label className="block text-sm font-bold text-slate-600 uppercase tracking-wider mb-2">ลิงก์วิดีโอ (Video URL)</label>
                      <input type="url" value={newFood.videoUrl} onChange={(e)=>setNewFood({...newFood, videoUrl: e.target.value})} className="w-full px-5 py-3 rounded-2xl border-2 border-slate-200 focus:border-blue-500 outline-none transition-all font-medium text-slate-800 bg-slate-50" placeholder="ลิงก์ MP4 ที่จะโชว์ตอนเด็กสแกนเจอ" />
                    </div>

                    {/* Stats Inputs */}
                    <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                      <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 relative group hover:border-pink-300 transition-colors">
                        <div className="absolute -top-4 left-6 bg-pink-100 text-pink-600 px-4 py-1 rounded-full font-black text-sm uppercase tracking-wider border-2 border-white shadow-sm">น้ำตาล (Sugar)</div>
                        <div className="flex items-end gap-3 mt-4">
                          <input type="number" required min="0" step="0.1" value={newFood.sugar} onChange={(e)=>setNewFood({...newFood, sugar: Number(e.target.value)})} className="w-full px-2 py-2 border-b-4 border-slate-300 focus:border-pink-500 outline-none font-black text-4xl text-slate-800 text-center bg-transparent transition-colors" />
                          <span className="font-bold text-slate-400 mb-2">กรัม</span>
                        </div>
                      </div>
                      <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 relative group hover:border-amber-300 transition-colors">
                        <div className="absolute -top-4 left-6 bg-amber-100 text-amber-600 px-4 py-1 rounded-full font-black text-sm uppercase tracking-wider border-2 border-white shadow-sm">ไขมัน (Fat)</div>
                        <div className="flex items-end gap-3 mt-4">
                          <input type="number" required min="0" step="0.1" value={newFood.fat} onChange={(e)=>setNewFood({...newFood, fat: Number(e.target.value)})} className="w-full px-2 py-2 border-b-4 border-slate-300 focus:border-amber-500 outline-none font-black text-4xl text-slate-800 text-center bg-transparent transition-colors" />
                          <span className="font-bold text-slate-400 mb-2">กรัม</span>
                        </div>
                      </div>
                      <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 relative group hover:border-sky-300 transition-colors">
                        <div className="absolute -top-4 left-6 bg-sky-100 text-sky-600 px-4 py-1 rounded-full font-black text-sm uppercase tracking-wider border-2 border-white shadow-sm">โซเดียม (Salt)</div>
                        <div className="flex items-end gap-3 mt-4">
                          <input type="number" required min="0" step="1" value={newFood.salt} onChange={(e)=>setNewFood({...newFood, salt: Number(e.target.value)})} className="w-full px-2 py-2 border-b-4 border-slate-300 focus:border-sky-500 outline-none font-black text-4xl text-slate-800 text-center bg-transparent transition-colors" />
                          <span className="font-bold text-slate-400 mb-2">มก.</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-12 flex justify-end gap-4 mt-4 border-t border-slate-100 pt-6">
                      <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-black py-4 px-10 rounded-2xl flex items-center gap-3 shadow-[0_6px_0_rgb(15,23,42)] active:shadow-none active:translate-y-[6px] transition-all text-lg uppercase tracking-wider">
                        <Save size={24}/> บันทึกข้อมูลลง Firebase
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Data Table */}
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="text-xl font-black text-slate-700 flex items-center gap-3"><SearchCheck className="text-blue-500 w-6 h-6"/> รายการอาหารในระบบ</h3>
                  <span className="bg-blue-100 text-blue-700 font-black px-4 py-1 rounded-full text-sm">Total: {foods.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white text-slate-400 text-xs uppercase tracking-widest border-b-2 border-slate-100">
                        <th className="px-6 py-5 font-black">Item Info</th>
                        <th className="px-6 py-5 font-black text-center text-pink-500">Sugar</th>
                        <th className="px-6 py-5 font-black text-center text-amber-500">Fat</th>
                        <th className="px-6 py-5 font-black text-center text-sky-500">Salt</th>
                        <th className="px-6 py-5 font-black text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {foods.length === 0 ? (
                        <tr><td colSpan="6" className="p-20 text-center text-slate-400 font-bold bg-slate-50">ยังไม่มีข้อมูลใน Firebase. กดปุ่ม 'เพิ่มรายการใหม่' ด้านบน</td></tr>
                      ) : foods.map((food) => (
                        <tr key={food.id} className="hover:bg-blue-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                                <span className="font-black text-slate-800 text-lg">{food.name}</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-slate-200">{food.type}</span>
                                    {food.barcode && <span className="text-xs text-slate-400 font-mono">#{food.barcode}</span>}
                                </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-black text-slate-600">{food.sugar} <span className="text-xs text-slate-400 font-bold">g</span></td>
                          <td className="px-6 py-4 text-center font-black text-slate-600">{food.fat} <span className="text-xs text-slate-400 font-bold">g</span></td>
                          <td className="px-6 py-4 text-center font-black text-slate-600">{food.salt} <span className="text-xs text-slate-400 font-bold">mg</span></td>
                          <td className="px-6 py-4 flex justify-center gap-2 mt-2">
                            <button onClick={() => startEditFood(food)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"><Edit size={18} /></button>
                            <button onClick={() => handleDeleteFood(food.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-xl transition-colors"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 2: STUDENTS / PLAYERS ANALYTICS          */}
          {/* ========================================== */}
          {activeTab === 'students' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white rounded-3xl p-8 mb-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                   <div className="flex items-center gap-5">
                      <div className="bg-indigo-100 p-4 rounded-2xl">
                         <Activity className="w-8 h-8 text-indigo-600" />
                      </div>
                      <div>
                         <h1 className="text-3xl font-black text-slate-800 tracking-tight">ตรวจสอบข้อมูลผู้เล่น</h1>
                         <p className="text-slate-500 font-medium mt-1">วิเคราะห์ผลการเลือกบริโภคอาหารของเด็กแบบรายคน รายสัปดาห์ และรายเดือน</p>
                      </div>
                   </div>
                   <button onClick={fetchAllPlayersData} className="w-full lg:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                      <SearchCheck size={18}/> โหลดข้อมูลล่าสุด
                   </button>
                </div>

                <div className="bg-white rounded-3xl p-6 mb-8 border border-slate-200 shadow-sm">
                   <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
                      <div className="lg:col-span-4">
                         <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">ช่วงเวลาสรุปผล</label>
                         <div className="grid grid-cols-3 gap-2 bg-slate-100 p-2 rounded-2xl">
                            {[
                              { id: 'week', label: 'รายสัปดาห์' },
                              { id: 'month', label: 'รายเดือน' },
                              { id: 'all', label: 'ทั้งหมด' },
                            ].map((period) => (
                              <button
                                key={period.id}
                                onClick={() => setSelectedPeriod(period.id)}
                                className={`py-3 rounded-xl font-black text-sm transition-all ${selectedPeriod === period.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}
                              >
                                {period.label}
                              </button>
                            ))}
                         </div>
                      </div>
                      <div className="lg:col-span-4">
                         <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">เลือกดูรายคน</label>
                         <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-indigo-500 outline-none font-bold text-slate-700 bg-white">
                            <option value="all">ดูภาพรวมผู้เล่นทั้งหมด</option>
                            {playerOptions.map((player) => (
                              <option key={player.id} value={player.id}>{player.name} - ห้อง {player.roomId}</option>
                            ))}
                         </select>
                      </div>
                      <div className="lg:col-span-3">
                         <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">ห้องเรียน / Room</label>
                         <select value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-indigo-500 outline-none font-bold text-slate-700 bg-white">
                            <option value="all">ทุกห้อง</option>
                            {roomOptions.map((room) => (
                              <option key={room.id} value={room.id}>{room.name}</option>
                            ))}
                         </select>
                      </div>
                      <div className="lg:col-span-1">
                         <button
                           onClick={() => {
                             setSelectedPeriod('week');
                             setSelectedPlayerId('all');
                             setSelectedRoomId('all');
                           }}
                           className="w-full py-4 rounded-2xl bg-slate-800 text-white font-black hover:bg-slate-900 transition-colors"
                         >
                           รีเซ็ต
                         </button>
                      </div>
                   </div>
                </div>

                {isLoadingPlayers ? (
                   <div className="py-20 text-center text-slate-500 font-bold">กำลังดึงข้อมูลจาก Firebase...</div>
                ) : (
                   <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
                         <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <span className="text-slate-400 font-bold text-sm uppercase tracking-wider flex items-center gap-2 mb-2"><Users size={16}/> ผู้เล่นทั้งหมด</span>
                            <span className="text-4xl font-black text-slate-800">{analytics.totalPlayers} <span className="text-lg font-bold text-slate-400">คน</span></span>
                         </div>
                         <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <span className="text-slate-400 font-bold text-sm uppercase tracking-wider flex items-center gap-2 mb-2"><SearchCheck size={16}/> รายการที่เลือก</span>
                            <span className="text-4xl font-black text-blue-600">{scanSummary.totalScans} <span className="text-lg font-bold text-blue-400">ครั้ง</span></span>
                         </div>
                         <div className={`p-6 rounded-3xl border shadow-sm ${scoreLevel.bg} ${scoreLevel.border}`}>
                            <span className={`font-bold text-sm uppercase tracking-wider flex items-center gap-2 mb-2 ${scoreLevel.color}`}><CheckCircle2 size={16}/> คุณภาพการเลือก</span>
                            <span className={`text-4xl font-black ${scoreLevel.color}`}>{scanSummary.avgScore.toFixed(2)} <span className="text-lg font-bold">ดาว</span></span>
                            <p className={`mt-2 text-sm font-bold ${scoreLevel.color}`}>{scoreLevel.label}</p>
                         </div>
                         <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <span className="text-slate-400 font-bold text-sm uppercase tracking-wider flex items-center gap-2 mb-2"><AlertTriangle size={16}/> เฉลี่ยต่อรายการ</span>
                            <div className="space-y-1 font-black text-slate-700">
                               <p>น้ำตาล {scanSummary.avgSugar.toFixed(1)} g</p>
                               <p>ไขมัน {scanSummary.avgFat.toFixed(1)} g</p>
                               <p>โซเดียม {scanSummary.avgSalt.toFixed(0)} mg</p>
                            </div>
                         </div>
                         <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 rounded-3xl border border-orange-400 shadow-md text-white relative overflow-hidden">
                            <Trophy className="absolute right-[-20px] bottom-[-20px] w-32 h-32 text-orange-600 opacity-30" />
                            <span className="font-black text-sm uppercase tracking-wider mb-2 relative z-10">Top Player</span>
                            {analytics.topPlayer ? (
                               <div className="relative z-10">
                                   <div className="text-2xl font-black truncate">{analytics.topPlayer.name || 'ไม่ทราบชื่อ'}</div>
                                   <div className="font-bold text-amber-100">{getNumber(analytics.topPlayer.score).toFixed(3)} คะแนน</div>
                               </div>
                            ) : (
                               <div className="text-xl font-bold relative z-10 opacity-70">ยังไม่มีข้อมูล</div>
                            )}
                         </div>
                      </div>

                      {selectedPlayer && (
                        <div className="bg-indigo-950 text-white rounded-3xl p-7 shadow-lg overflow-hidden relative">
                          <Activity className="absolute right-[-24px] top-[-24px] w-40 h-40 text-indigo-800 opacity-50" />
                          <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-5 items-center">
                            <div className="md:col-span-2 flex items-center gap-4">
                              <span className="text-5xl bg-white/10 rounded-3xl p-3">{selectedPlayer.avatar || '👤'}</span>
                              <div>
                                <p className="text-indigo-200 font-bold">กำลังดูรายบุคคล</p>
                                <h2 className="text-3xl font-black">{selectedPlayer.name}</h2>
                                <p className="text-indigo-200 font-bold">ห้อง {selectedPlayer.roomId}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-indigo-200 font-bold">จำนวนครั้งที่สแกน</p>
                              <p className="text-3xl font-black">{scanSummary.totalScans} ครั้ง</p>
                            </div>
                            <div>
                              <p className="text-indigo-200 font-bold">คะแนนเฉลี่ย</p>
                              <p className="text-3xl font-black">{scanSummary.avgScore.toFixed(2)} ดาว</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-xl font-black text-slate-700">สรุปประเภทอาหารที่เด็กเลือก</h3>
                            <p className="text-sm text-slate-400 font-bold mt-1">ใช้ดูแนวโน้มว่าเด็กเลือกขนม เครื่องดื่ม หรือไอศกรีมมากที่สุด</p>
                          </div>
                          <div className="p-8 space-y-5">
                            {scanSummary.categorySummary.length === 0 ? (
                              <div className="text-center text-slate-400 font-bold py-12">ยังไม่มีข้อมูลการสแกนในช่วงที่เลือก</div>
                            ) : scanSummary.categorySummary.map((item) => {
                              const maxCount = Math.max(...scanSummary.categorySummary.map((category) => category.count), 1);
                              return (
                                <div key={item.type}>
                                  <div className="flex justify-between mb-2 font-black text-slate-700">
                                    <span>{item.type}</span>
                                    <span>{item.count} ครั้ง</span>
                                  </div>
                                  <div className="h-4 rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400" style={{ width: `${(item.count / maxCount) * 100}%` }}></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-xl font-black text-slate-700">แนวโน้มการสแกนล่าสุด</h3>
                            <p className="text-sm text-slate-400 font-bold mt-1">สรุปจำนวนครั้งตามวันที่ เพื่อดูความสม่ำเสมอของการเล่น</p>
                          </div>
                          <div className="p-8 space-y-4">
                            {scanSummary.dailySummary.length === 0 ? (
                              <div className="text-center text-slate-400 font-bold py-12">ยังไม่มีข้อมูลรายวัน</div>
                            ) : scanSummary.dailySummary.map((item) => (
                              <div key={item.date} className="flex items-center justify-between bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                <span className="font-black text-slate-700">{item.date}</span>
                                <span className="font-black text-indigo-600">{item.count} ครั้ง</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                           <div>
                             <h3 className="text-xl font-black text-slate-700">ตารางวิเคราะห์รายบุคคล</h3>
                             <p className="text-sm text-slate-400 font-bold mt-1">เรียงตามคะแนนเฉลี่ยจากอาหารที่เลือกในช่วงเวลาที่กรอง</p>
                           </div>
                        </div>
                        <div className="overflow-x-auto">
                           <table className="w-full text-left border-collapse">
                              <thead>
                                 <tr className="bg-white text-slate-400 text-xs uppercase tracking-widest border-b-2 border-slate-100">
                                    <th className="px-6 py-5 font-black w-16 text-center">อันดับ</th>
                                    <th className="px-6 py-5 font-black">ผู้เล่น</th>
                                    <th className="px-6 py-5 font-black text-center">สแกน</th>
                                    <th className="px-6 py-5 font-black text-center text-pink-500">น้ำตาลเฉลี่ย</th>
                                    <th className="px-6 py-5 font-black text-center text-amber-500">ไขมันเฉลี่ย</th>
                                    <th className="px-6 py-5 font-black text-center text-sky-500">โซเดียมเฉลี่ย</th>
                                    <th className="px-6 py-5 font-black text-right text-cyan-600">คะแนนเฉลี่ย</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                 {scanSummary.playerSummary.length === 0 ? (
                                    <tr><td colSpan="7" className="p-20 text-center text-slate-400 font-bold bg-slate-50">ยังไม่มีประวัติการสแกนในช่วงที่เลือก</td></tr>
                                 ) : scanSummary.playerSummary.map((player, index) => (
                                    <tr key={player.id} className="hover:bg-slate-50 transition-colors">
                                       <td className="px-6 py-4 text-center">
                                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black ${index === 0 ? 'bg-amber-100 text-amber-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-orange-100 text-orange-600' : 'text-slate-400'}`}>
                                             {index + 1}
                                          </span>
                                       </td>
                                       <td className="px-6 py-4">
                                          <div className="flex items-center gap-3">
                                             <span className="text-3xl bg-slate-100 rounded-full p-1 border border-slate-200">{player.avatar || '👤'}</span>
                                             <div>
                                                <span className="block font-black text-slate-800 text-lg">{player.name}</span>
                                                <span className="block font-mono text-xs font-bold text-slate-400">#{player.roomId}</span>
                                             </div>
                                          </div>
                                       </td>
                                       <td className="px-6 py-4 text-center font-black text-slate-600">{player.count} ครั้ง</td>
                                       <td className="px-6 py-4 text-center font-black text-slate-600">{player.avgSugar.toFixed(1)} g</td>
                                       <td className="px-6 py-4 text-center font-black text-slate-600">{player.avgFat.toFixed(1)} g</td>
                                       <td className="px-6 py-4 text-center font-black text-slate-600">{player.avgSalt.toFixed(0)} mg</td>
                                       <td className="px-6 py-4 text-right font-black text-xl text-cyan-600">{player.avgScore.toFixed(2)}</td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                      </div>

                      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50">
                           <h3 className="text-xl font-black text-slate-700">ประวัติการเลือกอาหารล่าสุด</h3>
                           <p className="text-sm text-slate-400 font-bold mt-1">แสดงอาหารที่นักเรียนสแกน พร้อมค่าน้ำตาล ไขมัน และโซเดียม</p>
                        </div>
                        <div className="overflow-x-auto">
                           <table className="w-full text-left border-collapse">
                              <thead>
                                 <tr className="bg-white text-slate-400 text-xs uppercase tracking-widest border-b-2 border-slate-100">
                                    <th className="px-6 py-5 font-black">วันที่</th>
                                    <th className="px-6 py-5 font-black">ผู้เล่น</th>
                                    <th className="px-6 py-5 font-black">อาหารที่เลือก</th>
                                    <th className="px-6 py-5 font-black text-center">ประเภท</th>
                                    <th className="px-6 py-5 font-black text-center">หวาน/มัน/เค็ม</th>
                                    <th className="px-6 py-5 font-black text-right">คะแนน</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                 {scanSummary.latestScans.length === 0 ? (
                                    <tr><td colSpan="6" className="p-20 text-center text-slate-400 font-bold bg-slate-50">ยังไม่มีรายการอาหารล่าสุด</td></tr>
                                 ) : scanSummary.latestScans.map((scan) => {
                                    const scanLevel = getScoreLabel(scan.score);
                                    return (
                                      <tr key={scan.id} className="hover:bg-slate-50 transition-colors">
                                         <td className="px-6 py-4 font-bold text-slate-500">{scan.dateText}</td>
                                         <td className="px-6 py-4 font-black text-slate-800">{scan.playerName}</td>
                                         <td className="px-6 py-4">
                                            <span className="block font-black text-slate-800">{scan.name}</span>
                                            <span className="block text-xs font-mono text-slate-400">Barcode: {scan.barcode}</span>
                                         </td>
                                         <td className="px-6 py-4 text-center"><span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-black">{scan.type}</span></td>
                                         <td className="px-6 py-4 text-center font-bold text-slate-600">{scan.sugar}g / {scan.fat}g / {scan.salt}mg</td>
                                         <td className={`px-6 py-4 text-right font-black text-lg ${scanLevel.color}`}>{scan.score.toFixed(2)}</td>
                                      </tr>
                                    );
                                 })}
                              </tbody>
                           </table>
                        </div>
                      </div>
                   </div>
                )}
             </div>
          )}

        </div>
      </main>
    </div>
  );
}
