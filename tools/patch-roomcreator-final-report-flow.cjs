/*
  Patch RoomCreator.jsx เพื่อแก้ flow รายงานผล
  - ปุ่มจบเกมฝั่งครูจะจบได้เมื่อผู้เล่นทุกคนสแกนครบเท่านั้น
  - เมื่อจบเกม จะ mark ห้องและผู้เล่นเป็นข้อมูลรายงานจริง (reportReady/includeInReport)
  - ปุ่มเริ่มใหม่/Reset จะไม่ลบห้องที่จบแล้ว เพื่อไม่ให้รายงานหาย
*/
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src', 'components', 'RoomCreator.jsx');
if (!fs.existsSync(filePath)) {
  console.error('ไม่พบไฟล์ src/components/RoomCreator.jsx กรุณารันคำสั่งนี้ที่ root project');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf8');
const backupPath = `${filePath}.bak_final_report_${Date.now()}`;
fs.writeFileSync(backupPath, code, 'utf8');
let changed = false;

function replace(search, replacement, label) {
  if (code.includes(search)) {
    code = code.replace(search, replacement);
    changed = true;
    return true;
  }
  console.warn(`เตือน: ไม่พบตำแหน่ง ${label}`);
  return false;
}

// 1) เพิ่ม writeBatch ใน import firestore
if (!/writeBatch/.test(code)) {
  code = code.replace(/serverTimestamp,\s*\n\s*setDoc,\s*\n\s*updateDoc,/, 'serverTimestamp,\n  setDoc,\n  updateDoc,\n  writeBatch,');
  changed = true;
}

// 2) เพิ่ม helper ถ้ายังไม่มี
if (!code.includes('const clampTargetItems =')) {
  const helper = `
const clampTargetItems = (value, fallback = 5) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(10, Math.max(5, Math.round(parsed)));
};

const getPlayerScannedCount = (player) =>
  Number(
    player?.itemsScanned ??
      player?.scannedItems ??
      player?.scanCount ??
      player?.scannedBarcodes?.length ??
      0,
  );

const isPlayerCompletedTarget = (player, targetItems) =>
  player?.missionCompleted === true || getPlayerScannedCount(player) >= targetItems;
`;
  const anchor = code.includes('const toMillis =') ? 'const toMillis =' : 'export default function RoomCreator()';
  if (anchor === 'const toMillis =') {
    code = code.replace('const toMillis =', `${helper}\nconst toMillis =`);
  } else {
    code = code.replace('export default function RoomCreator()', `${helper}\nexport default function RoomCreator()`);
  }
  changed = true;
}

// 3) เพิ่ม derived state ภายใน component ถ้ายังไม่มี
if (!code.includes('const canTeacherFinishGame =')) {
  const stateRegex = /const \[roomData, setRoomData\] = useState\(null\);|const \[players, setPlayers\] = useState\(\[\]\);/;
  const match = code.match(stateRegex);
  if (match) {
    const insertAfter = match[0];
    const derived = `

  const targetItems = clampTargetItems(roomData?.itemLimit || settings.itemLimit || 5);
  const completedPlayerCount = players.filter((player) => isPlayerCompletedTarget(player, targetItems)).length;
  const incompletePlayerCount = Math.max(0, players.length - completedPlayerCount);
  const canTeacherFinishGame = roomState === 'playing' && players.length > 0 && incompletePlayerCount === 0;`;
    code = code.replace(insertAfter, `${insertAfter}${derived}`);
    changed = true;
  } else {
    console.warn('เตือน: ไม่พบตำแหน่ง state players/roomData สำหรับเพิ่ม canTeacherFinishGame');
  }
}

// 4) ให้ itemLimit ที่สร้างห้อง clamp 5-10
code = code.replace(/itemLimit:\s*Number\(settings\.itemLimit \|\| 5\)/g, 'itemLimit: clampTargetItems(settings.itemLimit)');
code = code.replace(/setSettings\(\{\.\.\.settings, itemLimit: Number\(e\.target\.value\)\}\)/g, 'setSettings({...settings, itemLimit: clampTargetItems(e.target.value)})');

// 5) เพิ่มฟังก์ชัน finalizeRoomForReport ก่อน handleFinishGame
if (!code.includes('const finalizeRoomForReport = async')) {
  const fn = `

  const finalizeRoomForReport = async (reason = 'time_expired') => {
    if (!roomCode) return;

    const roomRef = doc(db, 'rooms', roomCode);
    const batch = writeBatch(db);
    const finishedElapsedSeconds = getRoomElapsedSeconds(roomData);

    players.forEach((player) => {
      const playerRef = doc(db, 'rooms', roomCode, 'players', player.id);
      batch.set(
        playerRef,
        {
          includeInReport: true,
          isFinal: true,
          reportReady: true,
          lifecycleStatus: 'finished_summary_saved',
          targetItems,
          missionCompleted: isPlayerCompletedTarget(player, targetItems),
          finishedAt: serverTimestamp(),
          finalizedAt: serverTimestamp(),
          finishedReason: reason,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });

    batch.set(
      roomRef,
      {
        status: 'finished',
        reportReady: true,
        includeInReport: true,
        finishedAt: serverTimestamp(),
        reportFinalizedAt: serverTimestamp(),
        finishedElapsedSeconds,
        finishedReason: reason,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await batch.commit();
  };`;
  const idx = code.indexOf('const handleFinishGame');
  if (idx >= 0) {
    code = code.slice(0, idx) + fn + '\n\n  ' + code.slice(idx);
    changed = true;
  } else {
    console.warn('เตือน: ไม่พบ handleFinishGame สำหรับแทรก finalizeRoomForReport');
  }
}

// 6) แทนที่ handleFinishGame ให้ใช้ finalizeRoomForReport
const finishRegex = /const handleFinishGame = async \([^)]*\) => \{[\s\S]*?\n  \};/;
if (finishRegex.test(code) && !code.includes("await finalizeRoomForReport(reason);")) {
  code = code.replace(finishRegex, `const handleFinishGame = async (reason = 'time_expired') => {
    if (!roomCode) return;

    setRoomState('finished');
    await finalizeRoomForReport(reason);
  };`);
  changed = true;
}

// 7) เพิ่ม/แก้ handleTeacherFinishGame
if (!code.includes('const handleTeacherFinishGame = async')) {
  const handler = `

  const handleTeacherFinishGame = async () => {
    if (!canTeacherFinishGame) {
      alert(` + '`ยังจบเกมไม่ได้ครับ ต้องรอให้ผู้เล่นทุกคนสแกนครบ ${targetItems} ชิ้น หรือรอเวลาหมดตามกติกาห้อง`' + `);
      return;
    }

    if (!window.confirm('ผู้เล่นทุกคนสแกนครบแล้ว ต้องการจบเกมและบันทึกรายงานทันทีหรือไม่?')) return;
    await handleFinishGame('teacher_all_completed');
  };`;
  const idx = code.indexOf('const handleReset');
  if (idx >= 0) {
    code = code.slice(0, idx) + handler + '\n\n  ' + code.slice(idx);
    changed = true;
  }
}

// 8) แก้ handleReset ไม่ให้ลบห้องที่จบแล้ว/พร้อมรายงาน
const resetRegex = /const handleReset = async \(\) => \{[\s\S]*?\n  \};/;
if (resetRegex.test(code) && !code.includes('preserveFinishedRoomForReport')) {
  code = code.replace(resetRegex, `const handleReset = async () => {
    const preserveFinishedRoomForReport = roomData?.reportReady === true || roomData?.status === 'finished';

    if (roomCode && !preserveFinishedRoomForReport) {
      const shouldDeleteDraft = window.confirm('ห้องนี้ยังไม่จบเกม ต้องการลบห้องทดสอบนี้หรือไม่? ถ้าไม่ลบ ห้องจะยังไม่เข้ารายงานจนกว่าจะจบเกม');
      if (shouldDeleteDraft) await deleteDoc(doc(db, 'rooms', roomCode));
    }

    finishRequested.current = false;
    setRoomState('setup');
    setRoomCode('');
    setRoomData(null);
    setTimeLeft(0);
    setPlayers([]);
    stopAllMusic();
  };`);
  changed = true;
}

// 9) ถ้ายังไม่มีปุ่มจบเกมทันที ให้แทรกข้างปุ่ม Pause
if (!code.includes('จบเกมทันที')) {
  const pauseButtonRegex = /<button\s+onClick=\{handlePauseGame\}[\s\S]*?<\/button>/m;
  const m = code.match(pauseButtonRegex);
  if (m) {
    const replacement = `<div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                 ${m[0]}
                 <button
                   onClick={handleTeacherFinishGame}
                   disabled={!canTeacherFinishGame}
                   className={\`font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest transition-all \${canTeacherFinishGame ? 'bg-emerald-500 text-slate-900 active:scale-95 shadow-[0_0_24px_rgba(16,185,129,0.35)]' : 'bg-slate-700/70 text-slate-400 cursor-not-allowed border border-slate-600'}\`}
                   title={canTeacherFinishGame ? 'ผู้เล่นทุกคนสแกนครบแล้ว สามารถจบเกมได้' : 'ต้องรอให้ผู้เล่นทุกคนสแกนครบก่อน หรือรอเวลาหมด'}
                 >
                   <Trophy className={canTeacherFinishGame ? 'fill-slate-900' : ''} /> จบเกมทันที
                 </button>
               </div>`;
    code = code.replace(m[0], replacement);
    changed = true;
  } else {
    console.warn('เตือน: ไม่พบปุ่มหยุดชั่วคราวสำหรับแทรกปุ่มจบเกม');
  }
}

fs.writeFileSync(filePath, code, 'utf8');
console.log(changed ? 'ปรับ RoomCreator.jsx สำเร็จ' : 'ไม่พบจุดที่ต้องปรับ หรือไฟล์ถูกปรับแล้ว');
console.log(`สำรองไฟล์เดิมไว้ที่: ${backupPath}`);
