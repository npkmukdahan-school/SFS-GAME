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
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  Database,
  LogOut,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
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

export default function AdminPortal() {
  const [authReady, setAuthReady] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [mode, setMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const [authError, setAuthError] = useState('');
  const [foodForm, setFoodForm] = useState(emptyFoodForm);
  const [foods, setFoods] = useState([]);
  const [saving, setSaving] = useState(false);

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
    setDoc(
      foodsRef,
      {
        uid: admin.uid,
        email: admin.email || '',
        displayName: admin.displayName || admin.email || 'Admin',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return undefined;
  }, [admin]);

  useEffect(() => {
    if (!admin) return undefined;

    const unsubscribe = onSnapshot(collection(db, 'admins', admin.uid, 'foods'), (snapshot) => {
      const items = snapshot.docs
        .map((foodDoc) => ({ id: foodDoc.id, ...foodDoc.data() }))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'));
      setFoods(items);
    });

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

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');

    try {
      if (mode === 'register') {
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
          role: 'admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
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
    if (!barcode) {
      alert('กรุณากรอกรหัสบาร์โค้ด');
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, 'admins', admin.uid, 'foods', barcode),
        {
          barcode,
          name: foodForm.name.trim(),
          category: foodForm.category,
          sugar: Number(foodForm.sugar || 0),
          fat: Number(foodForm.fat || 0),
          sodium: Number(foodForm.sodium || 0),
          videoUrl: foodForm.videoUrl.trim(),
          imageUrl: foodForm.imageUrl.trim(),
          ownerAdminId: admin.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setFoodForm(emptyFoodForm);
    } finally {
      setSaving(false);
    }
  };

  const handleEditFood = (food) => {
    setFoodForm({
      barcode: food.barcode || food.id || '',
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

    await deleteDoc(doc(db, 'admins', admin.uid, 'foods', barcode));
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
              <input
                value={authForm.displayName}
                onChange={(e) => setAuthForm({ ...authForm, displayName: e.target.value })}
                placeholder="ชื่อ Admin / ชื่อครู"
                className="w-full mb-3 px-4 py-4 rounded-2xl bg-slate-950/70 border border-white/10 outline-none focus:border-cyan-300"
              />
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
                    <td colSpan="7" className="p-10 text-center text-slate-400 font-bold">
                      ยังไม่มีข้อมูลอาหารในฐานของ Admin คนนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
