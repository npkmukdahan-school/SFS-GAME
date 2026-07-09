/*
  Patch RoomCreator.jsx
  - จำกัดจำนวนไอเทมเป้าหมาย 5-10 ชิ้น
  - เพิ่มปุ่ม "จบเกม" ฝั่งครู/ผู้สร้างห้อง
  - ปุ่มจบเกมจะกดได้เฉพาะเมื่อผู้เล่นทุกคนในห้องสแกนครบตามจำนวนไอเทมเป้าหมาย
*/
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src', 'components', 'RoomCreator.jsx');
if (!fs.existsSync(filePath)) {
  console.error('ไม่พบไฟล์ src/components/RoomCreator.jsx กรุณารันคำสั่งนี้ที่ root project');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf8');
let changed = false;

const backupPath = `${filePath}.bak_teacher_finish_${Date.now()}`;
fs.writeFileSync(backupPath, code, 'utf8');

function replaceOnce(search, replacement, warning) {
  if (code.includes(search)) {
    code = code.replace(search, replacement);
    changed = true;
    return true;
  }
  console.warn(`เตือน: ${warning}`);
  return false;
}

// 1) เพิ่ม helper functions หลัง constant/logo แรก ๆ
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

  const constMatch = code.match(/const\s+[A-Z0-9_]+_LOGO_URL\s*=\s*['"][^'"]+['"];?/);
  if (constMatch) {
    code = code.replace(constMatch[0], `${constMatch[0]}\n${helper}`);
    changed = true;
  } else {
    code = code.replace(/import[\s\S]*?from 'firebase\/firestore';\n/, (m) => `${m}\n${helper}\n`);
    changed = true;
  }
}

// 2) เพิ่ม roomData state ถ้ายังไม่มี เพื่ออ่าน itemLimit ของห้องได้
if (!code.includes('const [roomData, setRoomData]')) {
  const statePattern = /const \[players, setPlayers\] = useState\(\[\]\);/;
  if (statePattern.test(code)) {
    code = code.replace(statePattern, (m) => `${m}\n  const [roomData, setRoomData] = useState(null);`);
    changed = true;
  } else {
    console.warn('เตือน: ไม่พบตำแหน่ง state players สำหรับเพิ่ม roomData');
  }
}

// 3) เพิ่ม listener ห้องเพื่อ sync status/itemLimit ถ้ายังไม่มี setRoomData(data)
if (!code.includes('setRoomData(data);')) {
  const listenerNeedle = `if (!roomCode) return;`;
  const roomListener = `if (!roomCode) return;

    const roomRef = doc(db, "rooms", roomCode);
    const unsubscribeRoom = onSnapshot(roomRef, (roomSnap) => {
      if (!roomSnap.exists()) return;
      const data = roomSnap.data();
      setRoomData(data);
      if (data.status) setRoomState(data.status);
      if (data.timeLimit || data.itemLimit) {
        setSettings((prev) => ({
          ...prev,
          timeLimit: Number(data.timeLimit || prev.timeLimit || 3),
          itemLimit: clampTargetItems(data.itemLimit || prev.itemLimit || 5),
        }));
      }
    });`;
  if (code.includes(listenerNeedle)) {
    code = code.replace(listenerNeedle, roomListener);
    changed = true;
  } else {
    console.warn('เตือน: ไม่พบตำแหน่งเพิ่ม room listener');
  }

  // เพิ่ม unsubscribeRoom ใน return เดิม
  code = code.replace(/return \(\) => unsubscribe\(\);/g, 'return () => {\n      unsubscribeRoom?.();\n      unsubscribe();\n    };');
  code = code.replace(/return \(\) => \{\s*unsubscribeRoom\?\.\(\);\s*unsubscribe\(\);\s*\};/g, 'return () => {\n      unsubscribeRoom?.();\n      unsubscribe();\n    };');
}

// 4) เพิ่ม derived state สำหรับเงื่อนไขปุ่มจบเกม
if (!code.includes('const canTeacherFinishGame =')) {
  const insertionPoint = /const \[players, setPlayers\] = useState\(\[\]\);(?:\n\s*const \[roomData, setRoomData\] = useState\(null\);)?/;
  const derived = `

  const targetItems = clampTargetItems(roomData?.itemLimit || settings.itemLimit || 5);
  const completedPlayerCount = players.filter((player) => isPlayerCompletedTarget(player, targetItems)).length;
  const incompletePlayerCount = Math.max(0, players.length - completedPlayerCount);
  const canTeacherFinishGame = roomState === 'playing' && players.length > 0 && incompletePlayerCount === 0;
`;
  if (insertionPoint.test(code)) {
    code = code.replace(insertionPoint, (m) => `${m}${derived}`);
    changed = true;
  } else {
    console.warn('เตือน: ไม่พบตำแหน่งเพิ่มตัวแปร canTeacherFinishGame');
  }
}

// 5) จำกัด settings.itemLimit ใน UI/state
code = code.replace(/setSettings\(\{\.\.\.settings, itemLimit: Number\(e\.target\.value\)\}\)/g, 'setSettings({...settings, itemLimit: clampTargetItems(e.target.value)})');
code = code.replace(/itemLimit:\s*settings\.itemLimit/g, 'itemLimit: clampTargetItems(settings.itemLimit)');
code = code.replace(/Number\(settings\.itemLimit \|\| 5\)/g, 'clampTargetItems(settings.itemLimit)');

// 6) เพิ่ม handler ปุ่มจบเกมแบบมีเงื่อนไข ไม่กระทบ handleFinishGame ที่ใช้ตอนหมดเวลา
if (!code.includes('const handleTeacherFinishGame')) {
  const handler = `

  const handleTeacherFinishGame = async () => {
    if (!canTeacherFinishGame) {
      alert(` + '`ยังจบเกมไม่ได้ครับ ต้องรอให้ผู้เล่นทุกคนสแกนครบ ${targetItems} ชิ้น หรือรอเวลาหมดตามกติกาห้อง`' + `);
      return;
    }

    if (!window.confirm('ผู้เล่นทุกคนสแกนครบแล้ว ต้องการจบเกมและสรุปผลทันทีหรือไม่?')) return;

    await handleFinishGame('all_players_completed');
  };`;

  const finishFuncPattern = /(const handleFinishGame = async \([^)]*\) => \{[\s\S]*?\n  \};)/;
  const m = code.match(finishFuncPattern);
  if (m) {
    code = code.replace(m[1], `${m[1]}${handler}`);
    changed = true;
  } else {
    console.warn('เตือน: ไม่พบ handleFinishGame สำหรับเพิ่ม handleTeacherFinishGame');
  }
}

// 7) ให้ handleFinishGame รองรับ reason และ updatedAt ถ้าทำได้
code = code.replace(/const handleFinishGame = async \(\) => \{/g, "const handleFinishGame = async (reason = 'time_expired') => {");
code = code.replace(/\{ status: 'finished' \}/g, "{ status: 'finished', finishedReason: reason, updatedAt: new Date() }");

// 8) แทรกปุ่มจบเกมข้างปุ่มหยุดชั่วคราว ถ้ายังไม่มี
if (!code.includes('จบเกมทันที')) {
  const pauseButtonRegex = /<button\s+onClick=\{handlePauseGame\}[\s\S]*?<\/button>/m;
  const pauseButtonMatch = code.match(pauseButtonRegex);
  if (pauseButtonMatch) {
    const oldButton = pauseButtonMatch[0];
    const replacement = `<div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                 ${oldButton}
                 <button
                   onClick={handleTeacherFinishGame}
                   disabled={!canTeacherFinishGame}
                   className={\`font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest transition-all \${canTeacherFinishGame ? 'bg-emerald-500 text-slate-900 active:scale-95 shadow-[0_0_24px_rgba(16,185,129,0.35)]' : 'bg-slate-700/70 text-slate-400 cursor-not-allowed border border-slate-600'}\`}
                   title={canTeacherFinishGame ? 'ผู้เล่นทุกคนสแกนครบแล้ว สามารถจบเกมได้' : 'ต้องรอให้ผู้เล่นทุกคนสแกนครบก่อน หรือรอเวลาหมด'}
                 >
                   <Trophy className={canTeacherFinishGame ? 'fill-slate-900' : ''} /> จบเกมทันที
                 </button>
               </div>`;
    code = code.replace(oldButton, replacement);
    changed = true;
  } else {
    console.warn('เตือน: ไม่พบปุ่มหยุดชั่วคราวสำหรับแทรกปุ่มจบเกม');
  }
}

// 9) แทรกกล่องสถานะสแกนครบ ถ้ายังไม่มี
if (!code.includes('สถานะการสแกนครบของห้อง')) {
  const statusPanel = `

            <div className="mb-6 rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-5 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-xs font-black text-emerald-200 uppercase tracking-[0.25em] mb-1">สถานะการสแกนครบของห้อง</div>
                  <div className="text-2xl font-black text-white">
                    สแกนครบแล้ว {completedPlayerCount}/{players.length} คน
                    <span className="ml-2 text-sm font-bold text-slate-400">เป้าหมาย {targetItems} ชิ้น/คน</span>
                  </div>
                  <div className="mt-2 text-sm font-bold text-slate-300">
                    {canTeacherFinishGame
                      ? 'ผู้เล่นทุกคนสแกนครบแล้ว ครูสามารถกดจบเกมเพื่อสรุปผลทันทีได้'
                      : 'ยังมีผู้เล่น ' + incompletePlayerCount + ' คนที่สแกนไม่ครบ ปุ่มจบเกมจะยังใช้งานไม่ได้'}
                  </div>
                </div>
                <div className={\`rounded-2xl px-5 py-3 text-center font-black \${canTeacherFinishGame ? 'bg-emerald-400 text-slate-900' : 'bg-slate-800 text-slate-300 border border-slate-600'}\`}>
                  {canTeacherFinishGame ? 'พร้อมจบเกม' : 'รอให้ครบทุกคน'}
                </div>
              </div>
            </div>`;

  const tablePanelMarker = `<div className="bg-[#112240]/80 backdrop-blur-xl border border-blue-500/30 rounded-[2rem] overflow-hidden shadow-2xl">`;
  if (code.includes(tablePanelMarker)) {
    code = code.replace(tablePanelMarker, `${statusPanel}\n\n            ${tablePanelMarker}`);
    changed = true;
  } else {
    console.warn('เตือน: ไม่พบตำแหน่งแทรกกล่องสถานะสแกนครบ');
  }
}

// 10) เพิ่มคอลัมน์/ข้อความจำนวนสแกนใน leaderboard แบบไม่บังคับ ถ้าเจอหัวคะแนนรวม
if (!code.includes('สแกน/เป้าหมาย') && code.includes('คะแนนรวม')) {
  code = code.replace(/<th className="pb-2 px-4 font-black text-right">คะแนนรวม<\/th>/, '<th className="pb-2 px-4 font-black text-center">สแกน/เป้าหมาย</th>\n                       <th className="pb-2 px-4 font-black text-right">คะแนนรวม</th>');
  code = code.replace(/<td className="p-4 rounded-r-xl font-black text-2xl text-cyan-400 text-right drop-shadow-\[0_0_8px_rgba\(6,182,212,0\.5\)\]">/,
    '<td className="p-4 text-center font-black text-lg text-emerald-300">\n                           {getPlayerScannedCount(p)}/{targetItems}\n                         </td>\n                         <td className="p-4 rounded-r-xl font-black text-2xl text-cyan-400 text-right drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">');
}

if (!changed) {
  console.log('ไม่พบจุดที่ต้องปรับ หรือไฟล์อาจถูกปรับไปแล้ว');
} else {
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('ปรับ RoomCreator.jsx สำเร็จ');
  console.log(`สำรองไฟล์เดิมไว้ที่: ${backupPath}`);
}
