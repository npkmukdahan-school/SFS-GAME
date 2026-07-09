// src/components/AdminPortal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  BarChart3,
  Bot,
  Database,
  Download,
  Edit3,
  LogOut,
  Plus,
  QrCode,
  Save,
  ShieldCheck,
  Trash2,
  Trophy,
  Users,
  Utensils,
} from 'lucide-react';
import { auth, db } from '../firebase';

const PUBLIC_BASE_URL = import.meta.env.BASE_URL || '/';
const GAME_LOGO_URL = `${PUBLIC_BASE_URL}sfs-game-logo.png`;

const emptyFoodForm = {
  barcode: '',
  name: '',
  category: 'ขนม',
  sugar: '',
  fat: '',
  sodium: '',
  videoUrl: '',
  imageUrl: '',
};

const normalizeBarcode = (value) => String(value || '').replace(/[^\dA-Za-z]/g, '').trim();

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDayKey = (dateValue) => {
  const date = toDate(dateValue) || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekKey = (dateValue) => {
  const date = toDate(dateValue) || new Date();
  const start = new Date(date.getFullYear(), 0, 1);
  const dayDiff = Math.floor((date - start) / 86400000);
  const week = Math.ceil((dayDiff + start.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
};

const formatDateTime = (dateValue) => {
  const date = toDate(dateValue);
  if (!date) return '-';

  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDayLabel = (dateValue) => {
  const date = toDate(dateValue);
  if (!date) return '-';

  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const average = (values) => {
  const validValues = values.map(Number).filter((value) => Number.isFinite(value));
  if (!validValues.length) return 0;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
};

const getTopFoodName = (scans) => {
  const counts = scans.reduce((acc, scan) => {
    const key = scan.foodName || scan.barcode || 'ไม่ระบุ';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0] ? `${sorted[0][0]} (${sorted[0][1]} ครั้ง)` : '-';
};

const getPlayerAverageScore = (player) => {
  const averageScore = Number(player.averageScore);
  if (Number.isFinite(averageScore) && averageScore > 0) return averageScore;

  const itemsScanned = Number(player.itemsScanned || 0);
  const scoreSum = Number(player.scoreSum || 0);
  if (itemsScanned > 0 && Number.isFinite(scoreSum)) return scoreSum / itemsScanned;

  return 0;
};

const clampTargetItems = (value, fallback = 5) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(10, Math.max(5, Math.round(parsed)));
};

const shouldShowRoomInReport = (room) =>
  room?.reportReady === true ||
  room?.includeInReport === true ||
  room?.status === 'finished' ||
  Boolean(room?.finishedAt || room?.finalizedAt || room?.reportFinalizedAt);

const getRoomTargetItems = (room, players = []) => {
  const roomTarget = Number(room?.itemLimit || room?.foodLimit || room?.targetItems || 0);
  if (roomTarget > 0) return clampTargetItems(roomTarget);

  const playerTarget = Number(players.find((player) => Number(player.targetItems || 0) > 0)?.targetItems || 0);
  return playerTarget > 0 ? clampTargetItems(playerTarget) : 5;
};

const isPlayerCompletedMission = (player, targetItems) => {
  const itemsScanned = Number(player.itemsScanned || 0);
  if (player.missionCompleted === true && itemsScanned >= 1) return true;
  return targetItems > 0 && itemsScanned >= targetItems;
};

const getLatestDate = (...dateValues) => {
  const validDates = dateValues
    .map(toDate)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());

  return validDates[0] || null;
};

const getQrCodeUrl = (barcode, size = 180) => {
  const cleanBarcode = normalizeBarcode(barcode);
  if (!cleanBarcode) return '';

  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encodeURIComponent(cleanBarcode)}`;
};

export default function AdminPortal() {
  const [authReady, setAuthReady] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('foods');
  const [mode, setMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    displayName: '',
    schoolName: '',
    email: '',
    password: '',
    botCheck: '',
    website: '',
  });
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [botQuestion, setBotQuestion] = useState(() => {
    const a = Math.floor(2 + Math.random() * 8);
    const b = Math.floor(2 + Math.random() * 8);
    return { a, b, answer: a + b };
  });
  const [foodForm, setFoodForm] = useState(emptyFoodForm);
  const [editingFoodId, setEditingFoodId] = useState('');
  const [foods, setFoods] = useState([]);
  const [saving, setSaving] = useState(false);
  const [foodError, setFoodError] = useState('');
  const [foodMessage, setFoodMessage] = useState('');
  const [profileForm, setProfileForm] = useState({ displayName: '', schoolName: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportData, setReportData] = useState({
    dailyRows: [],
    weeklyRows: [],
    roomRows: [],
    totalPlayers: 0,
    totalCompletedPlayers: 0,
    totalIncompletePlayers: 0,
    totalRooms: 0,
    overallCompletedAvgScore: 0,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAdmin(user);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!admin) {
      setFoods([]);
      return undefined;
    }

    const foodsRef = doc(db, 'admins', admin.uid);
    const loadAdminProfile = async () => {
      const adminSnap = await getDoc(foodsRef);
      const profile = adminSnap.exists()
        ? adminSnap.data()
        : {
            uid: admin.uid,
            email: admin.email || '',
            displayName: admin.displayName || admin.email || 'Admin',
            schoolName: '',
          };

      await setDoc(
        foodsRef,
        {
          uid: admin.uid,
          email: admin.email || '',
          displayName: profile.displayName || admin.displayName || admin.email || 'Admin',
          schoolName: profile.schoolName || '',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setAdminProfile(profile);
      setProfileForm({
        displayName: profile.displayName || admin.displayName || admin.email || '',
        schoolName: profile.schoolName || '',
      });
    };

    loadAdminProfile().catch((error) => {
      setProfileError(`โหลดข้อมูล Admin ไม่ได้: ${error.message}`);
    });

    return undefined;
  }, [admin]);

  useEffect(() => {
    if (!admin) return undefined;

    const unsubscribe = onSnapshot(
      collection(db, 'admins', admin.uid, 'foods'),
      (snapshot) => {
        const items = snapshot.docs
          .map((foodDoc) => ({ id: foodDoc.id, ...foodDoc.data() }))
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'));
        setFoods(items);
        setFoodError('');
      },
      (error) => {
        setFoodError(`โหลดฐานข้อมูลอาหารไม่ได้: ${error.message}`);
      },
    );

    return () => unsubscribe();
  }, [admin]);

  const stats = useMemo(() => {
    const total = foods.length;
    const categoryCount = foods.reduce((acc, item) => {
      const key = item.category || 'ไม่ระบุ';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return { total, categoryCount };
  }, [foods]);

  useEffect(() => {
    if (admin && activeTab === 'reports') {
      loadReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, activeTab]);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');
    setAuthMessage('');

    try {
      if (mode === 'register') {
        if (authForm.website.trim()) {
          setAuthError('ระบบตรวจพบข้อมูลผิดปกติ กรุณาลองใหม่อีกครั้ง');
          return;
        }

        if (Number(authForm.botCheck) !== botQuestion.answer) {
          setAuthError('คำตอบป้องกัน bot ไม่ถูกต้อง');
          return;
        }

        if (!authForm.schoolName.trim()) {
          setAuthError('กรุณากรอกชื่อโรงเรียน');
          return;
        }

        const credential = await createUserWithEmailAndPassword(
          auth,
          authForm.email.trim(),
          authForm.password,
        );

        if (authForm.displayName.trim()) {
          await updateProfile(credential.user, {
            displayName: authForm.displayName.trim(),
          });
        }

        await setDoc(doc(db, 'admins', credential.user.uid), {
          uid: credential.user.uid,
          email: credential.user.email || authForm.email.trim(),
          displayName: authForm.displayName.trim() || credential.user.email || 'Admin',
          schoolName: authForm.schoolName.trim(),
          role: 'admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await signOut(auth);
        setMode('login');
        setAuthForm({
          displayName: '',
          schoolName: '',
          email: authForm.email.trim(),
          password: '',
          botCheck: '',
          website: '',
        });
        setAuthMessage('สมัครสมาชิกสำเร็จแล้ว กรุณาเข้าสู่ระบบ Admin');
        const a = Math.floor(2 + Math.random() * 8);
        const b = Math.floor(2 + Math.random() * 8);
        setBotQuestion({ a, b, answer: a + b });
      } else {
        await signInWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
      }
    } catch (error) {
      setAuthError(error.message || 'ไม่สามารถเข้าสู่ระบบได้');
    }
  };

  const handleFoodSubmit = async (event) => {
    event.preventDefault();
    if (!admin) return;

    const barcode = normalizeBarcode(foodForm.barcode);
    setFoodError('');
    setFoodMessage('');

    if (!barcode) {
      setFoodError('กรุณากรอกรหัสบาร์โค้ด');
      return;
    }

    if (!foodForm.name.trim()) {
      setFoodError('กรุณากรอกชื่ออาหาร/ขนม/เครื่องดื่ม');
      return;
    }

    setSaving(true);
    try {
      const adminFoodRef = doc(db, 'admins', admin.uid, 'foods', barcode);
      const globalFoodRef = doc(db, 'foods', barcode);
      const [adminFoodSnap, globalFoodSnap] = await Promise.all([
        getDoc(adminFoodRef),
        getDoc(globalFoodRef),
      ]);
      const isEditingSameFood = editingFoodId && editingFoodId === barcode;

      if (adminFoodSnap.exists() && !isEditingSameFood) {
        setFoodError(`รหัส ${barcode} มีอยู่ในฐานข้อมูลของ Admin นี้แล้ว กรุณาใช้รหัสอื่น`);
        setSaving(false);
        return;
      }

      if (
        globalFoodSnap.exists() &&
        !isEditingSameFood &&
        globalFoodSnap.data()?.ownerAdminId !== admin.uid
      ) {
        setFoodError(`รหัส ${barcode} ถูกใช้แล้วในระบบ ไม่สามารถสร้าง QR Code ซ้ำได้`);
        setSaving(false);
        return;
      }

      const foodData = {
        barcode,
        qrCodeValue: barcode,
        name: foodForm.name.trim(),
        category: foodForm.category,
        sugar: Number(foodForm.sugar || 0),
        fat: Number(foodForm.fat || 0),
        sodium: Number(foodForm.sodium || 0),
        videoUrl: foodForm.videoUrl.trim(),
        imageUrl: foodForm.imageUrl.trim(),
        ownerAdminId: admin.uid,
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        adminFoodRef,
        foodData,
        { merge: true },
      );

      // สำเนากลางสำหรับห้องเก่าหรือกรณี fallback ตอนสแกน
      await setDoc(
        globalFoodRef,
        foodData,
        { merge: true },
      );

      if (editingFoodId && editingFoodId !== barcode) {
        await Promise.all([
          deleteDoc(doc(db, 'admins', admin.uid, 'foods', editingFoodId)),
          deleteDoc(doc(db, 'foods', editingFoodId)),
        ]);
      }

      setFoodForm(emptyFoodForm);
      setEditingFoodId('');
      setFoodMessage(`บันทึกข้อมูล ${foodData.name} เรียบร้อยแล้ว`);
    } catch (error) {
      console.error('Save food error:', error);
      setFoodError(
        error?.code === 'permission-denied'
          ? 'บันทึกไม่ได้: Firestore Rules ยังไม่อนุญาตให้เขียนข้อมูลอาหาร กรุณาอัปเดต Rules แล้วกด Publish'
          : `บันทึกไม่ได้: ${error.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditFood = (food) => {
    const barcode = normalizeBarcode(food.barcode || food.id);
    setEditingFoodId(barcode);
    setFoodForm({
      barcode,
      name: food.name || '',
      category: food.category || 'ขนม',
      sugar: food.sugar ?? '',
      fat: food.fat ?? '',
      sodium: food.sodium ?? food.salt ?? '',
      videoUrl: food.videoUrl || food.video || food.youtubeUrl || '',
      imageUrl: food.imageUrl || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteFood = async (food) => {
    if (!admin) return;
    const barcode = normalizeBarcode(food.barcode || food.id);
    if (!barcode) return;
    if (!window.confirm(`ต้องการลบ ${food.name || barcode} ใช่ไหม?`)) return;

    await Promise.all([
      deleteDoc(doc(db, 'admins', admin.uid, 'foods', barcode)),
      deleteDoc(doc(db, 'foods', barcode)),
    ]);
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (!admin) return;

    setProfileError('');
    setProfileMessage('');

    if (!profileForm.schoolName.trim()) {
      setProfileError('กรุณากรอกชื่อโรงเรียน');
      return;
    }

    try {
      if (profileForm.displayName.trim()) {
        await updateProfile(admin, { displayName: profileForm.displayName.trim() });
      }

      const nextProfile = {
        uid: admin.uid,
        email: admin.email || '',
        displayName: profileForm.displayName.trim() || admin.email || 'Admin',
        schoolName: profileForm.schoolName.trim(),
        role: 'admin',
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'admins', admin.uid), nextProfile, { merge: true });
      setAdminProfile(nextProfile);
      setProfileMessage('อัปเดตข้อมูล Admin เรียบร้อยแล้ว');
    } catch (error) {
      setProfileError(`อัปเดตข้อมูลไม่ได้: ${error.message}`);
    }
  };

  const loadReports = async () => {
    if (!admin) return;

    setReportLoading(true);
    setReportError('');

    try {
      const roomsSnap = await getDocs(query(collection(db, 'rooms'), where('adminId', '==', admin.uid)));
      const allRooms = roomsSnap.docs.map((roomDoc) => ({ id: roomDoc.id, ...roomDoc.data() }));
      const rooms = allRooms.filter(shouldShowRoomInReport);
      const roomRows = [];
      const dailyMap = new Map();
      const weeklyMap = new Map();

      for (const room of rooms) {
        const [playersSnap, scansSnap] = await Promise.all([
          getDocs(collection(db, 'rooms', room.id, 'players')),
          getDocs(collection(db, 'rooms', room.id, 'scans')),
        ]);

        const rawPlayers = playersSnap.docs.map((playerDoc) => ({ id: playerDoc.id, ...playerDoc.data() }));
        const scans = scansSnap.docs.map((scanDoc) => ({ id: scanDoc.id, ...scanDoc.data() }));
        const players = rawPlayers.filter((player) =>
          player.includeInReport !== false ||
          player.isFinal === true ||
          room.reportReady === true ||
          room.status === 'finished',
        );
        const targetItems = getRoomTargetItems(room, players.length ? players : rawPlayers);
        const completedPlayers = players.filter((player) => isPlayerCompletedMission(player, targetItems));
        const incompletePlayers = players.filter((player) => !isPlayerCompletedMission(player, targetItems));
        const completedPlayerIds = new Set(completedPlayers.map((player) => player.id));
        const completedScans = scans.filter((scan) => {
          const scanPlayerId = scan.playerId || scan.playerDocId || scan.playerSessionId || scan.sessionId || '';
          return completedPlayerIds.has(scanPlayerId);
        });

        const playerDates = players.flatMap((player) => [
          player.updatedAt,
          player.finishedAt,
          player.completedAt,
          player.joinedAt,
          player.startedPlayingAt,
        ]);
        const scanDates = scans.map((scan) => scan.createdAt || scan.scannedAt || scan.updatedAt);
        const latestActivityAt = getLatestDate(
          room.updatedAt,
          room.finishedAt,
          room.createdAt,
          ...playerDates,
          ...scanDates,
        );
        const reportDate = latestActivityAt || toDate(room.finishedAt || room.createdAt || room.updatedAt) || new Date();
        const dayKey = getDayKey(reportDate);
        const weekKey = getWeekKey(reportDate);
        const completedAverageScores = completedPlayers.map(getPlayerAverageScore).filter((value) => value > 0);
        const avgScore = average(completedAverageScores);

        roomRows.push({
          roomCode: room.id,
          dayKey,
          weekKey,
          createdAt: toDate(room.createdAt),
          latestActivityAt: reportDate,
          latestActivityLabel: formatDateTime(reportDate),
          targetItems,
          playerCount: players.length,
          completedPlayerCount: completedPlayers.length,
          incompletePlayerCount: incompletePlayers.length,
          scanCount: scans.length,
          completedScanCount: completedScans.length,
          avgScore,
          topFood: getTopFoodName(scans),
          completedTopFood: getTopFoodName(completedScans.length ? completedScans : scans),
          hasCompletedPlayers: completedPlayers.length > 0,
        });

        const addToSummaryMap = (summaryMap, key, labelDate) => {
          if (!summaryMap.has(key)) {
            summaryMap.set(key, {
              key,
              label: labelDate,
              roomCount: 0,
              playerCount: 0,
              completedPlayerCount: 0,
              incompletePlayerCount: 0,
              scanCount: 0,
              completedScanCount: 0,
              scores: [],
              scans: [],
              latestActivityAt: reportDate,
            });
          }

          const summary = summaryMap.get(key);
          summary.roomCount += 1;
          summary.playerCount += players.length;
          summary.completedPlayerCount += completedPlayers.length;
          summary.incompletePlayerCount += incompletePlayers.length;
          summary.scanCount += scans.length;
          summary.completedScanCount += completedScans.length;
          summary.scores.push(...completedAverageScores);
          summary.scans.push(...(completedScans.length ? completedScans : scans));
          summary.latestActivityAt = getLatestDate(summary.latestActivityAt, reportDate) || summary.latestActivityAt;
        };

        addToSummaryMap(dailyMap, dayKey, reportDate);
        addToSummaryMap(weeklyMap, weekKey, reportDate);
      }

      const buildSummaryRows = (summaryMap, labelFormatter) => Array.from(summaryMap.values())
        .map((row) => ({
          ...row,
          displayLabel: labelFormatter(row),
          avgScore: average(row.scores),
          topFood: getTopFoodName(row.scans),
        }))
        .sort((a, b) => (toDate(b.latestActivityAt)?.getTime() || 0) - (toDate(a.latestActivityAt)?.getTime() || 0));

      const dailyRows = buildSummaryRows(dailyMap, (row) => formatDayLabel(row.label));
      const weeklyRows = buildSummaryRows(weeklyMap, (row) => row.key);
      const sortedRoomRows = roomRows.sort(
        (a, b) => (toDate(b.latestActivityAt)?.getTime() || 0) - (toDate(a.latestActivityAt)?.getTime() || 0),
      );
      const allCompletedScores = sortedRoomRows.flatMap((room) => (room.hasCompletedPlayers ? [room.avgScore] : []));

      setReportData({
        dailyRows,
        weeklyRows,
        roomRows: sortedRoomRows,
        totalPlayers: sortedRoomRows.reduce((sum, room) => sum + room.playerCount, 0),
        totalCompletedPlayers: sortedRoomRows.reduce((sum, room) => sum + room.completedPlayerCount, 0),
        totalIncompletePlayers: sortedRoomRows.reduce((sum, room) => sum + room.incompletePlayerCount, 0),
        totalRooms: sortedRoomRows.length,
        overallCompletedAvgScore: average(allCompletedScores),
      });
    } catch (error) {
      setReportError(`โหลดรายงานไม่ได้: ${error.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#071524] text-white flex items-center justify-center">
        <div className="font-black text-cyan-300">กำลังโหลดระบบ Admin...</div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="min-h-screen bg-[#071524] text-white flex items-center justify-center p-5">
        <div className="w-full max-w-5xl grid lg:grid-cols-[0.9fr_1.1fr] gap-6 items-center">
          <div className="text-center lg:text-left">
            <img src={GAME_LOGO_URL} alt="SFS-GAME" className="w-56 mx-auto lg:mx-0 mb-5" />
            <h1 className="text-4xl font-black mb-4">ระบบ Admin SFS-GAME</h1>
            <p className="text-slate-300 font-semibold leading-relaxed">
              สมัครสมาชิกเพื่อสร้างฐานข้อมูลอาหาร เครื่องดื่ม ขนม และไอศกรีมของตนเอง
              จากนั้นสร้างห้องเกมให้นักเรียนสแกนจากฐานข้อมูลของ Admin คนนั้นโดยเฉพาะ
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="bg-white/[0.07] border border-cyan-300/20 rounded-3xl p-7">
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-3 rounded-2xl font-black ${mode === 'login' ? 'bg-cyan-400 text-slate-950' : 'bg-white/10'}`}
              >
                เข้าสู่ระบบ
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 py-3 rounded-2xl font-black ${mode === 'register' ? 'bg-cyan-400 text-slate-950' : 'bg-white/10'}`}
              >
                สมัคร Admin
              </button>
            </div>

            {mode === 'register' && (
              <>
                <input
                  tabIndex="-1"
                  autoComplete="off"
                  value={authForm.website}
                  onChange={(e) => setAuthForm({ ...authForm, website: e.target.value })}
                  className="hidden"
                  aria-hidden="true"
                />
                <input
                  value={authForm.displayName}
                  onChange={(e) => setAuthForm({ ...authForm, displayName: e.target.value })}
                  placeholder="ชื่อ Admin / ชื่อครู"
                  className="w-full mb-3 px-4 py-4 rounded-2xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300"
                />
                <input
                  required
                  value={authForm.schoolName}
                  onChange={(e) => setAuthForm({ ...authForm, schoolName: e.target.value })}
                  placeholder="ชื่อโรงเรียน / วิทยาลัย"
                  className="w-full mb-3 px-4 py-4 rounded-2xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300"
                />
                <div className="mb-3 rounded-2xl border border-lime-300/20 bg-lime-300/10 p-4">
                  <label className="mb-2 flex items-center gap-2 text-sm font-black text-lime-200">
                    <Bot size={18} /> ป้องกัน bot: {botQuestion.a} + {botQuestion.b} = ?
                  </label>
                  <input
                    required
                    type="number"
                    value={authForm.botCheck}
                    onChange={(e) => setAuthForm({ ...authForm, botCheck: e.target.value })}
                    placeholder="กรอกคำตอบ"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-white/10 outline-none focus:border-lime-300"
                  />
                </div>
              </>
            )}

            <input
              type="email"
              required
              value={authForm.email}
              onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
              placeholder="อีเมล"
              className="w-full mb-3 px-4 py-4 rounded-2xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300"
            />

            <input
              type="password"
              required
              minLength={6}
              value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              placeholder="รหัสผ่านอย่างน้อย 6 ตัว"
              className="w-full mb-4 px-4 py-4 rounded-2xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300"
            />

            {authError && <div className="mb-4 bg-rose-500/15 text-rose-200 border border-rose-400/30 rounded-2xl p-3 font-bold">{authError}</div>}
            {authMessage && <div className="mb-4 bg-lime-300/15 text-lime-100 border border-lime-300/30 rounded-2xl p-3 font-bold">{authMessage}</div>}

            <button className="w-full bg-gradient-to-r from-lime-300 to-cyan-300 text-slate-950 font-black py-4 rounded-2xl">
              {mode === 'register' ? 'สมัครสมาชิก Admin' : 'เข้าสู่ระบบ Admin'}
            </button>

            <Link to="/" className="block text-center mt-5 text-slate-400 font-bold hover:text-white">กลับหน้าแรก</Link>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071524] text-white">
      <header className="border-b border-cyan-300/15 bg-slate-950/30">
        <div className="max-w-7xl mx-auto px-5 py-5 flex flex-col md:flex-row justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={GAME_LOGO_URL} alt="SFS-GAME" className="w-16 h-16 object-contain" />
            <div>
              <h1 className="text-2xl font-black">Admin Food Database</h1>
              <p className="text-cyan-300 text-sm font-bold">{admin.displayName || admin.email}</p>
              {adminProfile?.schoolName && (
                <p className="text-lime-200 text-xs font-black mt-1">{adminProfile.schoolName}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/create-room" className="px-5 py-3 rounded-2xl bg-lime-300 text-slate-950 font-black">
              สร้างห้องเกม
            </Link>
            <button
              onClick={() => signOut(auth)}
              className="px-5 py-3 rounded-2xl bg-white/10 border border-white/10 font-black flex items-center gap-2"
            >
              <LogOut size={18} /> ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 pt-6">
        <div className="flex flex-wrap gap-2 rounded-3xl border border-white/10 bg-white/[0.05] p-2">
          {[
            { id: 'foods', label: 'ฐานอาหาร', icon: Utensils },
            { id: 'profile', label: 'ข้อมูล Admin', icon: Edit3 },
            { id: 'reports', label: 'รายงานสรุป', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-2xl px-5 py-3 font-black ${
                  activeTab === tab.id ? 'bg-cyan-300 text-slate-950' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <Icon size={18} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'foods' && (
      <main className="max-w-7xl mx-auto px-5 py-7 grid xl:grid-cols-[420px_1fr] gap-6">
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.07] border border-white/10 rounded-2xl p-4">
              <Database className="text-cyan-300 mb-2" />
              <div className="text-3xl font-black">{stats.total}</div>
              <div className="text-slate-400 font-bold text-sm">รายการอาหาร</div>
            </div>
            <div className="bg-white/[0.07] border border-white/10 rounded-2xl p-4">
              <ShieldCheck className="text-lime-300 mb-2" />
              <div className="text-3xl font-black">{Object.keys(stats.categoryCount).length}</div>
              <div className="text-slate-400 font-bold text-sm">หมวดหมู่</div>
            </div>
          </div>

          <form onSubmit={handleFoodSubmit} className="bg-white/[0.07] border border-cyan-300/15 rounded-3xl p-5">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2"><Plus className="text-cyan-300" /> เพิ่ม/แก้ไขข้อมูลอาหาร</h2>
            <div className="space-y-3">
              <input required value={foodForm.barcode} onChange={(e) => setFoodForm({ ...foodForm, barcode: e.target.value })} placeholder="บาร์โค้ด เช่น 885xxxx" className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300" />
              <input required value={foodForm.name} onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })} placeholder="ชื่ออาหาร/ขนม/เครื่องดื่ม" className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300" />
              <select value={foodForm.category} onChange={(e) => setFoodForm({ ...foodForm, category: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300">
                <option>ขนม</option>
                <option>เครื่องดื่ม</option>
                <option>ไอศกรีม</option>
                <option>อาหาร</option>
              </select>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" min="0" step="0.1" value={foodForm.sugar} onChange={(e) => setFoodForm({ ...foodForm, sugar: e.target.value })} placeholder="น้ำตาล g" className="px-3 py-3 rounded-xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300" />
                <input type="number" min="0" step="0.1" value={foodForm.fat} onChange={(e) => setFoodForm({ ...foodForm, fat: e.target.value })} placeholder="ไขมัน g" className="px-3 py-3 rounded-xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300" />
                <input type="number" min="0" step="1" value={foodForm.sodium} onChange={(e) => setFoodForm({ ...foodForm, sodium: e.target.value })} placeholder="โซเดียม mg" className="px-3 py-3 rounded-xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300" />
              </div>
              <input value={foodForm.videoUrl} onChange={(e) => setFoodForm({ ...foodForm, videoUrl: e.target.value })} placeholder="ลิงก์วิดีโอ YouTube / Google Drive / MP4" className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300" />
              <input value={foodForm.imageUrl} onChange={(e) => setFoodForm({ ...foodForm, imageUrl: e.target.value })} placeholder="ลิงก์รูปสินค้า (ถ้ามี)" className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300" />
              {normalizeBarcode(foodForm.barcode) && (
                <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/40 p-4 flex items-center gap-4">
                  <img
                    src={getQrCodeUrl(foodForm.barcode, 140)}
                    alt={`QR Code ${normalizeBarcode(foodForm.barcode)}`}
                    className="w-24 h-24 rounded-xl bg-white p-2"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-cyan-200 font-black">
                      <QrCode size={18} /> QR Code สำหรับสแกนในเกม
                    </div>
                    <p className="text-sm text-slate-300 mt-1">
                      QR นี้เก็บค่าเลขบาร์โค้ด: <span className="font-mono text-white">{normalizeBarcode(foodForm.barcode)}</span>
                    </p>
                    <a
                      href={getQrCodeUrl(foodForm.barcode, 500)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 mt-3 text-sm font-black text-lime-200 hover:text-lime-100"
                    >
                      <Download size={16} /> เปิด/ดาวน์โหลด QR
                    </a>
                  </div>
                </div>
              )}
              {foodError && (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/15 p-3 text-sm font-bold text-rose-100">
                  {foodError}
                </div>
              )}
              {foodMessage && (
                <div className="rounded-2xl border border-lime-300/30 bg-lime-300/15 p-3 text-sm font-bold text-lime-100">
                  {foodMessage}
                </div>
              )}
              <button disabled={saving} className="w-full py-4 rounded-2xl bg-cyan-400 text-slate-950 font-black flex items-center justify-center gap-2 disabled:opacity-60">
                <Save size={20} /> {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white/[0.07] border border-white/10 rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black flex items-center gap-2"><Utensils className="text-cyan-300" /> ฐานข้อมูลของ Admin คนนี้</h2>
            <div className="text-xs font-black text-cyan-300 bg-cyan-300/10 rounded-full px-3 py-1">
              admins/{admin.uid}/foods
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs uppercase tracking-widest text-cyan-300 bg-slate-950/40">
                <tr>
                  <th className="p-4">บาร์โค้ด</th>
                  <th className="p-4">QR</th>
                  <th className="p-4">รายการ</th>
                  <th className="p-4">หมวด</th>
                  <th className="p-4 text-right">น้ำตาล</th>
                  <th className="p-4 text-right">ไขมัน</th>
                  <th className="p-4 text-right">โซเดียม</th>
                  <th className="p-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {foods.map((food) => (
                  <tr key={food.id} className="border-t border-white/10">
                    <td className="p-4 font-mono text-cyan-100">{food.barcode || food.id}</td>
                    <td className="p-4">
                      <a
                        href={getQrCodeUrl(food.barcode || food.id, 500)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-white p-2 text-slate-950"
                        title="เปิด QR Code"
                      >
                        <img
                          src={getQrCodeUrl(food.barcode || food.id, 92)}
                          alt={`QR Code ${food.barcode || food.id}`}
                          className="h-12 w-12"
                        />
                      </a>
                    </td>
                    <td className="p-4 font-black">{food.name}</td>
                    <td className="p-4 text-slate-300">{food.category}</td>
                    <td className="p-4 text-right">{food.sugar || 0}g</td>
                    <td className="p-4 text-right">{food.fat || 0}g</td>
                    <td className="p-4 text-right">{food.sodium ?? food.salt ?? 0}mg</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEditFood(food)} className="px-3 py-2 rounded-xl bg-cyan-400/15 text-cyan-200 font-black">แก้ไข</button>
                        <button onClick={() => handleDeleteFood(food)} className="px-3 py-2 rounded-xl bg-rose-500/15 text-rose-200 font-black"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {foods.length === 0 && (
                  <tr>
                    <td colSpan="8" className="p-10 text-center text-slate-400 font-bold">
                      ยังไม่มีข้อมูลอาหารในฐานของ Admin คนนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      )}

      {activeTab === 'profile' && (
        <main className="max-w-4xl mx-auto w-full px-5 py-7">
          <form onSubmit={handleProfileSubmit} className="bg-white/[0.07] border border-cyan-300/15 rounded-3xl p-6">
            <h2 className="text-2xl font-black mb-5 flex items-center gap-2">
              <Edit3 className="text-cyan-300" /> แก้ไขข้อมูล Admin / ผู้สร้างห้อง
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block">
                <span className="block mb-2 text-sm font-black text-cyan-200">ชื่อ Admin / ชื่อครู</span>
                <input
                  value={profileForm.displayName}
                  onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                  className="w-full px-4 py-4 rounded-2xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300"
                />
              </label>
              <label className="block">
                <span className="block mb-2 text-sm font-black text-cyan-200">ชื่อโรงเรียน / วิทยาลัย</span>
                <input
                  required
                  value={profileForm.schoolName}
                  onChange={(e) => setProfileForm({ ...profileForm, schoolName: e.target.value })}
                  className="w-full px-4 py-4 rounded-2xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300"
                />
              </label>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-950/50 border border-white/10 p-4 text-sm font-bold text-slate-300">
              อีเมล: <span className="text-white">{admin.email}</span>
            </div>
            {profileError && <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/15 p-3 font-bold text-rose-100">{profileError}</div>}
            {profileMessage && <div className="mt-4 rounded-2xl border border-lime-300/30 bg-lime-300/15 p-3 font-bold text-lime-100">{profileMessage}</div>}
            <button className="mt-5 w-full md:w-auto px-8 py-4 rounded-2xl bg-cyan-300 text-slate-950 font-black inline-flex items-center justify-center gap-2">
              <Save size={20} /> บันทึกข้อมูล Admin
            </button>
          </form>
        </main>
      )}

      {activeTab === 'reports' && (
        <main className="max-w-7xl mx-auto w-full px-5 py-7 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black flex items-center gap-2"><BarChart3 className="text-cyan-300" /> รายงานสรุปการเล่นเกม</h2>
              <p className="text-slate-400 font-bold text-sm mt-1">
                เรียงจากวัน-เวลาล่าสุดที่มีการบันทึก และคำนวณค่าเฉลี่ยเฉพาะผู้เล่นที่สแกนครบตามโจทย์เท่านั้น
              </p>
            </div>
            <button
              type="button"
              onClick={loadReports}
              disabled={reportLoading}
              className="px-5 py-3 rounded-2xl bg-cyan-300 text-slate-950 font-black disabled:opacity-60"
            >
              {reportLoading ? 'กำลังโหลด...' : 'รีเฟรชรายงาน'}
            </button>
          </div>
          {reportError && <div className="rounded-2xl border border-rose-400/30 bg-rose-500/15 p-3 font-bold text-rose-100">{reportError}</div>}

          <div className="rounded-3xl border border-lime-300/20 bg-lime-300/10 p-5 text-sm font-bold text-lime-100">
            หลักการคำนวณรายงาน: คะแนนเฉลี่ยของห้อง/รายวัน/รายสัปดาห์ จะใช้เฉพาะผู้เล่นที่มีจำนวนสแกนสำเร็จครบตามเป้าหมายที่ครูกำหนดในห้องนั้น
            ผู้เล่นที่ยังสแกนไม่ครบจะถูกนับเป็นจำนวนผู้เล่น/ผู้เล่นยังไม่ครบ แต่จะไม่ถูกนำคะแนนมาคำนวณค่าเฉลี่ย
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-white/[0.07] border border-white/10 rounded-2xl p-5">
              <Trophy className="text-amber-300 mb-3" />
              <div className="text-3xl font-black">{reportData.overallCompletedAvgScore.toFixed(2)}</div>
              <div className="text-slate-400 font-bold text-sm">คะแนนเฉลี่ยรวมเฉพาะผู้เล่นสแกนครบ</div>
            </div>
            <div className="bg-white/[0.07] border border-white/10 rounded-2xl p-5">
              <Users className="text-lime-300 mb-3" />
              <div className="text-3xl font-black">{reportData.totalCompletedPlayers}</div>
              <div className="text-slate-400 font-bold text-sm">ผู้เล่นที่สแกนครบ</div>
            </div>
            <div className="bg-white/[0.07] border border-white/10 rounded-2xl p-5">
              <Users className="text-orange-300 mb-3" />
              <div className="text-3xl font-black">{reportData.totalIncompletePlayers}</div>
              <div className="text-slate-400 font-bold text-sm">ผู้เล่นที่ยังสแกนไม่ครบ</div>
            </div>
            <div className="bg-white/[0.07] border border-white/10 rounded-2xl p-5">
              <Database className="text-cyan-300 mb-3" />
              <div className="text-3xl font-black">{reportData.totalRooms}</div>
              <div className="text-slate-400 font-bold text-sm">จำนวนห้องเกม</div>
            </div>
          </div>

          <section className="bg-white/[0.07] border border-white/10 rounded-3xl overflow-hidden">
            <div className="p-5 border-b border-white/10">
              <div className="font-black text-xl">สรุปรายวัน</div>
              <div className="mt-1 text-xs font-bold text-slate-400">ค่าเฉลี่ยรายวันคิดจากผู้เล่นที่สแกนครบเท่านั้น และเรียงจากวันที่มีข้อมูลล่าสุด</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs uppercase tracking-widest text-cyan-300 bg-slate-950/40">
                  <tr>
                    <th className="p-4">วันที่</th>
                    <th className="p-4 text-right">คะแนนเฉลี่ย</th>
                    <th className="p-4 text-right">จำนวนห้อง</th>
                    <th className="p-4 text-right">ผู้เล่นทั้งหมด</th>
                    <th className="p-4 text-right">สแกนครบ</th>
                    <th className="p-4 text-right">ยังไม่ครบ</th>
                    <th className="p-4 text-right">สแกนทั้งหมด</th>
                    <th className="p-4">ขนม/อาหารที่เลือกบ่อย</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.dailyRows.map((row) => (
                    <tr key={row.key} className="border-t border-white/10">
                      <td className="p-4 font-black">{row.displayLabel}</td>
                      <td className="p-4 text-right font-black text-lime-200">{row.completedPlayerCount > 0 ? row.avgScore.toFixed(2) : '-'}</td>
                      <td className="p-4 text-right">{row.roomCount}</td>
                      <td className="p-4 text-right">{row.playerCount}</td>
                      <td className="p-4 text-right text-lime-200 font-black">{row.completedPlayerCount}</td>
                      <td className="p-4 text-right text-orange-200 font-black">{row.incompletePlayerCount}</td>
                      <td className="p-4 text-right">{row.scanCount}</td>
                      <td className="p-4">{row.topFood}</td>
                    </tr>
                  ))}
                  {reportData.dailyRows.length === 0 && (
                    <tr><td colSpan="8" className="p-8 text-center text-slate-400 font-bold">ยังไม่มีข้อมูลรายวัน</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white/[0.07] border border-white/10 rounded-3xl overflow-hidden">
            <div className="p-5 border-b border-white/10">
              <div className="font-black text-xl">สรุปรายสัปดาห์</div>
              <div className="mt-1 text-xs font-bold text-slate-400">ค่าเฉลี่ยรายสัปดาห์คิดจากผู้เล่นที่สแกนครบเท่านั้น</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs uppercase tracking-widest text-cyan-300 bg-slate-950/40">
                  <tr>
                    <th className="p-4">สัปดาห์</th>
                    <th className="p-4 text-right">คะแนนเฉลี่ย</th>
                    <th className="p-4 text-right">จำนวนห้อง</th>
                    <th className="p-4 text-right">ผู้เล่นทั้งหมด</th>
                    <th className="p-4 text-right">สแกนครบ</th>
                    <th className="p-4 text-right">ยังไม่ครบ</th>
                    <th className="p-4 text-right">สแกนทั้งหมด</th>
                    <th className="p-4">ขนม/อาหารที่เลือกบ่อย</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.weeklyRows.map((row) => (
                    <tr key={row.key} className="border-t border-white/10">
                      <td className="p-4 font-black">{row.displayLabel}</td>
                      <td className="p-4 text-right font-black text-lime-200">{row.completedPlayerCount > 0 ? row.avgScore.toFixed(2) : '-'}</td>
                      <td className="p-4 text-right">{row.roomCount}</td>
                      <td className="p-4 text-right">{row.playerCount}</td>
                      <td className="p-4 text-right text-lime-200 font-black">{row.completedPlayerCount}</td>
                      <td className="p-4 text-right text-orange-200 font-black">{row.incompletePlayerCount}</td>
                      <td className="p-4 text-right">{row.scanCount}</td>
                      <td className="p-4">{row.topFood}</td>
                    </tr>
                  ))}
                  {reportData.weeklyRows.length === 0 && (
                    <tr><td colSpan="8" className="p-8 text-center text-slate-400 font-bold">ยังไม่มีข้อมูลรายงาน</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white/[0.07] border border-white/10 rounded-3xl overflow-hidden">
            <div className="p-5 border-b border-white/10">
              <div className="font-black text-xl">สรุปผลแต่ละห้อง เรียงจากข้อมูลล่าสุด</div>
              <div className="mt-1 text-xs font-bold text-slate-400">คะแนนเฉลี่ยของห้องใช้เฉพาะผู้เล่นที่สแกนครบตามโจทย์</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs uppercase tracking-widest text-cyan-300 bg-slate-950/40">
                  <tr>
                    <th className="p-4">รหัสห้อง</th>
                    <th className="p-4">บันทึกล่าสุด</th>
                    <th className="p-4 text-right">เป้าหมาย</th>
                    <th className="p-4 text-right">คะแนนเฉลี่ย</th>
                    <th className="p-4 text-right">ผู้เล่นทั้งหมด</th>
                    <th className="p-4 text-right">สแกนครบ</th>
                    <th className="p-4 text-right">ยังไม่ครบ</th>
                    <th className="p-4 text-right">สแกน</th>
                    <th className="p-4">ขนมที่เลือกบ่อย</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.roomRows.map((row) => (
                    <tr key={row.roomCode} className="border-t border-white/10 align-top">
                      <td className="p-4 font-mono text-cyan-100">{row.roomCode}</td>
                      <td className="p-4">
                        <div className="font-bold text-white">{row.latestActivityLabel}</div>
                        <div className="mt-1 text-xs text-slate-400">{row.dayKey} / {row.weekKey}</div>
                      </td>
                      <td className="p-4 text-right">{row.targetItems} ชิ้น</td>
                      <td className="p-4 text-right font-black">
                        {row.hasCompletedPlayers ? (
                          <span className="text-lime-200">{row.avgScore.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-500">ไม่นำมาคำนวณ</span>
                        )}
                      </td>
                      <td className="p-4 text-right">{row.playerCount}</td>
                      <td className="p-4 text-right text-lime-200 font-black">{row.completedPlayerCount}</td>
                      <td className="p-4 text-right text-orange-200 font-black">{row.incompletePlayerCount}</td>
                      <td className="p-4 text-right">{row.scanCount}</td>
                      <td className="p-4">{row.topFood}</td>
                    </tr>
                  ))}
                  {reportData.roomRows.length === 0 && (
                    <tr><td colSpan="9" className="p-8 text-center text-slate-400 font-bold">ยังไม่มีข้อมูลห้องเกม</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
