const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src', 'components', 'RoomCreator.jsx');

if (!fs.existsSync(filePath)) {
  console.error('ไม่พบไฟล์ src/components/RoomCreator.jsx กรุณารันคำสั่งนี้ที่ root project');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf8');
const original = code;

const helper = `
const MIN_TARGET_ITEMS = 5;
const MAX_TARGET_ITEMS = 10;

const clampTargetItems = (value, fallback = MIN_TARGET_ITEMS) => {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) && numericValue > 0 ? numericValue : Number(fallback || MIN_TARGET_ITEMS);
  return Math.min(MAX_TARGET_ITEMS, Math.max(MIN_TARGET_ITEMS, Math.round(safeValue)));
};
`;

if (!code.includes('const MIN_TARGET_ITEMS = 5;')) {
  if (code.includes("const FDA_JUNIOR_LOGO_URL")) {
    code = code.replace(/(const FDA_JUNIOR_LOGO_URL[^\n]+;\n)/, `$1${helper}`);
  } else {
    code = code.replace(/(import[\s\S]*?from ['\"]firebase\/firestore['\"];\n)/, `$1${helper}`);
  }
}

// ให้ state เริ่มต้นอยู่ในกรอบ 5-10
code = code.replace(
  /useState\(\{\s*timeLimit:\s*3,\s*itemLimit:\s*[^}]+\}\)/,
  'useState({ timeLimit: 3, itemLimit: 5 })',
);

// ถ้ามีฟังก์ชัน handleCreateRoom ให้ประกาศ itemLimit ที่ clamp แล้วไว้ใช้บันทึก
if (!code.includes('const itemLimit = clampTargetItems(settings.itemLimit);')) {
  code = code.replace(
    /(const handleCreateRoom\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?const [^\n]*timeLimitSeconds[^\n]*;\n)/,
    `$1    const itemLimit = clampTargetItems(settings.itemLimit);\n`,
  );
}

// รองรับโค้ดสร้างห้องหลายเวอร์ชัน
code = code
  .replace(/itemLimit:\s*Number\(settings\.itemLimit\s*\|\|\s*5\)/g, 'itemLimit')
  .replace(/itemLimit:\s*settings\.itemLimit/g, 'itemLimit')
  .replace(/targetItems:\s*Number\(settings\.itemLimit\s*\|\|\s*5\)/g, 'targetItems: itemLimit')
  .replace(/targetItems:\s*settings\.itemLimit/g, 'targetItems: itemLimit')
  .replace(/foodLimit:\s*Number\(settings\.itemLimit\s*\|\|\s*5\)/g, 'foodLimit: itemLimit')
  .replace(/foodLimit:\s*settings\.itemLimit/g, 'foodLimit: itemLimit');

// ปรับ range ให้จำกัด 5-10 เสมอ
code = code.replace(/min=\"?\d+\"?\s+max=\"?\d+\"?\s+step=\"?1\"?/g, 'min="5" max="10" step="1"');
code = code.replace(/onChange=\{\(e\) => setSettings\(\{\.\.\.settings, itemLimit: Number\(e\.target\.value\)\}\)\}/g, 'onChange={(e) => setSettings({ ...settings, itemLimit: clampTargetItems(e.target.value) })}');
code = code.replace(/onChange=\{\(e\) => setSettings\(\{\.\.\.settings, itemLimit: \+e\.target\.value\}\)\}/g, 'onChange={(e) => setSettings({ ...settings, itemLimit: clampTargetItems(e.target.value) })}');

if (code === original) {
  console.log('ไม่พบตำแหน่งที่ต้องแก้ หรือไฟล์ถูกปรับแล้ว');
} else {
  const backupPath = `${filePath}.before-item-limit-5-10.bak`;
  if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, original, 'utf8');
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('ปรับ RoomCreator.jsx ให้จำกัดจำนวนไอเทมเป้าหมาย 5-10 ชิ้นแล้ว');
}
