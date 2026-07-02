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
  ZoomIn,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
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

const safeDocId = (value) =>
  String(value || 'player')
    .trim()
    .replace(/[.#$/[\]]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || `player_${Date.now()}`;

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
  const [scanHint, setScanHint] = useState('จัดบาร์โค้ดให้อยู่ในกรอบแนวนอน...');

  const championMusic = useRef(
    new Audio('https://cdn.pixabay.com/download/audio/2021/08/09/audio_c8c8a73467.mp3?filename=success-fanfare-trumpets-6185.mp3'),
  );
  const actionMusic = useRef(
    new Audio('https://cdn.pixabay.com/download/audio/2022/10/18/audio_31c2730e64.mp3?filename=action-dramatic-sport-rock-trailer-122763.mp3'),
  );

  const videoRef = useRef(null);
  const codeReader = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const audioContextRef = useRef(null);
  const waitingVoiceTimerRef = useRef(null);

  const isProcessingScan = useRef(false);
  const lastScanRef = useRef({ code: '', time: 0 });
  const foodCacheRef = useRef(new Map());
  const scannedBarcodeSetRef = useRef(new Set());

  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('environment');
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomMin, setZoomMin] = useState(1);
  const [zoomMax, setZoomMax] = useState(1);
  const [zoomStep, setZoomStep] = useState(0.1);

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
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
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

        if (data.status === 'playing') {
          if (step === 'waiting') setStep('playing');
          setIsPaused(false);
        } else if (data.status === 'paused') {
          setIsPaused(true);
        } else if (data.status === 'finished') {
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
        setShowVideoModal(null);
        setStep('summary');
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
    if (step === 'playing' && !isPaused && !showVideoModal && !cameraError) {
      const hints = [
        'เล็งบาร์โค้ดให้เต็มกรอบแนวนอน',
        'ถ้าอ่านไม่ติด ให้ซูมเข้าเล็กน้อย',
        'ระวังแสงสะท้อนบนซองขนม',
        'ถือกล้องให้นิ่งประมาณ 1 วินาที',
        'บาร์โค้ดเอียงเล็กน้อยอ่านได้ แต่ไม่ควรเบลอ',
      ];

      let hintIndex = 0;
      hintTimer = setInterval(() => {
        hintIndex = (hintIndex + 1) % hints.length;
        setScanHint(hints[hintIndex]);
      }, 2500);
    }

    return () => clearInterval(hintTimer);
  }, [step, isPaused, showVideoModal, cameraError]);

  useEffect(() => {
    actionMusic.current.loop = true;
    actionMusic.current.volume = 0.35;

    if (step === 'playing' && !isPaused && !showVideoModal) {
      actionMusic.current.play().catch(() => {});
    } else {
      actionMusic.current.pause();
    }

    return () => {
      actionMusic.current.pause();
    };
  }, [step, isPaused, showVideoModal]);

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
    if (step === 'playing' && !isPaused && !showVideoModal && codeReader.current) {
      startScanner();
    } else {
      codeReader.current?.reset();
      stopCamera();
    }

    return () => {
      codeReader.current?.reset();
      stopCamera();
    };
  }, [step, isPaused, showVideoModal, facingMode]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    streamRef.current = null;
    trackRef.current = null;
  }

  async function startScanner() {
    setCameraError('');
    setZoomSupported(false);

    try {
      stopCamera();
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

      window.setTimeout(setupCameraTrackControls, 250);
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์กล้อง หรือเปิดผ่าน HTTPS/localhost');
    }
  }

  function setupCameraTrackControls() {
    const stream = videoRef.current?.srcObject;
    if (!stream) return;

    streamRef.current = stream;
    const track = stream.getVideoTracks?.()[0];
    if (!track) return;

    trackRef.current = track;

    const capabilities =
      typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
    const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};

    if (capabilities.zoom) {
      const min = capabilities.zoom.min ?? 1;
      const max = capabilities.zoom.max ?? 1;
      const stepValue = capabilities.zoom.step ?? 0.1;
      const current = settings.zoom ?? min;

      setZoomSupported(true);
      setZoomMin(min);
      setZoomMax(max);
      setZoomStep(stepValue);
      setZoomLevel(current);
    } else {
      setZoomSupported(false);
      setZoomMin(1);
      setZoomMax(1);
      setZoomStep(0.1);
      setZoomLevel(1);
    }
  }

  async function applyZoom(nextZoom) {
    const track = trackRef.current;
    if (!track || !zoomSupported) return;

    try {
      await track.applyConstraints({ advanced: [{ zoom: nextZoom }] });
    } catch (err) {
      console.warn('Zoom is not supported on this device/browser:', err);
      setZoomSupported(false);
    }
  }

  function handleZoomChange(e) {
    const nextZoom = Number(e.target.value);
    setZoomLevel(nextZoom);
    applyZoom(nextZoom);
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

  async function findFoodByBarcode(code) {
    const cleanCode = normalizeBarcode(code);
    if (!cleanCode) return null;

    if (foodCacheRef.current.has(cleanCode)) {
      return foodCacheRef.current.get(cleanCode);
    }

    const directRef = doc(db, 'foods', cleanCode);
    const directSnap = await getDoc(directRef);

    if (directSnap.exists()) {
      const food = normalizeFoodDoc({ id: directSnap.id, ...directSnap.data() }, cleanCode);
      foodCacheRef.current.set(cleanCode, food);
      return food;
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
      foodCacheRef.current.set(cleanCode, food);
      return food;
    }

    foodCacheRef.current.set(cleanCode, null);
    return null;
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
  }) {
    const playerRef = doc(db, 'rooms', currentRoomCode, 'players', playerDocId);

    await setDoc(
      playerRef,
      {
        name: playerName,
        avatar: playerInfo.avatar?.icon || '',
        score: Number(finalScoreToSave.toFixed(3)),
        scoreSum: Number(newTotalScore.toFixed(3)),
        averageScore: Number((newTotalScore / newItemsCount).toFixed(3)),
        speedBonus: Number(earnedBonus.toFixed(3)),
        itemsScanned: newItemsCount,
        scannedBarcodes: arrayUnion(food.barcode),
        lastBarcode: food.barcode,
        lastFoodName: food.name,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await addDoc(collection(db, 'rooms', currentRoomCode, 'scans'), {
      playerId: playerDocId,
      playerName,
      barcode: food.barcode,
      uniqueScanKey: `${playerDocId}_${food.barcode}`,
      foodId: food.id,
      foodName: food.name,
      category: food.category,
      sugar: food.sugar,
      fat: food.fat,
      salt: food.salt,
      sugarStars: details.sugarStars,
      fatStars: details.fatStars,
      saltStars: details.saltStars,
      avgStars: Number(details.avgStars.toFixed(3)),
      statusLabel: details.status.label,
      createdAt: serverTimestamp(),
    });
  }

  async function processBarcode(rawCode) {
    const cleanCode = normalizeBarcode(rawCode);
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
    setScanStatus({ type: 'loading', msg: `กำลังตรวจสอบรหัส ${cleanCode} จากฐานข้อมูล...` });

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
      const itemLimit = Number(curRoomData?.itemLimit || curRoomData?.foodLimit || 5);
      const playerDocId = curPlayerId || safeDocId(playerName);
      const playerRef = doc(db, 'rooms', curRoomCode, 'players', playerDocId);
      const playerSnap = await getDoc(playerRef);
      const firebaseScannedBarcodes = playerSnap.exists()
        ? playerSnap.data().scannedBarcodes || []
        : [];

      if (curScannedItems >= itemLimit) {
        setScanStatus({ type: 'success', msg: 'สแกนครบตามภารกิจแล้ว รอครูปิดเกมได้เลย' });
        isProcessingScan.current = false;
        return;
      }

      const alreadyScanned = scannedBarcodeSetRef.current.has(cleanCode) ||
        (curScannedBarcodes || []).map(normalizeBarcode).includes(cleanCode) ||
        firebaseScannedBarcodes.map(normalizeBarcode).includes(cleanCode);

      if (alreadyScanned) {
        setScannedBarcodes((prev) =>
          Array.from(new Set([...prev, ...firebaseScannedBarcodes].map(normalizeBarcode))),
        );
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

      const details = calcItemDetails(foundItem);
      const newTotalScore = curScoreSum + details.avgStars;
      const newItemsCount = curScannedItems + 1;
      const currentAvg = newTotalScore / newItemsCount;

      let finalScoreToSave = currentAvg;
      let earnedBonus = 0;

      if (newItemsCount >= itemLimit) {
        const avgTime = curTimeUsed / newItemsCount;

        if (avgTime <= 15) earnedBonus = 0.05;
        else if (avgTime <= 30) earnedBonus = 0.03;
        else if (avgTime <= 45) earnedBonus = 0.01;
        else earnedBonus = 0;

        finalScoreToSave = currentAvg + earnedBonus;
      }

      setScoreSum(newTotalScore);
      setScore(finalScoreToSave);
      setScannedItems(newItemsCount);
      setScannedBarcodes((prev) => {
        const nextSet = new Set(prev.map(normalizeBarcode));
        nextSet.add(foundItem.barcode);
        scannedBarcodeSetRef.current = nextSet;
        return Array.from(nextSet);
      });
      setSpeedBonus(earnedBonus);
      setScanStatus({ type: 'success', msg: `✅ สแกนสำเร็จ! เจอ ${foundItem.name}` });
      setShowVideoModal({ ...foundItem, details });

      await saveScanToFirebase({
        roomCode: curRoomCode,
        playerDocId,
        playerName,
        food: foundItem,
        details,
        newTotalScore,
        newItemsCount,
        finalScoreToSave,
        earnedBonus,
      });
    } catch (err) {
      console.error('processBarcode error:', err);
      setScanStatus({
        type: 'error',
        msg: 'เกิดข้อผิดพลาดระหว่างอ่านฐานข้อมูลหรือบันทึกคะแนน',
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
      setRoomCode(cleanRoomCode);
      setRoomData(docSnap.data());
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

    const nextPlayerId = safeDocId(playerInfo.name);
    setPlayerId(nextPlayerId);

    await setDoc(doc(db, 'rooms', roomCode, 'players', nextPlayerId), {
      name: playerInfo.name.trim(),
      avatar: playerInfo.avatar.icon,
      score: 0,
      scoreSum: 0,
      speedBonus: 0,
      itemsScanned: 0,
      scannedBarcodes: [],
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
      isProcessingScan.current = false;
      setScanStatus({ type: '', msg: '' });
    }, 900);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-[#0a192f] text-white font-sans relative overflow-hidden flex flex-col">
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(160px); }
          100% { transform: translateY(0); }
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
                  <span className="text-white">{roomData?.itemLimit} ชิ้น</span>
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
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-slate-400">
                  เป้าหมาย: {scannedItems}/{roomData?.itemLimit}
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
                    <div className="w-[78%] max-w-[360px] aspect-[2.6/1] border-[5px] border-cyan-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.52)]">
                      <div className="absolute top-1/2 left-0 w-full h-[3px] bg-red-500 shadow-[0_0_18px_#ef4444] animate-[scan_2s_ease-in-out_infinite]"></div>
                      <div className="absolute -top-8 left-0 right-0 text-center text-xs font-black text-cyan-200">
                        วางบาร์โค้ดให้อยู่ในกรอบนี้
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
                <div className="w-full px-2 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-cyan-300 flex items-center gap-1">
                      <ZoomIn size={16} /> ซูมกล้อง
                    </span>
                    <span className="text-xs text-slate-400">
                      {zoomSupported ? `${Number(zoomLevel).toFixed(1)}x` : 'อุปกรณ์นี้ไม่รองรับซูมผ่านเว็บ'}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={zoomMin}
                    max={zoomMax}
                    step={zoomStep}
                    value={zoomLevel}
                    disabled={!zoomSupported}
                    onChange={handleZoomChange}
                    className="w-full accent-cyan-500 disabled:opacity-30"
                  />
                </div>
              )}

              {!cameraError && (
                <div className="text-center mb-4 min-h-[40px] flex items-center justify-center px-4">
                  <p className="text-sm font-black text-cyan-300 bg-cyan-900/50 px-5 py-2 rounded-full border border-cyan-500/50 transition-opacity duration-300">
                    {scanHint}
                  </p>
                </div>
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

              <form
                onSubmit={handleManualScanSubmit}
                className="w-full bg-[#112240] p-4 rounded-2xl border border-cyan-900/50 relative z-10"
              >
                <label className="block text-xs font-black text-cyan-400 mb-2 text-center">
                  สแกนไม่ติด? กรอกรหัสบาร์โค้ดเองได้เลย
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
            </div>

            {scannedItems >= roomData?.itemLimit && (
              <div className="bg-green-600 text-white font-black text-center py-3 rounded-xl animate-pulse">
                ภารกิจเสร็จสิ้น! รอครูปิดห้อง
              </div>
            )}
          </div>
        )}

        {step === 'summary' && (
          <div className="w-full max-w-lg text-center animate-in zoom-in duration-500">
            <Trophy className="w-24 h-24 text-amber-400 mx-auto mb-6 drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]" />
            <h1 className="text-5xl font-black text-amber-400 uppercase tracking-widest mb-2">จบภารกิจ</h1>

            <div className="bg-[#112240]/90 border-2 border-cyan-500/50 rounded-3xl p-8 my-8 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
              <div className="text-sm font-black text-cyan-400 uppercase tracking-widest mb-2">
                คะแนนรวมจัดลำดับ
              </div>
              <div className="text-6xl font-black text-white mb-2">{score.toFixed(3)}</div>
              <div className="text-sm font-bold text-amber-400 mb-6 bg-amber-500/10 inline-block px-4 py-1 rounded-full border border-amber-500/30">
                + โบนัสความเร็ว: {speedBonus > 0 ? speedBonus.toFixed(3) : '0.000'}
              </div>

              <div className="grid grid-cols-2 gap-4 text-left border-t border-cyan-900/50 pt-6">
                <div className="bg-[#0a192f] p-4 rounded-2xl">
                  <div className="text-xs text-slate-400 uppercase tracking-widest">สแกนสำเร็จ</div>
                  <div className="text-2xl font-black mt-1">
                    {scannedItems} <span className="text-sm font-normal text-slate-500">ชิ้น</span>
                  </div>
                </div>

                <div className="bg-[#0a192f] p-4 rounded-2xl">
                  <div className="text-xs text-slate-400 uppercase tracking-widest">เวลาที่ใช้</div>
                  <div className="text-2xl font-black mt-1">
                    {formatTime(timeUsed)} <span className="text-sm font-normal text-slate-500">นาที</span>
                  </div>
                </div>
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
