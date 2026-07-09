// src/components/GameMain.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  Camera,
  Send,
  XCircle,
  AlertCircle,
  Trophy,
  Clock,
  PauseCircle,
  RefreshCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import {
  BarcodeFormat,
  BrowserMultiFormatReader,
  DecodeHintType,
  NotFoundException,
} from '@zxing/library';

const HERO_AVATARS = [
  { id: 'h1', icon: '🦸‍♂️', name: 'กัปตันสกาย' },
  { id: 'h2', icon: '🦸‍♀️', name: 'วอนเดอร์เกิร์ล' },
  { id: 'h3', icon: '🥷', name: 'นินจาชาโดว์' },
  { id: 'h4', icon: '🧙‍♂️', name: 'เมจิกมาสเตอร์' },
  { id: 'h5', icon: '🧙‍♀️', name: 'สการ์เล็ตวิทช์' },
  { id: 'h6', icon: '🧚', name: 'แฟรี่พิกซี่' },
  { id: 'h7', icon: '🧛‍♂️', name: 'แวมไพร์ลอร์ด' },
  { id: 'h8', icon: '🧛‍♀️', name: 'เลดี้แวมพ์' },
  { id: 'h9', icon: '🦹‍♂️', name: 'ดาร์กไนท์' },
  { id: 'h10', icon: '🦹‍♀️', name: 'ควีนพอยซัน' },
];

const SCAN_COOLDOWN_MS = 1400;

const FINAL_REPORT_REASONS = new Set([
  'summary',
  'time_expired',
  'room_finished',
  'teacher_finished',
  'teacher_all_completed',
  'all_players_completed',
]);

const isFinalReportReason = (reason) => FINAL_REPORT_REASONS.has(String(reason || ''));

const MIN_TARGET_ITEMS = 5;
const MAX_TARGET_ITEMS = 10;

const clampTargetItems = (value, fallback = MIN_TARGET_ITEMS) => {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) && numericValue > 0 ? numericValue : Number(fallback || MIN_TARGET_ITEMS);
  return Math.min(MAX_TARGET_ITEMS, Math.max(MIN_TARGET_ITEMS, Math.round(safeValue)));
};

const OVERALL_LEVELS = [
  {
    min: 4.5,
    max: 5,
    icon: '🟢',
    colorName: 'สีเขียว ปลอดภัยมาก',
    title: 'สุดยอดสายลับระดับตำนาน',
    titleEn: 'Legendary Agent',
    badgeClass: 'from-emerald-400 to-green-600',
    borderClass: 'border-emerald-400/70',
    textClass: 'text-emerald-300',
    note: 'เลือกได้ดีมาก รู้ทันหวาน มัน เค็ม และเหมาะเป็นต้นแบบให้เพื่อน ๆ',
  },
  {
    min: 3.5,
    max: 4.49,
    icon: '🟡',
    colorName: 'สีเหลือง ควรระวังบางชิ้น',
    title: 'สายลับมือโปร',
    titleEn: 'Professional Agent',
    badgeClass: 'from-yellow-300 to-amber-500',
    borderClass: 'border-yellow-400/70',
    textClass: 'text-yellow-300',
    note: 'เลือกได้ดี แต่ยังมีบางชิ้นที่ควรอ่านฉลากให้ละเอียดขึ้นอีกนิด',
  },
  {
    min: 2.5,
    max: 3.49,
    icon: '🟠',
    colorName: 'สีส้ม เสี่ยงสะสม',
    title: 'สายลับฝึกหัด',
    titleEn: 'Trainee Agent',
    badgeClass: 'from-orange-400 to-orange-600',
    borderClass: 'border-orange-400/70',
    textClass: 'text-orange-300',
    note: 'เริ่มจับสัญญาณได้แล้ว แต่ควรลดกลุ่มหวาน มัน เค็มลงอีก',
  },
  {
    min: 0,
    max: 2.49,
    icon: '🔴',
    colorName: 'สีแดง อันตรายขั้นวิกฤต',
    title: 'สายลับติดกับดัก',
    titleEn: 'Agent in Danger!',
    badgeClass: 'from-rose-500 to-red-700',
    borderClass: 'border-rose-400/70',
    textClass: 'text-rose-300',
    note: 'ต้องระวังมากเป็นพิเศษ ลองเลือกชิ้นที่น้ำตาล ไขมัน และโซเดียมน้อยลง',
  },
];

const SPEED_LEVELS = [
  {
    minAvgSeconds: 0,
    maxAvgSeconds: 30,
    rangeLabel: '≤ 30 วินาที/ชิ้น',
    bonus: 0.05,
    icon: '⚡',
    title: 'สายลับสายฟ้า',
    titleEn: 'Lightning Agent',
    note: 'เร็วมาก สแกนครบตามภารกิจและตัดสินใจได้อย่างมั่นใจ',
  },
  {
    minAvgSeconds: 31,
    maxAvgSeconds: 44,
    rangeLabel: '31-44 วินาที/ชิ้น',
    bonus: 0.03,
    icon: '🏃',
    title: 'สายลับว่องไว',
    titleEn: 'Agile Agent',
    note: 'ความเร็วดี อ่านข้อมูลและเลือกได้รวดเร็ว',
  },
  {
    minAvgSeconds: 45,
    maxAvgSeconds: 60,
    rangeLabel: '45-60 วินาที/ชิ้น',
    bonus: 0.01,
    icon: '🚶',
    title: 'สายลับรอบคอบ',
    titleEn: 'Balanced Agent',
    note: 'ความเร็วปานกลาง มีเวลาอ่านฉลากก่อนตัดสินใจ',
  },
  {
    minAvgSeconds: 61,
    maxAvgSeconds: Infinity,
    rangeLabel: '> 61 วินาที/ชิ้น',
    bonus: 0,
    icon: '🐢',
    title: 'สายลับใจเย็น',
    titleEn: 'Calm Agent',
    note: 'ค่อนข้างช้า ยังไม่มีโบนัสความเร็ว แต่ยังเน้นความถูกต้องได้',
  },
];

const getOverallLevel = (averageScore = 0) => {
  const scoreValue = Number(averageScore || 0);
  return OVERALL_LEVELS.find((level) => scoreValue >= level.min && scoreValue <= level.max) || OVERALL_LEVELS[OVERALL_LEVELS.length - 1];
};

const getSpeedLevel = (timeUsed = 0, itemsScanned = 0, missionCompleted = false) => {
  if (!missionCompleted || !itemsScanned) {
    return {
      icon: '⏳',
      title: 'ยังไม่ครบภารกิจ',
      titleEn: 'Mission Not Complete',
      rangeLabel: 'ยังไม่คำนวณ',
      bonus: 0,
      avgSeconds: itemsScanned ? Number(timeUsed || 0) / itemsScanned : 0,
      note: 'ต้องสแกนครบตามจำนวนที่ครูกำหนดก่อน จึงจะได้รับระดับความเร็ว',
    };
  }

  const avgSeconds = Number(timeUsed || 0) / itemsScanned;
  const matched = SPEED_LEVELS.find((level) => avgSeconds <= level.maxAvgSeconds) || SPEED_LEVELS[SPEED_LEVELS.length - 1];

  return {
    ...matched,
    avgSeconds,
  };
};

const buildPlayerScore = ({ scoreSum = 0, itemsScanned = 0, itemLimit = 5, timeUsed = 0 }) => {
  const targetItems = clampTargetItems(itemLimit);
  const scanCount = Math.max(0, Number(itemsScanned || 0));
  const totalScore = Number(scoreSum || 0);
  const averageScore = scanCount > 0 ? totalScore / scanCount : 0;
  const completionRate = Math.min(scanCount / targetItems, 1);
  const missionCompleted = scanCount >= targetItems;
  const speedLevel = getSpeedLevel(timeUsed, scanCount, missionCompleted);
  const speedBonus = missionCompleted ? Number(speedLevel.bonus || 0) : 0;

  // คะแนนจัดลำดับ: คนที่สแกนครบต้องอยู่เหนือคนที่ไม่ครบเสมอ
  // ผู้ที่ยังไม่ครบจะถูกถ่วงคะแนนด้วยอัตราความครบถ้วนและตัวคูณ 0.19 เพื่อไม่ให้ชนะผู้เล่นที่ทำภารกิจครบ
  const rankingScore = missionCompleted
    ? averageScore + speedBonus
    : averageScore * completionRate * 0.19;

  return {
    targetItems,
    scoreSum: totalScore,
    itemsScanned: scanCount,
    averageScore,
    completionRate,
    missionCompleted,
    speedLevel,
    speedBonus,
    rankingScore,
    overallLevel: getOverallLevel(averageScore),
  };
};

const getStars = (val, thresholds) => {
  if (val <= thresholds[0]) return 5;
  if (val <= thresholds[1]) return 4;
  if (val <= thresholds[2]) return 3;
  if (val <= thresholds[3]) return 2;
  return 1;
};

const calcItemDetails = (food) => {
  const sugarStars = getStars(Number(food.sugar || 0), [6, 12, 18, 24]);
  const saltStars = getStars(Number(food.salt || 0), [120, 240, 360, 480]);
  const fatStars = getStars(Number(food.fat || 0), [3, 6, 9, 12]);
  const avgStars = (sugarStars + fatStars + saltStars) / 3;

  let status = {};
  if (avgStars >= 4.5) {
    status = {
      icon: '🟢',
      label: 'ปลอดภัย',
      color: 'text-green-400',
      bg: 'bg-green-500/20 border-green-500',
      msg: 'ยอดเยี่ยม! ไอเทมนี้ปลอดภัยสำหรับร่างกาย',
    };
  } else if (avgStars >= 3.5) {
    status = {
      icon: '🟡',
      label: 'ควรระวัง',
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/20 border-yellow-400',
      msg: 'ทานได้พอประมาณ ควรระวังอย่าทานมากเกินไปนะ',
    };
  } else if (avgStars >= 2.5) {
    status = {
      icon: '🟠',
      label: 'เสี่ยง',
      color: 'text-orange-400',
      bg: 'bg-orange-500/20 border-orange-500',
      msg: 'มีความเสี่ยง! ควรทานแต่น้อยและออกกำลังกายควบคู่',
    };
  } else {
    status = {
      icon: '🔴',
      label: 'อันตราย',
      color: 'text-rose-500',
      bg: 'bg-rose-500/20 border-rose-500',
      msg: 'เกินเกณฑ์อย่างมาก รีบวางขนมเหล่านี้ลง แล้วไปตามหาขนมสีเขียวด่วนเพื่อช่วยชีวิตร่างกายของเธอ!',
    };
  }

  return { sugarStars, fatStars, saltStars, avgStars, status };
};

const normalizeBarcode = (code) => String(code || '').replace(/[^\dA-Za-z]/g, '').trim();

const extractBarcodeFromQrText = (text) => {
  const rawText = String(text || '').trim();
  if (!rawText) return '';

  try {
    const parsedUrl = new URL(rawText);
    const barcodeFromUrl =
      parsedUrl.searchParams.get('barcode') ||
      parsedUrl.searchParams.get('code') ||
      parsedUrl.searchParams.get('data');

    if (barcodeFromUrl) return normalizeBarcode(barcodeFromUrl);
  } catch {
    // QR ส่วนใหญ่จะเก็บเลขบาร์โค้ดตรง ๆ จึงไม่จำเป็นต้องเป็น URL
  }

  try {
    const parsedJson = JSON.parse(rawText);
    const barcodeFromJson = parsedJson.barcode || parsedJson.code || parsedJson.id;
    if (barcodeFromJson) return normalizeBarcode(barcodeFromJson);
  } catch {
    // ไม่ใช่ JSON ให้ใช้ข้อความดิบต่อ
  }

  return normalizeBarcode(rawText);
};

const safeDocId = (value) =>
  String(value || 'player')
    .trim()
    .replace(/[.#$/[\]]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || `player_${Date.now()}`;

const createPlayerSessionId = (name) =>
  `${safeDocId(name)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const putFoodInIndex = (targetMap, food, { scope = 'global', docId = '' } = {}) => {
  if (!food || !targetMap) return;

  const normalizedBarcode = normalizeBarcode(food.barcode);
  const normalizedDocId = normalizeBarcode(docId || food.id);

  if (normalizedBarcode) {
    targetMap.set(`${scope}:barcode:${normalizedBarcode}`, food);
    // key แบบสั้นสำหรับกรณีใช้ scope เดียวกันในห้อง
    targetMap.set(`barcode:${normalizedBarcode}`, food);
  }

  if (normalizedDocId) {
    targetMap.set(`${scope}:id:${normalizedDocId}`, food);
    targetMap.set(`id:${normalizedDocId}`, food);
  }
};

const normalizeFoodDoc = (rawFood, barcode) => {
  const sugar = Number(rawFood.sugar ?? rawFood.sugarGram ?? rawFood.sugar_g ?? 0);
  const fat = Number(rawFood.fat ?? rawFood.fatGram ?? rawFood.fat_g ?? 0);
  const salt = Number(rawFood.salt ?? rawFood.sodium ?? rawFood.sodiumMg ?? rawFood.sodium_mg ?? 0);

  return {
    id: rawFood.id || barcode,
    barcode: normalizeBarcode(rawFood.barcode || barcode),
    name: rawFood.name || rawFood.foodName || 'ไม่ระบุชื่ออาหาร',
    category: rawFood.category || 'อาหาร/ขนม',
    sugar,
    fat,
    salt,
    video:
      rawFood.video ||
      rawFood.videoUrl ||
      rawFood.videoURL ||
      rawFood.youtubeUrl ||
      rawFood.youtubeURL ||
      rawFood.youtube ||
      rawFood.youtubeLink ||
      rawFood.googleDriveUrl ||
      rawFood.driveUrl ||
      rawFood.mp4Url ||
      rawFood.vdoUrl ||
      '',
    imageUrl: rawFood.imageUrl || rawFood.image || '',
  };
};

const getYouTubeVideoId = (url) => {
  const urlText = String(url || '').trim();
  if (!urlText) return '';

  try {
    const parsedUrl = new URL(urlText);
    const hostname = parsedUrl.hostname.replace(/^www\./, '').replace(/^m\./, '');

    if (hostname === 'youtu.be') {
      return parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
    }

    if (hostname.endsWith('youtube.com') || hostname.endsWith('youtube-nocookie.com')) {
      if (parsedUrl.pathname === '/watch') {
        return parsedUrl.searchParams.get('v') || '';
      }

      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(pathParts[0])) {
        return pathParts[1] || '';
      }
    }
  } catch {
    // fallback สำหรับกรณีกรอกลิงก์ไม่สมบูรณ์
  }

  const fallbackMatch = urlText.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,})/,
  );

  return fallbackMatch?.[1] || '';
};

const getYouTubeEmbedUrl = (url) => {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return '';

  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
};

const getGoogleDriveFileId = (url) => {
  const urlText = String(url || '').trim();
  if (!urlText || !urlText.includes('drive.google.com')) return '';

  try {
    const parsedUrl = new URL(urlText);
    const pathMatch = parsedUrl.pathname.match(/\/file\/d\/([^/]+)/);
    const idFromPath = pathMatch?.[1];
    const idFromQuery = parsedUrl.searchParams.get('id');

    return idFromPath || idFromQuery || '';
  } catch {
    const fallbackMatch =
      urlText.match(/\/file\/d\/([^/]+)/) ||
      urlText.match(/[?&]id=([^&]+)/);

    return fallbackMatch?.[1] || '';
  }
};

const getGoogleDrivePreviewUrl = (url) => {
  const fileId = getGoogleDriveFileId(url);
  if (!fileId) return '';

  return `https://drive.google.com/file/d/${fileId}/preview`;
};

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

const getRoomStartMs = (room) =>
  toMillis(room?.startedAt || room?.startTime || room?.gameStartedAt || room?.playingAt);

const getRoomTimeLimitSeconds = (room) => {
  const seconds = Number(room?.timeLimitSeconds || room?.durationSeconds);
  if (seconds > 0) return seconds;

  const minutes = Number(room?.timeLimit || room?.durationMinutes || 0);
  return minutes > 0 ? minutes * 60 : 0;
};

const getRoomElapsedSeconds = (room, nowMs = Date.now()) => {
  const pausedElapsedSeconds = Number(room?.pausedElapsedSeconds);
  if (room?.status === 'paused' && pausedElapsedSeconds >= 0) {
    return Math.floor(pausedElapsedSeconds);
  }

  const startMs = getRoomStartMs(room);
  const elapsedOffsetSeconds = Number(room?.elapsedOffsetSeconds || 0);
  if (!startMs) return Math.max(0, Math.floor(elapsedOffsetSeconds));

  const elapsedMs = Math.max(0, nowMs - startMs);

  return Math.max(0, Math.floor(elapsedOffsetSeconds + elapsedMs / 1000));
};

const isRoomTimeExpired = (room) => {
  const limitSeconds = getRoomTimeLimitSeconds(room);
  return limitSeconds > 0 && getRoomElapsedSeconds(room) >= limitSeconds;
};

const getRoomSchoolName = (room) =>
  String(room?.schoolName || room?.adminSchoolName || room?.school || '').trim();

function FoodVideoPlayer({ videoUrl }) {
  const cleanVideoUrl = String(videoUrl || '').trim();
  const youtubeEmbedUrl = getYouTubeEmbedUrl(cleanVideoUrl);
  const googleDrivePreviewUrl = getGoogleDrivePreviewUrl(cleanVideoUrl);

  if (!cleanVideoUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
        รายการนี้ยังไม่ได้แนบวิดีโอ
      </div>
    );
  }

  if (youtubeEmbedUrl || googleDrivePreviewUrl) {
    return (
      <iframe
        src={youtubeEmbedUrl || googleDrivePreviewUrl}
        title="วิดีโอแนะนำอาหาร"
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      ></iframe>
    );
  }

  return (
    <video
      src={cleanVideoUrl}
      controls
      autoPlay
      playsInline
      className="w-full h-full object-contain"
    ></video>
  );
}


export default function GameMain() {
  const [step, setStep] = useState('enter_room');
  const [roomCode, setRoomCode] = useState('');
  const [playerInfo, setPlayerInfo] = useState({ name: '', avatar: null });
  const [playerId, setPlayerId] = useState('');
  const [roomData, setRoomData] = useState(null);

  const [isPaused, setIsPaused] = useState(false);
  const [timeUsed, setTimeUsed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const [scoreSum, setScoreSum] = useState(0);
  const [score, setScore] = useState(0);
  const [speedBonus, setSpeedBonus] = useState(0);
  const [scannedItems, setScannedItems] = useState(0);
  const [scannedBarcodes, setScannedBarcodes] = useState([]);

  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanStatus, setScanStatus] = useState({ type: '', msg: '' });
  const [showVideoModal, setShowVideoModal] = useState(null);
  const [scanHint, setScanHint] = useState('จัด QR Code ให้อยู่กลางกรอบ...');

  const championMusic = useRef(
    new Audio('https://cdn.pixabay.com/download/audio/2021/08/09/audio_c8c8a73467.mp3?filename=success-fanfare-trumpets-6185.mp3'),
  );
  const actionMusic = useRef(
    new Audio('https://cdn.pixabay.com/download/audio/2022/10/18/audio_31c2730e64.mp3?filename=action-dramatic-sport-rock-trailer-122763.mp3'),
  );

  const videoRef = useRef(null);
  const codeReader = useRef(null);
  const streamRef = useRef(null);
  const scannerActiveRef = useRef(false);
  const audioContextRef = useRef(null);
  const waitingVoiceTimerRef = useRef(null);

  const isProcessingScan = useRef(false);
  const finishRequestedRef = useRef(false);
  const finalSummarySavedRef = useRef(false);
  const lastScanRef = useRef({ code: '', time: 0 });
  const foodCacheRef = useRef(new Map());
  const foodIndexRef = useRef(new Map());
  const foodPreloadKeyRef = useRef('');
  const foodPreloadPromiseRef = useRef(null);
  const scannedBarcodeSetRef = useRef(new Set());

  const [foodIndexStatus, setFoodIndexStatus] = useState({
    state: 'idle',
    count: 0,
    msg: '',
  });
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('environment');

  const currentTargetItems = clampTargetItems(roomData?.itemLimit || roomData?.foodLimit);
  const missionCompletedOnClient = step === 'playing' && scannedItems >= currentTargetItems;

  const latestState = useRef({
    scoreSum,
    scannedItems,
    timeUsed,
    roomData,
    roomCode,
    playerName: playerInfo.name,
    playerId,
    scannedBarcodes,
  });

  useEffect(() => {
    scannedBarcodeSetRef.current = new Set(scannedBarcodes.map(normalizeBarcode));
    latestState.current = {
      scoreSum,
      scannedItems,
      timeUsed,
      roomData,
      roomCode,
      playerName: playerInfo.name,
      playerId,
      scannedBarcodes,
    };
  }, [scoreSum, scannedItems, timeUsed, roomData, roomCode, playerInfo.name, playerId, scannedBarcodes]);

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    codeReader.current = new BrowserMultiFormatReader(hints, 80);

    return () => {
      stopCamera();
      codeReader.current?.reset();
    };
  }, []);

  useEffect(() => {
    if (!roomCode || step === 'enter_room' || step === 'select_avatar') return;

    const unsubscribe = onSnapshot(doc(db, 'rooms', roomCode), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoomData(data);
        preloadFoodsForRoom(data);

        if (data.status === 'playing') {
          if (step === 'waiting') setStep('playing');
          finishRequestedRef.current = false;
          setIsPaused(false);
        } else if (data.status === 'paused') {
          setIsPaused(true);
        } else if (data.status === 'finished') {
          finishRequestedRef.current = true;
          setShowVideoModal(null);
          setIsPaused(false);
          if (!finalSummarySavedRef.current && playerId) {
            finalSummarySavedRef.current = true;
            savePlayerProgressSnapshot(data.finishedReason || 'room_finished', {
              roomCode,
              playerId,
              playerName: playerInfo.name.trim(),
              roomData: data,
              scoreSum: latestState.current.scoreSum,
              itemsScanned: latestState.current.scannedItems,
              itemLimit: clampTargetItems(data?.itemLimit || data?.foodLimit),
              timeUsed: latestState.current.timeUsed,
              scannedBarcodes: latestState.current.scannedBarcodes,
              finalizeForReport: true,
            }).catch((err) => {
              console.warn('Unable to finalize player report after room finished:', err);
              finalSummarySavedRef.current = false;
            });
          }
          setStep('summary');
        }
      } else {
        alert('ห้องเกมนี้ถูกปิดไปแล้ว');
        window.location.reload();
      }
    });

    return () => unsubscribe();
  }, [roomCode, step]);

  useEffect(() => {
    let timer;

    const syncTimeFromRoom = () => {
      const limitSeconds = getRoomTimeLimitSeconds(roomData);
      const elapsedSeconds = getRoomElapsedSeconds(roomData);
      const cappedElapsed = limitSeconds
        ? Math.min(elapsedSeconds, limitSeconds)
        : elapsedSeconds;

      setTimeUsed(cappedElapsed);
      setTimeRemaining(limitSeconds ? Math.max(0, limitSeconds - cappedElapsed) : 0);

      if (step === 'playing' && limitSeconds > 0 && elapsedSeconds >= limitSeconds) {
        finishGameForPlayer('time_expired');
      }
    };

    if ((step === 'playing' || isPaused) && roomData) {
      syncTimeFromRoom();
      timer = setInterval(syncTimeFromRoom, 1000);
    }

    return () => clearInterval(timer);
  }, [step, isPaused, roomData]);

  useEffect(() => {
    if (step !== 'waiting') {
      window.clearInterval(waitingVoiceTimerRef.current);
      window.speechSynthesis?.cancel();
      return;
    }

    const speakWaitingMessage = () => {
      if (!('speechSynthesis' in window)) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        'เตรียมตัวให้พร้อม รอครูกดเริ่มเกม',
      );
      utterance.lang = 'th-TH';
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    };

    speakWaitingMessage();
    waitingVoiceTimerRef.current = window.setInterval(speakWaitingMessage, 12000);

    return () => {
      window.clearInterval(waitingVoiceTimerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, [step]);

  useEffect(() => {
    let hintTimer;
    if (step === 'playing' && !isPaused && !showVideoModal && !cameraError && !missionCompletedOnClient) {
      const hints = [
        'เล็ง QR Code ให้อยู่กลางกรอบ',
        'ขยับมือถือเข้าใกล้ QR Code อีกเล็กน้อยถ้าอ่านไม่ติด',
        'ระวังแสงสะท้อนบนกระดาษหรือหน้าจอ',
        'ถือกล้องให้นิ่งประมาณ 1 วินาที',
        'QR Code เอียงเล็กน้อยอ่านได้ แต่ไม่ควรเบลอ',
      ];

      let hintIndex = 0;
      hintTimer = setInterval(() => {
        hintIndex = (hintIndex + 1) % hints.length;
        setScanHint(hints[hintIndex]);
      }, 2500);
    }

    return () => clearInterval(hintTimer);
  }, [step, isPaused, showVideoModal, cameraError, missionCompletedOnClient]);

  useEffect(() => {
    actionMusic.current.loop = true;
    actionMusic.current.volume = 0.35;

    if (step === 'playing' && !isPaused && !showVideoModal && !missionCompletedOnClient) {
      actionMusic.current.play().catch(() => {});
    } else {
      actionMusic.current.pause();
    }

    return () => {
      actionMusic.current.pause();
    };
  }, [step, isPaused, showVideoModal, missionCompletedOnClient]);

  useEffect(() => {
    if (step === 'summary') {
      championMusic.current.loop = true;
      championMusic.current.play().catch(() => {});
    } else {
      championMusic.current.pause();
      championMusic.current.currentTime = 0;
    }

    return () => {
      championMusic.current.pause();
    };
  }, [step]);

  useEffect(() => {
    if (
      step === 'playing' &&
      !isPaused &&
      !showVideoModal &&
      !missionCompletedOnClient &&
      codeReader.current
    ) {
      startScanner();
    } else {
      codeReader.current?.reset();
      stopCamera();
    }

    return () => {
      codeReader.current?.reset();
      stopCamera();
    };
  }, [step, isPaused, showVideoModal, facingMode, missionCompletedOnClient]);

  useEffect(() => {
    if (missionCompletedOnClient) {
      codeReader.current?.reset();
      stopCamera();
      setCameraError('');
    }
  }, [missionCompletedOnClient]);

  function stopCamera() {
    scannerActiveRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    streamRef.current = null;
  }

  async function startScanner() {
    if (scannerActiveRef.current) return;

    setCameraError('');
    scannerActiveRef.current = true;

    try {
      stopCamera();
      scannerActiveRef.current = true;
      codeReader.current?.reset();

      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      };

      await codeReader.current.decodeFromConstraints(constraints, videoRef.current, (result, err) => {
        if (result) {
          const rawText = result.getText();
          processBarcode(rawText);
          return;
        }

        if (err && !(err instanceof NotFoundException)) {
          console.warn('Barcode scanner warning:', err);
        }
      });

      window.setTimeout(rememberCameraStream, 250);
    } catch (err) {
      console.error('Camera access error:', err);
      scannerActiveRef.current = false;
      setCameraError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์กล้อง หรือเปิดผ่าน HTTPS/localhost');
    }
  }

  function rememberCameraStream() {
    const stream = videoRef.current?.srcObject;
    if (!stream) return;

    streamRef.current = stream;
  }

  function toggleCamera() {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    setCameraError('');
    setBarcodeInput('');
  }

  function playBeep() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 980;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.1);

      if (navigator.vibrate) navigator.vibrate(70);
    } catch {
      // Browser may block audio. The game can continue without sound.
    }
  }

  const getFoodFromIndex = (code, adminId = '') => {
    const cleanCode = normalizeBarcode(code);
    if (!cleanCode) return null;

    const scope = adminId || 'global';
    return (
      foodIndexRef.current.get(`${scope}:barcode:${cleanCode}`) ||
      foodIndexRef.current.get(`${scope}:id:${cleanCode}`) ||
      foodIndexRef.current.get(`barcode:${cleanCode}`) ||
      foodIndexRef.current.get(`id:${cleanCode}`) ||
      null
    );
  };

  async function preloadFoodsForRoom(room = latestState.current.roomData || {}) {
    const adminId = room?.adminId || '';
    const preloadKey = adminId ? `admin:${adminId}` : 'global';

    if (foodPreloadKeyRef.current === preloadKey && foodIndexStatus.state === 'ready') {
      return foodIndexStatus.count;
    }

    if (
      foodPreloadPromiseRef.current?.key === preloadKey &&
      foodPreloadPromiseRef.current?.promise
    ) {
      return foodPreloadPromiseRef.current.promise;
    }

    foodPreloadKeyRef.current = preloadKey;
    setFoodIndexStatus({ state: 'loading', count: 0, msg: 'กำลังเตรียมฐานอาหารสำหรับสแกนเร็ว...' });

    const preloadPromise = (async () => {
      const nextIndex = new Map();
      let loadedCount = 0;

      try {
        if (adminId) {
          const adminFoodsSnap = await getDocs(collection(db, 'admins', adminId, 'foods'));
          adminFoodsSnap.forEach((foodDoc) => {
            const food = normalizeFoodDoc(
              { id: foodDoc.id, ...foodDoc.data() },
              foodDoc.data()?.barcode || foodDoc.id,
            );
            food.ownerAdminId = adminId;
            putFoodInIndex(nextIndex, food, { scope: adminId, docId: foodDoc.id });
            loadedCount += 1;
          });
        }

        // fallback สำหรับห้องเก่าที่ยังไม่มี adminId หรือกรณี admin ยังไม่มีรายการอาหาร
        if (!adminId || loadedCount === 0) {
          const globalFoodsSnap = await getDocs(collection(db, 'foods'));
          globalFoodsSnap.forEach((foodDoc) => {
            const food = normalizeFoodDoc(
              { id: foodDoc.id, ...foodDoc.data() },
              foodDoc.data()?.barcode || foodDoc.id,
            );
            putFoodInIndex(nextIndex, food, { scope: 'global', docId: foodDoc.id });
            loadedCount += 1;
          });
        }

        foodIndexRef.current = nextIndex;
        setFoodIndexStatus({
          state: 'ready',
          count: loadedCount,
          msg: loadedCount > 0 ? `ฐานอาหารพร้อม ${loadedCount} รายการ` : 'ยังไม่พบฐานอาหารของห้องนี้',
        });

        return loadedCount;
      } catch (err) {
        console.warn('Unable to preload foods for fast scan:', err);
        setFoodIndexStatus({
          state: 'error',
          count: 0,
          msg: 'โหลดฐานอาหารล่วงหน้าไม่สำเร็จ ระบบจะค้นหาแบบสำรอง',
        });
        return 0;
      }
    })();

    foodPreloadPromiseRef.current = { key: preloadKey, promise: preloadPromise };
    return preloadPromise;
  }

  async function findFoodByBarcode(code) {
    const cleanCode = normalizeBarcode(code);
    if (!cleanCode) return null;

    const currentRoomData = latestState.current.roomData || {};
    const adminId = currentRoomData.adminId || '';
    const scope = adminId || 'global';
    const cacheKey = `${scope}:${cleanCode}`;

    const indexedFood = getFoodFromIndex(cleanCode, adminId);
    if (indexedFood) return indexedFood;

    if (foodCacheRef.current.has(cacheKey)) {
      return foodCacheRef.current.get(cacheKey);
    }

    // ถ้ายังไม่ได้ preload ให้โหลดฐานอาหารทั้งชุดก่อน 1 ครั้ง แล้วค้นจาก memory อีกครั้ง
    if (foodIndexStatus.state !== 'ready') {
      await preloadFoodsForRoom(currentRoomData);
      const indexedFoodAfterPreload = getFoodFromIndex(cleanCode, adminId);
      if (indexedFoodAfterPreload) return indexedFoodAfterPreload;
    }

    // fallback แบบเร็ว: ยิง Firebase เฉพาะเอกสารตรง barcode ก่อน
    if (adminId) {
      const adminFoodDirectRef = doc(db, 'admins', adminId, 'foods', cleanCode);
      const adminFoodDirectSnap = await getDoc(adminFoodDirectRef);

      if (adminFoodDirectSnap.exists()) {
        const food = normalizeFoodDoc(
          { id: adminFoodDirectSnap.id, ...adminFoodDirectSnap.data() },
          cleanCode,
        );
        food.ownerAdminId = adminId;
        foodCacheRef.current.set(cacheKey, food);
        putFoodInIndex(foodIndexRef.current, food, { scope: adminId, docId: adminFoodDirectSnap.id });
        return food;
      }
    }

    // fallback สำหรับห้องเก่าที่ยังไม่มี adminId
    const directRef = doc(db, 'foods', cleanCode);
    const directSnap = await getDoc(directRef);

    if (directSnap.exists()) {
      const food = normalizeFoodDoc({ id: directSnap.id, ...directSnap.data() }, cleanCode);
      foodCacheRef.current.set(cacheKey, food);
      putFoodInIndex(foodIndexRef.current, food, { scope: 'global', docId: directSnap.id });
      return food;
    }

    // fallback ชุดสุดท้าย: กรณี doc id ไม่ตรงกับ barcode แต่ field barcode ตรง
    if (adminId) {
      const adminFoodQuery = query(
        collection(db, 'admins', adminId, 'foods'),
        where('barcode', '==', cleanCode),
        limit(1),
      );
      const adminFoodQuerySnap = await getDocs(adminFoodQuery);

      if (!adminFoodQuerySnap.empty) {
        const foodDoc = adminFoodQuerySnap.docs[0];
        const food = normalizeFoodDoc({ id: foodDoc.id, ...foodDoc.data() }, cleanCode);
        food.ownerAdminId = adminId;
        foodCacheRef.current.set(cacheKey, food);
        putFoodInIndex(foodIndexRef.current, food, { scope: adminId, docId: foodDoc.id });
        return food;
      }
    }

    const foodQuery = query(
      collection(db, 'foods'),
      where('barcode', '==', cleanCode),
      limit(1),
    );
    const querySnap = await getDocs(foodQuery);

    if (!querySnap.empty) {
      const foodDoc = querySnap.docs[0];
      const food = normalizeFoodDoc({ id: foodDoc.id, ...foodDoc.data() }, cleanCode);
      foodCacheRef.current.set(cacheKey, food);
      putFoodInIndex(foodIndexRef.current, food, { scope: 'global', docId: foodDoc.id });
      return food;
    }

    foodCacheRef.current.set(cacheKey, null);
    return null;
  }


  async function savePlayerProgressSnapshot(reason = 'progress', overrides = {}) {
    const current = latestState.current || {};
    const currentRoomCode = overrides.roomCode || current.roomCode || roomCode;
    const currentPlayerId = overrides.playerId || current.playerId || playerId;
    const currentRoomData = overrides.roomData || current.roomData || roomData || {};
    const currentPlayerName = String(overrides.playerName || current.playerName || playerInfo.name || '').trim();

    if (!currentRoomCode || !currentPlayerId || !currentPlayerName) {
      console.warn('Skip saving player progress: missing room/player data', {
        currentRoomCode,
        currentPlayerId,
        currentPlayerName,
      });
      return false;
    }

    const targetItems = clampTargetItems(overrides.itemLimit || currentRoomData?.itemLimit || currentRoomData?.foodLimit);
    const nextScoreSum = Number(overrides.scoreSum ?? current.scoreSum ?? scoreSum ?? 0);
    const nextItemsScanned = Number(overrides.itemsScanned ?? current.scannedItems ?? scannedItems ?? 0);
    const nextTimeUsed = Number(overrides.timeUsed ?? current.timeUsed ?? timeUsed ?? 0);
    const scorePackage = buildPlayerScore({
      scoreSum: nextScoreSum,
      itemsScanned: nextItemsScanned,
      itemLimit: targetItems,
      timeUsed: nextTimeUsed,
    });
    const shouldFinalizeForReport = overrides.finalizeForReport === true || isFinalReportReason(reason);

    const payload = {
      name: currentPlayerName,
      playerKey: safeDocId(currentPlayerName),
      sessionId: currentPlayerId,
      roomCode: currentRoomCode,
      schoolName: getRoomSchoolName(currentRoomData),
      adminId: currentRoomData?.adminId || '',
      avatar: playerInfo.avatar?.icon || overrides.avatar || '',
      score: Number(scorePackage.rankingScore.toFixed(3)),
      rankingScore: Number(scorePackage.rankingScore.toFixed(3)),
      scoreSum: Number(scorePackage.scoreSum.toFixed(3)),
      averageScore: Number(scorePackage.averageScore.toFixed(3)),
      speedBonus: Number(scorePackage.speedBonus.toFixed(3)),
      targetItems: scorePackage.targetItems,
      completionRate: Number(scorePackage.completionRate.toFixed(3)),
      completionPercent: Math.round(scorePackage.completionRate * 100),
      missionCompleted: scorePackage.missionCompleted,
      itemsScanned: scorePackage.itemsScanned,
      scannedBarcodes: overrides.scannedBarcodes || current.scannedBarcodes || scannedBarcodes || [],
      overallLevelTitle: scorePackage.overallLevel.title,
      overallLevelTitleEn: scorePackage.overallLevel.titleEn,
      overallLevelColor: scorePackage.overallLevel.colorName,
      speedLevelTitle: scorePackage.speedLevel.title,
      speedLevelTitleEn: scorePackage.speedLevel.titleEn,
      speedAvgSeconds: Number((scorePackage.speedLevel.avgSeconds || 0).toFixed(2)),
      lastSaveReason: reason,
      lifecycleStatus: shouldFinalizeForReport
        ? 'finished_summary_saved'
        : (scorePackage.missionCompleted ? 'completed_waiting_summary' : reason),
      includeInReport: shouldFinalizeForReport,
      isFinal: shouldFinalizeForReport,
      reportReady: shouldFinalizeForReport,
      updatedAt: serverTimestamp(),
    };

    if (reason === 'joined') {
      payload.joinedAt = serverTimestamp();
      payload.lifecycleStatus = 'joined_waiting_start';
    }

    if (scorePackage.missionCompleted) {
      payload.completedAt = serverTimestamp();
    }

    if (shouldFinalizeForReport) {
      payload.finishedAt = serverTimestamp();
      payload.finalizedAt = serverTimestamp();
      payload.lifecycleStatus = 'finished_summary_saved';
    }

    await setDoc(doc(db, 'rooms', currentRoomCode, 'players', currentPlayerId), payload, { merge: true });
    return true;
  }

  async function saveScanToFirebase({
    roomCode: currentRoomCode,
    playerDocId,
    playerName,
    food,
    details,
    newTotalScore,
    newItemsCount,
    finalScoreToSave,
    earnedBonus,
    itemLimit,
    timeUsed,
  }) {
    const playerRef = doc(db, 'rooms', currentRoomCode, 'players', playerDocId);
    const savedScorePackage = buildPlayerScore({
      scoreSum: newTotalScore,
      itemsScanned: newItemsCount,
      itemLimit,
      timeUsed,
    });
    const scanRef = doc(db, 'rooms', currentRoomCode, 'scans', `${playerDocId}_${food.barcode}`);

    await runTransaction(db, async (transaction) => {
      const scanSnap = await transaction.get(scanRef);
      const playerSnap = await transaction.get(playerRef);
      const savedBarcodes = playerSnap.exists()
        ? playerSnap.data().scannedBarcodes || []
        : [];
      const normalizedSavedBarcodes = savedBarcodes.map(normalizeBarcode);

      if (scanSnap.exists() || normalizedSavedBarcodes.includes(food.barcode)) {
        throw new Error('DUPLICATE_BARCODE');
      }

      transaction.set(
        playerRef,
        {
          name: playerName,
          avatar: playerInfo.avatar?.icon || '',
          score: Number(savedScorePackage.rankingScore.toFixed(3)),
          rankingScore: Number(savedScorePackage.rankingScore.toFixed(3)),
          scoreSum: Number(newTotalScore.toFixed(3)),
          averageScore: Number(savedScorePackage.averageScore.toFixed(3)),
          speedBonus: Number(savedScorePackage.speedBonus.toFixed(3)),
          targetItems: savedScorePackage.targetItems,
          completionRate: Number(savedScorePackage.completionRate.toFixed(3)),
          missionCompleted: savedScorePackage.missionCompleted,
          overallLevelTitle: savedScorePackage.overallLevel.title,
          speedLevelTitle: savedScorePackage.speedLevel.title,
          itemsScanned: newItemsCount,
          scannedBarcodes: arrayUnion(food.barcode),
          lastBarcode: food.barcode,
          lastFoodName: food.name,
          lifecycleStatus: savedScorePackage.missionCompleted ? 'completed_waiting_summary' : 'playing_scanning',
          includeInReport: false,
          isFinal: false,
          reportReady: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      transaction.set(scanRef, {
        playerId: playerDocId,
        playerName,
        barcode: food.barcode,
        uniqueScanKey: `${playerDocId}_${food.barcode}`,
        foodId: food.id,
        foodName: food.name,
        category: food.category,
        ownerAdminId: food.ownerAdminId || '',
        sugar: food.sugar,
        fat: food.fat,
        salt: food.salt,
        sugarStars: details.sugarStars,
        fatStars: details.fatStars,
        saltStars: details.saltStars,
        avgStars: Number(details.avgStars.toFixed(3)),
        statusLabel: details.status.label,
        scanOrder: newItemsCount,
        scoreAfterScan: Number(savedScorePackage.rankingScore.toFixed(3)),
        averageScoreAfterScan: Number(savedScorePackage.averageScore.toFixed(3)),
        includeInReport: false,
        reportReady: false,
        createdAt: serverTimestamp(),
      });
    });
  }

  async function finishGameForPlayer(reason = 'time_expired') {
    if (finishRequestedRef.current) return;

    finishRequestedRef.current = true;
    setShowVideoModal(null);
    setIsPaused(false);
    setScanStatus({ type: 'success', msg: 'หมดเวลาแล้ว ระบบกำลังสรุปผลภารกิจ' });
    codeReader.current?.reset();
    stopCamera();
    setStep('summary');

    const currentRoomCode = latestState.current.roomCode;
    const currentRoomData = latestState.current.roomData;

    try {
      await savePlayerProgressSnapshot(reason, {
        roomCode: currentRoomCode,
        playerId: latestState.current.playerId,
        playerName: latestState.current.playerName,
        roomData: currentRoomData,
        scoreSum: latestState.current.scoreSum,
        itemsScanned: latestState.current.scannedItems,
        itemLimit: clampTargetItems(currentRoomData?.itemLimit || currentRoomData?.foodLimit),
        timeUsed: latestState.current.timeUsed,
        scannedBarcodes: latestState.current.scannedBarcodes,
      });
    } catch (err) {
      console.warn('Unable to save player progress before finishing:', err);
    }

    if (!currentRoomCode || currentRoomData?.status === 'finished') return;

    try {
      await updateDoc(doc(db, 'rooms', currentRoomCode), {
        status: 'finished',
        finishedAt: serverTimestamp(),
        finishedReason: reason,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Unable to mark room as finished from player screen:', err);
    }
  }

  async function processBarcode(rawCode) {
    const cleanCode = extractBarcodeFromQrText(rawCode);
    if (!cleanCode || isProcessingScan.current) return;

    const now = Date.now();
    if (
      lastScanRef.current.code === cleanCode &&
      now - lastScanRef.current.time < SCAN_COOLDOWN_MS
    ) {
      return;
    }

    lastScanRef.current = { code: cleanCode, time: now };
    isProcessingScan.current = true;
    setBarcodeInput(cleanCode);
    setScanStatus({ type: 'loading', msg: `กำลังตรวจสอบรหัส ${cleanCode} แบบสแกนเร็ว...` });

    playBeep();

    const {
      scoreSum: curScoreSum,
      scannedItems: curScannedItems,
      timeUsed: curTimeUsed,
      roomData: curRoomData,
      roomCode: curRoomCode,
      playerName,
      playerId: curPlayerId,
      scannedBarcodes: curScannedBarcodes,
    } = latestState.current;

    try {
      const itemLimit = clampTargetItems(curRoomData?.itemLimit || curRoomData?.foodLimit);
      const playerDocId = curPlayerId || createPlayerSessionId(playerName);

      if (curRoomData?.status === 'finished' || isRoomTimeExpired(curRoomData)) {
        await finishGameForPlayer('time_expired');
        isProcessingScan.current = false;
        return;
      }

      if (curScannedItems >= itemLimit) {
        codeReader.current?.reset();
        stopCamera();
        setScanStatus({ type: 'success', msg: 'สแกนครบตามภารกิจแล้ว กำลังรอหมดเวลา/รอครูปิดห้อง' });
        isProcessingScan.current = false;
        return;
      }

      const alreadyScanned =
        scannedBarcodeSetRef.current.has(cleanCode) ||
        (curScannedBarcodes || []).map(normalizeBarcode).includes(cleanCode);

      if (alreadyScanned) {
        setScanStatus({
          type: 'error',
          msg: `⚠️ รหัส ${cleanCode} ถูกสแกนแล้วในรอบนี้ กรุณาเลือกอาหาร/ขนมชิ้นอื่น`,
        });

        window.setTimeout(() => {
          setScanStatus({ type: '', msg: '' });
          setBarcodeInput('');
          isProcessingScan.current = false;
        }, 2400);
        return;
      }

      const foundItem = await findFoodByBarcode(cleanCode);

      if (!foundItem) {
        setScanStatus({
          type: 'error',
          msg: `❌ ไม่พบรหัส ${cleanCode} ในฐานข้อมูล Firebase`,
        });

        window.setTimeout(() => {
          setScanStatus({ type: '', msg: '' });
          isProcessingScan.current = false;
        }, 2200);
        return;
      }

      const scannedFood = { ...foundItem, barcode: cleanCode };
      const details = calcItemDetails(scannedFood);
      const newTotalScore = curScoreSum + details.avgStars;
      const newItemsCount = curScannedItems + 1;
      const scorePackage = buildPlayerScore({
        scoreSum: newTotalScore,
        itemsScanned: newItemsCount,
        itemLimit,
        timeUsed: curTimeUsed,
      });
      const finalScoreToSave = scorePackage.rankingScore;
      const earnedBonus = scorePackage.speedBonus;

      await saveScanToFirebase({
        roomCode: curRoomCode,
        playerDocId,
        playerName,
        food: scannedFood,
        details,
        newTotalScore,
        newItemsCount,
        finalScoreToSave,
        earnedBonus,
        itemLimit,
        timeUsed: curTimeUsed,
      });

      const nextScannedBarcodes = Array.from(
        new Set([...(curScannedBarcodes || []), scannedFood.barcode].map(normalizeBarcode)),
      );

      if (newItemsCount >= itemLimit) {
        await savePlayerProgressSnapshot('mission_completed_waiting_summary', {
          roomCode: curRoomCode,
          playerId: playerDocId,
          playerName,
          roomData: curRoomData,
          scoreSum: newTotalScore,
          itemsScanned: newItemsCount,
          itemLimit,
          timeUsed: curTimeUsed,
          scannedBarcodes: nextScannedBarcodes,
          finalizeForReport: false,
        });
      }

      setScoreSum(newTotalScore);
      setScore(finalScoreToSave);
      setScannedItems(newItemsCount);
      setScannedBarcodes((prev) => {
        const nextSet = new Set([...prev, ...nextScannedBarcodes].map(normalizeBarcode));
        scannedBarcodeSetRef.current = nextSet;
        return Array.from(nextSet);
      });
      setSpeedBonus(earnedBonus);
      if (newItemsCount >= itemLimit) {
        codeReader.current?.reset();
        stopCamera();
        setScanStatus({ type: 'success', msg: `✅ สแกนสำเร็จ! เจอ ${scannedFood.name} และครบภารกิจแล้ว` });
      } else {
        setScanStatus({ type: 'success', msg: `✅ สแกนสำเร็จ! เจอ ${scannedFood.name}` });
      }
      setShowVideoModal({ ...scannedFood, details });
    } catch (err) {
      console.error('processBarcode error:', err);
      if (err?.message === 'DUPLICATE_BARCODE') {
        setScanStatus({
          type: 'error',
          msg: `⚠️ รหัส ${cleanCode} ถูกสแกนแล้วในรอบนี้ กรุณาเลือกอาหาร/ขนมชิ้นอื่น`,
        });

        window.setTimeout(() => {
          setScanStatus({ type: '', msg: '' });
          setBarcodeInput('');
          isProcessingScan.current = false;
        }, 2400);
        return;
      }

      setScanStatus({
        type: 'error',
        msg: `เกิดข้อผิดพลาดระหว่างอ่านฐานข้อมูลหรือบันทึกคะแนน: ${err?.message || 'ตรวจสอบสิทธิ์ Firestore'}`,
      });

      window.setTimeout(() => {
        setScanStatus({ type: '', msg: '' });
        isProcessingScan.current = false;
      }, 2500);
    }
  }

  const handleJoinRoom = async (e) => {
    e.preventDefault();

    const cleanRoomCode = roomCode.trim();
    if (!cleanRoomCode) return;

    const docRef = doc(db, 'rooms', cleanRoomCode);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists() && docSnap.data().status === 'waiting') {
      const joinedRoomData = docSnap.data();
      setRoomCode(cleanRoomCode);
      setRoomData(joinedRoomData);
      preloadFoodsForRoom(joinedRoomData);
      setStep('select_avatar');
    } else {
      alert('ไม่พบห้อง หรือเกมเริ่มไปแล้ว!');
    }
  };

  const handleStartWait = async (e) => {
    e.preventDefault();

    if (!playerInfo.avatar || !playerInfo.name.trim()) {
      alert('กรุณาเลือกฮีโร่และตั้งชื่อ!');
      return;
    }

    const cleanPlayerName = playerInfo.name.trim();
    const nextPlayerId = createPlayerSessionId(cleanPlayerName);
    const playerKey = safeDocId(cleanPlayerName);
    const currentRoomData = roomData || latestState.current.roomData || {};

    setPlayerId(nextPlayerId);
    finishRequestedRef.current = false;
    finalSummarySavedRef.current = false;
    await preloadFoodsForRoom(currentRoomData);

    await setDoc(doc(db, 'rooms', roomCode, 'players', nextPlayerId), {
      name: cleanPlayerName,
      playerKey,
      sessionId: nextPlayerId,
      roomCode,
      schoolName: getRoomSchoolName(currentRoomData),
      adminId: currentRoomData?.adminId || '',
      avatar: playerInfo.avatar.icon,
      score: 0,
      rankingScore: 0,
      scoreSum: 0,
      averageScore: 0,
      speedBonus: 0,
      targetItems: clampTargetItems(currentRoomData?.itemLimit || currentRoomData?.foodLimit),
      completionRate: 0,
      completionPercent: 0,
      missionCompleted: false,
      itemsScanned: 0,
      scannedBarcodes: [],
      lifecycleStatus: 'joined_waiting_start',
      includeInReport: false,
      isFinal: false,
      reportReady: false,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setScoreSum(0);
    setScore(0);
    setSpeedBonus(0);
    setScannedItems(0);
    setScannedBarcodes([]);
    scannedBarcodeSetRef.current = new Set();
    setStep('waiting');
  };

  const handleManualScanSubmit = async (e) => {
    e.preventDefault();
    if (!barcodeInput) return;
    await processBarcode(barcodeInput);
  };

  const closeVideo = () => {
    setShowVideoModal(null);
    setBarcodeInput('');

    window.setTimeout(() => {
      const latestRoom = latestState.current.roomData || {};
      const latestTargetItems = clampTargetItems(latestRoom.itemLimit || latestRoom.foodLimit);
      const latestScannedItems = Number(latestState.current.scannedItems || 0);

      isProcessingScan.current = false;

      if (latestScannedItems >= latestTargetItems) {
        codeReader.current?.reset();
        stopCamera();
        setScanStatus({ type: 'success', msg: 'ภารกิจครบแล้ว ระบบปิดกล้องและรอสรุปผลจากครู' });
        return;
      }

      setScanStatus({ type: '', msg: '' });
    }, 900);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const targetItems = clampTargetItems(roomData?.itemLimit || roomData?.foodLimit);
  const summaryScore = buildPlayerScore({
    scoreSum,
    itemsScanned: scannedItems,
    itemLimit: targetItems,
    timeUsed,
  });
  const summaryLevel = summaryScore.overallLevel;
  const summarySpeedLevel = summaryScore.speedLevel;
  const completionPercent = Math.round(summaryScore.completionRate * 100);

  useEffect(() => {
    if (step !== 'summary' || !roomCode || !playerId || finalSummarySavedRef.current) return;

    finalSummarySavedRef.current = true;
    savePlayerProgressSnapshot('summary', {
      roomCode,
      playerId,
      playerName: playerInfo.name.trim(),
      roomData,
      scoreSum,
      itemsScanned: scannedItems,
      itemLimit: targetItems,
      timeUsed,
      scannedBarcodes,
      finalizeForReport: true,
    }).catch((err) => {
      console.warn('Unable to save final player summary:', err);
      finalSummarySavedRef.current = false;
      setScanStatus({
        type: 'error',
        msg: `บันทึกสรุปผลไม่สำเร็จ: ${err?.message || 'ตรวจสอบ Firestore Rules'}`,
      });
    });
  }, [step, roomCode, playerId, roomData, playerInfo.name, scoreSum, scannedItems, timeUsed, scannedBarcodes, targetItems]);

  return (
    <div className="min-h-screen bg-[#0a192f] text-white font-sans relative overflow-hidden flex flex-col">
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(160px); }
          100% { transform: translateY(0); }
        }
        @keyframes agentFloat {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-14px) rotate(3deg); }
        }
        @keyframes sparkleSpin {
          0% { transform: rotate(0deg) scale(1); opacity: 0.55; }
          50% { transform: rotate(180deg) scale(1.16); opacity: 1; }
          100% { transform: rotate(360deg) scale(1); opacity: 0.55; }
        }
        @keyframes progressGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(34,197,94,0.0); }
          50% { box-shadow: 0 0 30px rgba(34,197,94,0.45); }
        }
      `}</style>

      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[10%] right-[10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply blur-[100px] animate-pulse"></div>
      </div>

      {isPaused && step === 'playing' && (
        <div className="absolute inset-0 z-50 bg-[#061020]/90 backdrop-blur-md flex items-center justify-center">
          <div className="text-center p-10 bg-slate-900/80 rounded-3xl border-2 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.3)]">
            <PauseCircle className="w-24 h-24 text-amber-500 mx-auto mb-6 animate-pulse" />
            <h1 className="text-4xl font-black text-amber-400 uppercase tracking-widest mb-4">ระบบถูกระงับชั่วคราว</h1>
            <p className="text-xl text-slate-300 font-bold">" ผู้สร้างขอพักซักครู่... "</p>
          </div>
        </div>
      )}

      {showVideoModal && (
        <div className="absolute inset-0 z-40 bg-black/90 flex flex-col items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#112240] rounded-3xl overflow-hidden max-w-md w-full border border-cyan-500/50 shadow-[0_0_40px_rgba(6,182,212,0.4)] my-auto">
            <div className="p-4 bg-cyan-900/30 flex justify-between items-center border-b border-cyan-500/30">
              <h3 className="text-xl font-black text-cyan-400">ข้อมูล: {showVideoModal.name}</h3>
              <button onClick={closeVideo} className="text-slate-400 hover:text-white">
                <XCircle size={28} />
              </button>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className="flex justify-center gap-2">
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 w-1/3">
                  <div className="text-[10px] text-slate-400 uppercase">น้ำตาล</div>
                  <div className="font-black text-xl text-white">{showVideoModal.sugar}g</div>
                  <div className="text-amber-400 text-xs mt-1">
                    {'⭐'.repeat(showVideoModal.details.sugarStars)}
                  </div>
                </div>

                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 w-1/3">
                  <div className="text-[10px] text-slate-400 uppercase">ไขมัน</div>
                  <div className="font-black text-xl text-white">{showVideoModal.fat}g</div>
                  <div className="text-amber-400 text-xs mt-1">
                    {'⭐'.repeat(showVideoModal.details.fatStars)}
                  </div>
                </div>

                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 w-1/3">
                  <div className="text-[10px] text-slate-400 uppercase">โซเดียม</div>
                  <div className="font-black text-xl text-white">{showVideoModal.salt}mg</div>
                  <div className="text-amber-400 text-xs mt-1">
                    {'⭐'.repeat(showVideoModal.details.saltStars)}
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl border-2 ${showVideoModal.details.status.bg} ${showVideoModal.details.status.color}`}>
                <div className="text-2xl font-black mb-2 flex items-center justify-center gap-2">
                  {showVideoModal.details.status.icon} {showVideoModal.details.status.label}
                  <span className="ml-auto text-sm bg-black/30 px-3 py-1 rounded-full text-white border border-white/20">
                    เฉลี่ย {showVideoModal.details.avgStars.toFixed(2)} ดาว
                  </span>
                </div>
                <div className="font-bold text-sm leading-relaxed text-white drop-shadow-md">
                  {showVideoModal.details.status.msg}
                </div>
              </div>
            </div>

            <div className="aspect-video bg-black relative border-y border-cyan-900/50">
              <FoodVideoPlayer videoUrl={showVideoModal.video} />
            </div>

            <div className="p-6 shrink-0">
              <button
                onClick={closeVideo}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-xl text-lg uppercase transition-transform active:scale-95"
              >
                ดำเนินการสแกนต่อ
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        {step === 'enter_room' && (
          <div className="bg-[#112240]/80 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-2xl border border-blue-500/30 max-w-sm w-full animate-in zoom-in-95">
            <div className="text-center mb-8">
              <ShieldCheck className="w-20 h-20 text-cyan-400 mx-auto mb-4" />
              <h1 className="text-3xl font-black text-white uppercase tracking-widest">SFS Game</h1>
              <p className="text-cyan-500 font-bold mt-2">เข้าร่วมภารกิจลับ</p>
            </div>

            <form onSubmit={handleJoinRoom} className="space-y-6">
              <input
                type="text"
                placeholder="รหัสห้อง (Room Code)"
                required
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="w-full text-center text-3xl tracking-widest font-black uppercase px-4 py-5 rounded-2xl bg-[#0a192f] border-2 border-cyan-900 focus:border-cyan-400 text-white outline-none placeholder:text-slate-600 placeholder:text-lg"
              />

              <button
                type="submit"
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-xl text-xl uppercase tracking-widest transition-transform active:scale-95"
              >
                ตกลง (Next)
              </button>
            </form>

            <Link to="/" className="block mt-6 text-center text-slate-500 font-bold hover:text-white">
              กลับหน้าหลัก
            </Link>
          </div>
        )}

        {step === 'select_avatar' && (
          <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-black text-cyan-400 uppercase tracking-widest drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                สร้างตัวตนสายลับ
              </h1>
              {getRoomSchoolName(roomData) && (
                <p className="mt-3 inline-flex rounded-full border border-lime-300/30 bg-lime-300/10 px-5 py-2 text-sm font-black text-lime-200">
                  กำลังเล่นกับ {getRoomSchoolName(roomData)}
                </p>
              )}
            </div>

            <form
              onSubmit={handleStartWait}
              className="bg-[#112240]/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-blue-500/30 shadow-2xl"
            >
              <div className="mb-8">
                <input
                  type="text"
                  placeholder="พิมพ์ชื่อสายลับของคุณ..."
                  required
                  value={playerInfo.name}
                  onChange={(e) => setPlayerInfo({ ...playerInfo, name: e.target.value })}
                  className="w-full max-w-md mx-auto block text-center text-2xl font-black px-6 py-4 rounded-2xl bg-[#0a192f] border-2 border-cyan-800 focus:border-cyan-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-10">
                {HERO_AVATARS.map((hero) => (
                  <button
                    type="button"
                    key={hero.id}
                    onClick={() => setPlayerInfo({ ...playerInfo, avatar: hero })}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-4 transition-all ${
                      playerInfo.avatar?.id === hero.id
                        ? 'bg-cyan-900/50 border-cyan-400 scale-105'
                        : 'bg-[#0a192f] border-transparent'
                    }`}
                  >
                    <span className="text-6xl mb-2">{hero.icon}</span>
                    <span className="text-xs font-black text-slate-300">{hero.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex justify-center gap-4">
                <button
                  type="submit"
                  className="px-12 py-4 rounded-2xl font-black text-[#0a192f] bg-gradient-to-r from-cyan-400 to-blue-500 text-xl uppercase tracking-widest active:scale-95 transition-transform"
                >
                  ยืนยันตัวตนเข้าร่วม
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'waiting' && (
          <div className="bg-[#112240]/80 p-10 rounded-[2.5rem] border-2 border-blue-500/50 shadow-[0_0_50px_rgba(37,99,235,0.2)] max-w-lg w-full text-center animate-in zoom-in-95">
            <div className="w-24 h-24 mx-auto bg-blue-900/50 rounded-full flex items-center justify-center mb-6 border-4 border-blue-500/50">
              <span className="text-6xl">{playerInfo.avatar?.icon}</span>
            </div>

            <h2 className="text-2xl font-black text-white mb-2">
              ยินดีต้อนรับ, <span className="text-cyan-400">{playerInfo.name}</span>
            </h2>
            {getRoomSchoolName(roomData) && (
              <div className="mb-4 inline-flex rounded-full border border-lime-300/30 bg-lime-300/10 px-5 py-2 text-sm font-black text-lime-200">
                เล่นกับ {getRoomSchoolName(roomData)}
              </div>
            )}

            <div className="bg-[#0a192f] rounded-2xl p-6 text-left border border-blue-800/50 my-8 space-y-4">
              <h3 className="text-lg font-black text-cyan-400 flex items-center gap-2">
                <AlertCircle size={20} /> กติกาและเป้าหมายภารกิจ
              </h3>
              <ul className="space-y-3 text-slate-300 font-medium">
                <li className="flex justify-between">
                  <span>⏱ เวลาในภารกิจ:</span>
                  <span className="text-white">{roomData?.timeLimit} นาที</span>
                </li>
                <li className="flex justify-between">
                  <span>📦 เป้าหมายไอเทม:</span>
                  <span className="text-white">{clampTargetItems(roomData?.itemLimit || roomData?.foodLimit)} ชิ้น</span>
                </li>
                <li className="flex justify-between">
                  <span>⚡ ฐานอาหาร:</span>
                  <span className="text-cyan-300">
                    {foodIndexStatus.state === 'loading'
                      ? 'กำลังเตรียม...'
                      : foodIndexStatus.count > 0
                        ? `${foodIndexStatus.count} รายการ`
                        : 'พร้อมค้นหา'}
                  </span>
                </li>
              </ul>
            </div>

            <div className="text-amber-400 font-black animate-pulse text-xl flex items-center justify-center gap-3">
              <Clock /> รอผู้สร้างกดเริ่มเกม...
            </div>
          </div>
        )}

        {step === 'playing' && (
          <div className="w-full max-w-md flex flex-col h-full">
            <div className="bg-[#112240]/90 rounded-2xl p-4 mb-4 flex justify-between items-center border border-blue-500/30">
              <div className="flex items-center gap-3">
                <span className="text-4xl bg-blue-900/50 rounded-full p-1">
                  {playerInfo.avatar?.icon}
                </span>
                <div>
                  <div className="text-xs text-cyan-500 font-black">AGENT</div>
                  <div className="font-bold text-white">{playerInfo.name}</div>
                  {getRoomSchoolName(roomData) && (
                    <div className="mt-1 text-[11px] font-black text-lime-300">
                      {getRoomSchoolName(roomData)}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-slate-400">
                  เป้าหมาย: {scannedItems}/{clampTargetItems(roomData?.itemLimit || roomData?.foodLimit)}
                </div>
                <div className="text-[10px] font-black text-cyan-300 uppercase tracking-widest">
                  เหลือเวลา
                </div>
                <div className="text-xl font-black text-amber-400 flex gap-1 justify-end">
                  <Clock size={18} /> {formatTime(timeRemaining || 0)}
                </div>
              </div>
            </div>

            <div className="flex-1 bg-[#0a192f] border-2 border-cyan-500/50 rounded-3xl overflow-hidden flex flex-col items-center justify-center p-4 mb-4 relative shadow-[0_0_30px_rgba(6,182,212,0.2)]">
              {missionCompletedOnClient ? (
                <div className="w-full aspect-[3/4] sm:aspect-video border-4 border-emerald-400/70 rounded-3xl flex flex-col items-center justify-center mb-4 relative overflow-hidden bg-gradient-to-br from-emerald-950 via-cyan-950 to-blue-950 p-6 text-center" style={{ animation: 'progressGlow 2.6s ease-in-out infinite' }}>
                  <div className="absolute inset-0 opacity-25 pointer-events-none">
                    <div className="absolute -top-10 -left-10 text-7xl" style={{ animation: 'sparkleSpin 6s linear infinite' }}>✨</div>
                    <div className="absolute top-8 right-8 text-5xl" style={{ animation: 'sparkleSpin 5s linear infinite reverse' }}>⭐</div>
                    <div className="absolute bottom-8 left-10 text-5xl" style={{ animation: 'sparkleSpin 7s linear infinite' }}>🟢</div>
                    <div className="absolute -bottom-8 -right-8 text-8xl opacity-70" style={{ animation: 'sparkleSpin 8s linear infinite reverse' }}>🥦</div>
                  </div>

                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-32 h-32 rounded-full bg-white/95 border-8 border-emerald-300 shadow-[0_0_35px_rgba(16,185,129,0.55)] flex items-center justify-center text-7xl mb-5" style={{ animation: 'agentFloat 2.3s ease-in-out infinite' }}>
                      {playerInfo.avatar?.icon || '🕵️'}
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/20 border border-emerald-300/60 px-5 py-2 text-emerald-100 font-black text-sm mb-4">
                      ✅ สแกนครบตามภารกิจแล้ว
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
                      กำลังเตรียมผลสรุปภารกิจ
                    </h2>
                    <p className="text-sm md:text-base font-bold text-cyan-100 leading-relaxed max-w-sm">
                      ระบบปิดกล้องแล้ว เพื่อประหยัดแบตเตอรี่และรอครูปิดห้อง/หมดเวลา จากนั้นจะแสดงหน้าสรุปคะแนนอัตโนมัติ
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-3 w-full max-w-xs">
                      <div className="rounded-2xl bg-black/25 border border-white/10 p-3">
                        <div className="text-xs text-cyan-200 font-bold">จำนวนที่สแกน</div>
                        <div className="text-2xl font-black text-white">{scannedItems}/{currentTargetItems}</div>
                      </div>
                      <div className="rounded-2xl bg-black/25 border border-white/10 p-3">
                        <div className="text-xs text-cyan-200 font-bold">เหลือเวลา</div>
                        <div className="text-2xl font-black text-amber-300">{formatTime(timeRemaining || 0)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-full aspect-[3/4] sm:aspect-video border-4 border-cyan-500/70 rounded-2xl flex flex-col items-center justify-center mb-2 relative overflow-hidden bg-black">
                    {cameraError ? (
                      <div className="text-center p-4 relative z-10">
                        <Camera className="w-16 h-16 text-rose-500/50 mx-auto mb-2" />
                        <p className="text-rose-400 text-sm font-bold">{cameraError}</p>
                      </div>
                    ) : (
                      <video
                        ref={videoRef}
                        muted
                        playsInline
                        className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                      ></video>
                    )}

                    {!cameraError && (
                      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
                        <div className="w-[72%] max-w-[320px] aspect-square border-[5px] border-cyan-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.52)]">
                          <div className="absolute top-1/2 left-0 w-full h-[3px] bg-red-500 shadow-[0_0_18px_#ef4444] animate-[scan_2s_ease-in-out_infinite]"></div>
                          <div className="absolute -top-8 left-0 right-0 text-center text-xs font-black text-cyan-200">
                            วาง QR Code ให้อยู่ในกรอบนี้
                          </div>
                        </div>
                      </div>
                    )}

                    {!cameraError && (
                      <div className="absolute bottom-4 right-4 z-20 flex gap-2">
                        <button
                          type="button"
                          onClick={toggleCamera}
                          className="bg-cyan-600/85 p-3 rounded-full hover:bg-cyan-500 backdrop-blur-sm border border-cyan-400/50 shadow-lg"
                          title="สลับกล้องหน้า/หลัง"
                        >
                          <RefreshCcw size={24} className="text-white" />
                        </button>
                      </div>
                    )}
                  </div>

                  {!cameraError && (
                    <div className="text-center mb-4 min-h-[40px] flex flex-col items-center justify-center gap-2 px-4">
                      <p className="text-sm font-black text-cyan-300 bg-cyan-900/50 px-5 py-2 rounded-full border border-cyan-500/50 transition-opacity duration-300">
                        {scanHint}
                      </p>
                      <p className={`text-[11px] font-black px-4 py-1 rounded-full border ${
                        foodIndexStatus.state === 'ready'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                          : foodIndexStatus.state === 'loading'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                            : 'bg-slate-500/15 text-slate-300 border-slate-400/20'
                      }`}>
                        {foodIndexStatus.state === 'loading'
                          ? '⚡ กำลังเตรียมฐานอาหารสำหรับสแกนเร็ว...'
                          : foodIndexStatus.count > 0
                            ? `⚡ โหมดสแกนเร็วพร้อม: ${foodIndexStatus.count} รายการ`
                            : '⚡ โหมดสแกนเร็วพร้อมค้นหา'}
                      </p>
                    </div>
                  )}
                </>
              )}

              {scanStatus.msg && (
                <div
                  className={`mb-4 px-4 py-2 rounded-lg font-bold text-sm w-full text-center ${
                    scanStatus.type === 'success'
                      ? 'bg-green-500/20 text-green-400'
                      : scanStatus.type === 'loading'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {scanStatus.msg}
                </div>
              )}

              {!missionCompletedOnClient && (
                <form
                  onSubmit={handleManualScanSubmit}
                  className="w-full bg-[#112240] p-4 rounded-2xl border border-cyan-900/50 relative z-10"
                >
                  <label className="block text-xs font-black text-cyan-400 mb-2 text-center">
                    สแกน QR ไม่ติด? กรอกเลขบาร์โค้ดเองได้เลย
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="เช่น 8850002"
                      className="flex-1 px-4 py-3 rounded-xl bg-[#0a192f] border border-cyan-700 focus:border-cyan-400 text-white font-bold outline-none text-center"
                    />
                    <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 p-3 rounded-xl">
                      <Send size={24} />
                    </button>
                  </div>
                </form>
              )}
            </div>

            {missionCompletedOnClient && (
              <div className="bg-green-600 text-white font-black text-center py-3 rounded-xl animate-pulse">
                ภารกิจเสร็จสิ้น! ปิดกล้องแล้ว รอครูปิดห้องหรือหมดเวลา
              </div>
            )}
          </div>
        )}

        {step === 'summary' && (
          <div className="w-full max-w-3xl text-center animate-in zoom-in duration-500">
            <Trophy className="w-24 h-24 text-amber-400 mx-auto mb-6 drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]" />
            <h1 className="text-4xl md:text-5xl font-black text-amber-400 uppercase tracking-widest mb-2">
              จบภารกิจ
            </h1>
            {getRoomSchoolName(roomData) && (
              <div className="mt-3 inline-flex rounded-full border border-lime-300/30 bg-lime-300/10 px-5 py-2 text-sm font-black text-lime-200">
                ผลภารกิจของ {getRoomSchoolName(roomData)}
              </div>
            )}

            <div className="bg-[#112240]/90 border-2 border-cyan-500/50 rounded-[2rem] p-6 md:p-8 my-8 shadow-[0_0_30px_rgba(6,182,212,0.2)] text-left">
              <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left mb-6">
                <div className="w-24 h-24 rounded-full bg-blue-900/60 border-4 border-cyan-400/50 flex items-center justify-center text-6xl shadow-[0_0_25px_rgba(6,182,212,0.25)]">
                  {playerInfo.avatar?.icon || '🕵️'}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-black text-cyan-300 uppercase tracking-[0.25em] mb-1">
                    Agent Name
                  </div>
                  <h2 className="text-3xl font-black text-white">{playerInfo.name || 'สายลับ'}</h2>
                  <p className="text-sm font-bold text-slate-400 mt-1">
                    รหัสรอบการเล่น: <span className="text-slate-200">{playerId || '-'}</span>
                  </p>
                </div>
              </div>

              {!summaryScore.missionCompleted && (
                <div className="mb-6 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-4 text-center text-amber-200 font-bold">
                  ⚠️ ยังสแกนไม่ครบตามโจทย์ คะแนนจัดอันดับจึงถูกถ่วงน้ำหนัก เพื่อให้ผู้ที่ทำภารกิจครบได้เปรียบตามกติกา
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-[#0a192f] p-4 rounded-2xl border border-slate-700">
                  <div className="text-xs text-slate-400 uppercase tracking-widest">สแกนสำเร็จ</div>
                  <div className="text-2xl font-black mt-1 text-white">
                    {summaryScore.itemsScanned}/{summaryScore.targetItems}
                    <span className="text-sm font-normal text-slate-500"> ชิ้น</span>
                  </div>
                </div>
                <div className="bg-[#0a192f] p-4 rounded-2xl border border-slate-700">
                  <div className="text-xs text-slate-400 uppercase tracking-widest">ความครบถ้วน</div>
                  <div className="text-2xl font-black mt-1 text-cyan-300">{completionPercent}%</div>
                </div>
                <div className="bg-[#0a192f] p-4 rounded-2xl border border-slate-700">
                  <div className="text-xs text-slate-400 uppercase tracking-widest">เวลาที่ใช้</div>
                  <div className="text-2xl font-black mt-1 text-white">{formatTime(timeUsed)}</div>
                </div>
                <div className="bg-[#0a192f] p-4 rounded-2xl border border-slate-700">
                  <div className="text-xs text-slate-400 uppercase tracking-widest">เฉลี่ย/ชิ้น</div>
                  <div className="text-2xl font-black mt-1 text-white">
                    {summarySpeedLevel.avgSeconds ? summarySpeedLevel.avgSeconds.toFixed(1) : '0.0'}
                    <span className="text-sm font-normal text-slate-500"> วิ</span>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className={`rounded-3xl border-2 ${summaryLevel.borderClass} bg-[#0a192f] p-5`}>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-[0.25em] mb-2">
                    คะแนนภาพรวม
                  </div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="text-5xl font-black text-white">
                      {summaryScore.averageScore.toFixed(2)}
                      <span className="text-lg text-slate-500">/5</span>
                    </div>
                    <div className={`rounded-2xl bg-gradient-to-r ${summaryLevel.badgeClass} px-4 py-3 text-3xl shadow-lg`}>
                      {summaryLevel.icon}
                    </div>
                  </div>
                  <h3 className={`text-2xl font-black ${summaryLevel.textClass}`}>{summaryLevel.title}</h3>
                  <div className="text-sm font-black text-white mt-1">({summaryLevel.titleEn})</div>
                  <div className="mt-3 text-sm font-bold text-slate-300">{summaryLevel.colorName}</div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{summaryLevel.note}</p>
                </div>

                <div className="rounded-3xl border-2 border-amber-400/60 bg-[#0a192f] p-5">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-[0.25em] mb-2">
                    ระดับความเร็ว
                  </div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="text-5xl font-black text-white">
                      {summarySpeedLevel.icon}
                    </div>
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-400/40 px-4 py-2 text-right">
                      <div className="text-xs text-amber-200 font-black">โบนัส</div>
                      <div className="text-2xl text-amber-300 font-black">
                        +{Number(summaryScore.speedBonus || 0).toFixed(3)}
                      </div>
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-amber-300">{summarySpeedLevel.title}</h3>
                  <div className="text-sm font-black text-white mt-1">({summarySpeedLevel.titleEn})</div>
                  <div className="mt-3 inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-100">
                    เฉลี่ยต่อชิ้น: {summarySpeedLevel.rangeLabel || 'ยังไม่คำนวณ'}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{summarySpeedLevel.note}</p>
                </div>
              </div>

              <div className="rounded-3xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-400/40 p-5 text-center mb-6">
                <div className="text-sm font-black text-cyan-200 uppercase tracking-[0.25em] mb-2">
                  คะแนนจัดอันดับ Leaderboard
                </div>
                <div className="text-6xl font-black text-white mb-2">
                  {summaryScore.rankingScore.toFixed(3)}
                </div>
                <div className="text-sm font-bold text-slate-300">
                  {summaryScore.missionCompleted
                    ? 'สแกนครบแล้ว ใช้คะแนนเฉลี่ยรวมกับโบนัสความเร็วในการจัดอันดับ'
                    : 'ยังไม่ครบภารกิจ ระบบถ่วงคะแนนตามจำนวนชิ้นที่สแกนได้'}
                </div>
              </div>

              <div className="rounded-3xl bg-[#0a192f] border border-slate-700 p-5">
                <h3 className="text-lg font-black text-cyan-300 mb-4 text-center">
                  เกณฑ์ผลสรุปคะแนนภาพรวม
                </h3>
                <div className="space-y-2">
                  {OVERALL_LEVELS.map((level) => (
                    <div
                      key={level.titleEn}
                      className="grid grid-cols-[6rem_1fr] md:grid-cols-[7rem_1fr_12rem] gap-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-3 text-sm"
                    >
                      <div className="font-black text-white">
                        {level.min === 0
                          ? 'ต่ำกว่า 2.5'
                          : level.min === 4.5
                            ? '4.5-5.0'
                            : level.min === 3.5
                              ? '3.5-4.4'
                              : '2.5-3.4'}
                      </div>
                      <div>
                        <div className="font-black text-white">{level.title}</div>
                        <div className="font-bold text-slate-400">({level.titleEn})</div>
                      </div>
                      <div className="hidden md:block font-bold text-slate-300">{level.icon} {level.colorName}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-[#0a192f] border border-amber-500/40 p-5 mt-5">
              <h3 className="text-lg font-black text-amber-300 mb-4 text-center">
                เกณฑ์คะแนนโบนัสความเร็ว
              </h3>
              <div className="space-y-2">
                {SPEED_LEVELS.map((level) => (
                  <div
                    key={level.titleEn}
                    className="grid grid-cols-[7.5rem_1fr_5.5rem] md:grid-cols-[10rem_1fr_7rem] gap-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-3 text-sm items-center"
                  >
                    <div className="font-black text-white">{level.rangeLabel}</div>
                    <div>
                      <div className="font-black text-white">{level.icon} {level.title}</div>
                      <div className="font-bold text-slate-400">({level.titleEn})</div>
                    </div>
                    <div className="text-right font-black text-amber-300">+{Number(level.bonus || 0).toFixed(3)}</div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-xl py-4 rounded-2xl uppercase shadow-[0_0_30px_rgba(245,158,11,0.4)]"
            >
              เล่นใหม่อีกครั้ง
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
