/*
  Fix RoomCreator.jsx runtime error:
  isPlayerCompletedTarget is not defined

  Usage:
    node tools/fix-roomcreator-player-complete-helper.cjs
*/
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src', 'components', 'RoomCreator.jsx');

if (!fs.existsSync(filePath)) {
  console.error('ไม่พบไฟล์ src/components/RoomCreator.jsx กรุณารันคำสั่งนี้ที่ root project ของโปรเจกต์');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf8');
const backupPath = `${filePath}.bak_missing_helper_${Date.now()}`;
fs.writeFileSync(backupPath, code, 'utf8');

const helperBlock = `
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

const needClamp = !code.includes('const clampTargetItems =');
const needCount = !code.includes('const getPlayerScannedCount =');
const needComplete = !code.includes('const isPlayerCompletedTarget =');

if (!needClamp && !needCount && !needComplete) {
  console.log('RoomCreator.jsx มี helper ครบอยู่แล้ว ไม่ต้องแก้เพิ่ม');
  process.exit(0);
}

// ถ้าขาดบางตัว ให้เพิ่มทั้งชุดในตำแหน่งปลอดภัย: หลัง import ทั้งหมด ก่อน const/export แรก
let insertIndex = -1;
const importRegex = /^import[\s\S]*?;\s*$/gm;
let match;
while ((match = importRegex.exec(code)) !== null) {
  insertIndex = match.index + match[0].length;
}

if (insertIndex === -1) {
  // fallback: วางก่อน export default function RoomCreator
  const marker = 'export default function RoomCreator';
  insertIndex = code.indexOf(marker);
}

if (insertIndex === -1) {
  console.error('ไม่พบตำแหน่งปลอดภัยสำหรับแทรก helper กรุณาส่งไฟล์ RoomCreator.jsx ล่าสุดมาให้ตรวจ');
  process.exit(1);
}

// ป้องกันกรณีมีบาง helper อยู่แล้ว: ลบชุดเดิมที่อาจไม่ครบออกแบบระมัดระวังไม่ได้ทำ เพื่อไม่กระทบโค้ด
// เพิ่มชื่อ helper เฉพาะตัวที่ขาดเท่านั้น
let missingHelperBlock = '';
if (needClamp) {
  missingHelperBlock += `
const clampTargetItems = (value, fallback = 5) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(10, Math.max(5, Math.round(parsed)));
};
`;
}
if (needCount) {
  missingHelperBlock += `
const getPlayerScannedCount = (player) =>
  Number(
    player?.itemsScanned ??
      player?.scannedItems ??
      player?.scanCount ??
      player?.scannedBarcodes?.length ??
      0,
  );
`;
}
if (needComplete) {
  missingHelperBlock += `
const isPlayerCompletedTarget = (player, targetItems) =>
  player?.missionCompleted === true || getPlayerScannedCount(player) >= targetItems;
`;
}

code = `${code.slice(0, insertIndex)}\n${missingHelperBlock}\n${code.slice(insertIndex)}`;
fs.writeFileSync(filePath, code, 'utf8');

console.log('แก้ RoomCreator.jsx สำเร็จ: เพิ่ม helper ที่ขาดสำหรับปุ่มจบเกมฝั่งครู');
console.log(`สำรองไฟล์เดิมไว้ที่: ${backupPath}`);
