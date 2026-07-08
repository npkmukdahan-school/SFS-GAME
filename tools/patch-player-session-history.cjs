#!/usr/bin/env node
/**
 * Patch SFS-GAME GameMain.jsx so every room join creates a unique player session.
 * Usage: node tools/patch-player-session-history.cjs
 */
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const target = path.join(projectRoot, 'src', 'components', 'GameMain.jsx');

if (!fs.existsSync(target)) {
  console.error('ไม่พบไฟล์ src/components/GameMain.jsx กรุณารันคำสั่งจาก root โปรเจกต์ sfs-game');
  process.exit(1);
}

let code = fs.readFileSync(target, 'utf8');
let changed = false;

function apply(label, fn) {
  const before = code;
  code = fn(code);
  if (code !== before) {
    changed = true;
    console.log('✓', label);
  } else {
    console.log('-', label, '(ข้าม: อาจแก้ไว้แล้ว หรือหา pattern ไม่เจอ)');
  }
}

function ensureAfter(label, anchor, insertText) {
  apply(label, (src) => {
    if (src.includes(insertText.trim().split('\n')[0])) return src;
    const idx = src.indexOf(anchor);
    if (idx === -1) return src;
    const insertAt = idx + anchor.length;
    return src.slice(0, insertAt) + insertText + src.slice(insertAt);
  });
}

function ensureBefore(label, anchor, insertText) {
  apply(label, (src) => {
    if (src.includes(insertText.trim().split('\n')[0])) return src;
    const idx = src.indexOf(anchor);
    if (idx === -1) return src;
    return src.slice(0, idx) + insertText + src.slice(idx);
  });
}

function replaceOrFail(label, regex, replacement) {
  const before = code;
  code = code.replace(regex, replacement);
  if (code === before) {
    console.error(`\nไม่สามารถแก้ส่วน: ${label}`);
    console.error('กรุณาส่งไฟล์ src/components/GameMain.jsx ปัจจุบันมาให้ตรวจ หรือแก้ด้วยมือจาก README');
    process.exit(1);
  }
  changed = true;
  console.log('✓', label);
}

// 1) Add unique session helper after safeDocId.
ensureAfter(
  'เพิ่ม helper createPlayerSessionId',
  "const safeDocId = (value) =>\n  String(value || 'player')\n    .trim()\n    .replace(/[.#$/[\\]]/g, '_')\n    .replace(/\\s+/g, '_')\n    .slice(0, 80) || `player_${Date.now()}`;",
  `\n\nconst createPlayerSessionId = (name) => {\n  const cleanName = safeDocId(name || 'player');\n  const timePart = Date.now().toString(36);\n  const randomPart = Math.random().toString(36).slice(2, 8);\n\n  return \`${'${cleanName}'}_${'${timePart}'}_${'${randomPart}'}\`.slice(0, 120);\n};`
);

// Fallback if exact helper anchor differs but safeDocId exists.
if (!code.includes('const createPlayerSessionId = (name) =>')) {
  apply('เพิ่ม helper createPlayerSessionId แบบ fallback', (src) => {
    const marker = /const normalizeFoodDoc = \(rawFood, barcode\) => \{/;
    if (!marker.test(src)) return src;
    return src.replace(marker, `const createPlayerSessionId = (name) => {\n  const cleanName = safeDocId(name || 'player');\n  const timePart = Date.now().toString(36);\n  const randomPart = Math.random().toString(36).slice(2, 8);\n\n  return \`${'${cleanName}'}_${'${timePart}'}_${'${randomPart}'}\`.slice(0, 120);\n};\n\nconst normalizeFoodDoc = (rawFood, barcode) => {`);
  });
}

// 2) Add refs to avoid repeated lifecycle writes.
ensureAfter(
  'เพิ่ม refs สำหรับสถานะ session',
  "const [roomData, setRoomData] = useState(null);",
  `\n\n  const playerSessionStartedRef = useRef(false);\n  const playerSessionFinishedRef = useRef(false);`
);

// 3) Add status updater function before saveScanToFirebase.
ensureBefore(
  'เพิ่มฟังก์ชัน markPlayerSessionStatus',
  "  async function saveScanToFirebase({",
  `  async function markPlayerSessionStatus(status, extra = {}) {\n    if (!roomCode || !playerId) return;\n\n    try {\n      await setDoc(\n        doc(db, 'rooms', roomCode, 'players', playerId),\n        {\n          sessionId: playerId,\n          roomCode,\n          name: playerInfo.name.trim(),\n          playerKey: safeDocId(playerInfo.name),\n          avatar: playerInfo.avatar?.icon || '',\n          avatarId: playerInfo.avatar?.id || '',\n          avatarName: playerInfo.avatar?.name || '',\n          status,\n          updatedAt: serverTimestamp(),\n          ...extra,\n        },\n        { merge: true },\n      );\n    } catch (err) {\n      console.warn('markPlayerSessionStatus error:', err);\n    }\n  }\n\n`
);

// 4) Add lifecycle useEffect before saveScanToFirebase if not present.
ensureBefore(
  'เพิ่ม effect บันทึกเริ่มเล่นและจบเกม',
  "  async function saveScanToFirebase({",
  `  useEffect(() => {\n    if (step === 'playing' && playerId && !playerSessionStartedRef.current) {\n      playerSessionStartedRef.current = true;\n      markPlayerSessionStatus('playing', {\n        startedPlayingAt: serverTimestamp(),\n      });\n    }\n  }, [step, playerId]);\n\n  useEffect(() => {\n    if (step === 'summary' && playerId && !playerSessionFinishedRef.current) {\n      playerSessionFinishedRef.current = true;\n      markPlayerSessionStatus('finished', {\n        finishedAt: serverTimestamp(),\n        finalScore: Number(Number(score || 0).toFixed(3)),\n        finalAverageScore: scannedItems > 0 ? Number((scoreSum / scannedItems).toFixed(3)) : 0,\n        finalScoreSum: Number(Number(scoreSum || 0).toFixed(3)),\n        finalSpeedBonus: Number(Number(speedBonus || 0).toFixed(3)),\n        finalItemsScanned: Number(scannedItems || 0),\n        totalTimeUsedSeconds: Number(timeUsed || 0),\n      });\n    }\n  }, [step, playerId, score, scoreSum, speedBonus, scannedItems, timeUsed]);\n\n`
);

// Remove accidental duplicated placement if exact insert not desired. If hooks inserted inside function body before saveScan, OK because still before function declarations and after other hooks? Hooks must be top-level in component, before nested functions allowed; safe.

// 5) Replace nextPlayerId generation.
apply('เปลี่ยน playerId จากชื่อซ้ำ เป็น sessionId ไม่ซ้ำ', (src) =>
  src.replace(/const nextPlayerId = safeDocId\(playerInfo\.name\);/g, 'const nextPlayerId = createPlayerSessionId(playerInfo.name);')
);

// 6) Reset lifecycle refs after creating id.
ensureAfter(
  'รีเซ็ตสถานะ session เมื่อผู้เล่นเข้ารอบใหม่',
  "const nextPlayerId = createPlayerSessionId(playerInfo.name);",
  `\n    playerSessionStartedRef.current = false;\n    playerSessionFinishedRef.current = false;`
);

// 7) Replace initial player session document in handleStartWait.
replaceOrFail(
  'ปรับข้อมูลที่บันทึกตอนเข้าร่วมห้อง',
  /await setDoc\(doc\(db, ['"]rooms['"], roomCode, ['"]players['"], nextPlayerId\), \{[\s\S]*?\n\s{4}\}\);\n\n\s{4}setStep\(['"]waiting['"]\);/,
  `await setDoc(doc(db, 'rooms', roomCode, 'players', nextPlayerId), {\n      sessionId: nextPlayerId,\n      roomCode,\n      name: playerInfo.name.trim(),\n      playerKey: safeDocId(playerInfo.name),\n      avatar: playerInfo.avatar.icon,\n      avatarId: playerInfo.avatar.id || '',\n      avatarName: playerInfo.avatar.name || '',\n      score: 0,\n      scoreSum: 0,\n      averageScore: 0,\n      speedBonus: 0,\n      itemsScanned: 0,\n      status: 'waiting',\n      lastBarcode: '',\n      lastFoodName: '',\n      joinedAt: serverTimestamp(),\n      startedPlayingAt: null,\n      finishedAt: null,\n      updatedAt: serverTimestamp(),\n    });\n\n    setStep('waiting');`
);

// 8) Enhance player scan update data.
apply('เพิ่ม metadata session ใน players ตอนสแกน', (src) => {
  if (src.includes('lastScanAt: serverTimestamp()')) return src;
  return src.replace(
    /lastFoodName: food\.name,\n\s*updatedAt: serverTimestamp\(\),/,
    `lastFoodName: food.name,\n        status: 'playing',\n        roomCode: currentRoomCode,\n        sessionId: playerDocId,\n        playerKey: safeDocId(playerName),\n        lastScanAt: serverTimestamp(),\n        updatedAt: serverTimestamp(),`
  );
});

// 9) Enhance scans collection records.
apply('เพิ่ม metadata session ใน scans', (src) => {
  if (src.includes('scoreAfterScan: Number(finalScoreToSave.toFixed(3))')) return src;
  return src.replace(
    /playerName,\n\s*barcode: food\.barcode,/,
    `playerName,\n      sessionId: playerDocId,\n      playerKey: safeDocId(playerName),\n      roomCode: currentRoomCode,\n      scanOrder: newItemsCount,\n      scoreAfterScan: Number(finalScoreToSave.toFixed(3)),\n      barcode: food.barcode,`
  );
});

// 10) Improve scan hint text if still barcode.
apply('ปรับข้อความ hint ให้สอดคล้องกับ QR Code', (src) =>
  src
    .replace(/จัดบาร์โค้ดให้อยู่ในกรอบแนวนอน\.\.\./g, 'จัด QR Code ให้อยู่ในกรอบสแกน...')
    .replace(/จัดบาร์โค้ดให้อยู่ในกรอบแนวนอน\./g, 'จัด QR Code ให้อยู่ในกรอบสแกน.')
    .replace(/เล็งบาร์โค้ดให้เต็มกรอบแนวนอน/g, 'เล็ง QR Code ให้อยู่กลางกรอบ')
    .replace(/ถ้าอ่านไม่ติด ให้ซูมเข้าเล็กน้อย/g, 'ถ้าอ่านไม่ติด ให้ขยับมือถือเข้าใกล้ QR Code')
    .replace(/บาร์โค้ดเอียงเล็กน้อยอ่านได้ แต่ไม่ควรเบลอ/g, 'ถือกล้องให้นิ่ง และให้ QR Code ไม่เบลอ')
);

if (!changed) {
  console.log('\nไม่พบการเปลี่ยนแปลง อาจเคย patch แล้ว');
} else {
  const backup = `${target}.backup-${Date.now()}`;
  fs.copyFileSync(target, backup);
  fs.writeFileSync(target, code, 'utf8');
  console.log(`\nสำเร็จ: แก้ src/components/GameMain.jsx แล้ว`);
  console.log(`สำรองไฟล์เดิมไว้ที่: ${path.relative(projectRoot, backup)}`);
}
