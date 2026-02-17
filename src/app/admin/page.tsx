'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AttendanceSettings, Location, Teacher, AttendanceRecord } from '@/lib/types';
import { formatDateTime, formatDate, getTodayISO } from '@/lib/time-utils';
import { ORG_SHORT } from '@/lib/constants';
import {
  ArrowLeft,
  Users,
  Clock,
  MapPin,
  Plus,
  Trash2,
  Save,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Shield,
  Building2,
} from 'lucide-react';
import Link from 'next/link';

type Tab = 'records' | 'teachers' | 'locations' | 'settings';

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState<Tab>('records');
  const [loading, setLoading] = useState(false);

  // Records
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayISO());
  const [filterLocationId, setFilterLocationId] = useState('');

  // Teachers
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [newTeacher, setNewTeacher] = useState({ teacher_id: '', full_name: '', position: '', location_id: '', pin_code: '1234' });

  // Locations
  const [locations, setLocations] = useState<Location[]>([]);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);
  const [newLoc, setNewLoc] = useState({ name: '', short_name: '', district: '', lat: '', lng: '', radius_meters: '200' });

  // Settings
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<Partial<AttendanceSettings>>({});
  const [saveMsg, setSaveMsg] = useState('');

  const supabase = createClient();

  const handleLogin = async () => {
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .eq('pin_code', pin)
      .eq('is_admin', true)
      .eq('is_active', true)
      .limit(1)
      .single();
    if (data) setAuthed(true);
    else alert('PIN ไม่ถูกต้องหรือไม่มีสิทธิ์ Admin');
  };

  const fetchLocations = useCallback(async () => {
    const { data } = await supabase.from('locations').select('*').order('is_headquarters', { ascending: false }).order('district');
    setLocations((data as Location[]) || []);
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('attendance_records')
      .select('*, teachers(full_name, teacher_id, position), locations(short_name, district)')
      .eq('date', selectedDate)
      .order('check_in_time', { ascending: true });
    if (filterLocationId) query = query.eq('location_id', filterLocationId);
    const { data } = await query;
    setRecords((data as AttendanceRecord[]) || []);
    setLoading(false);
  }, [selectedDate, filterLocationId]);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('teachers').select('*, locations(id, short_name, district)').order('created_at');
    setTeachers((data as Teacher[]) || []);
    setLoading(false);
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('attendance_settings').select('*').single();
    if (data) { setSettings(data as AttendanceSettings); setSettingsForm(data as AttendanceSettings); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchLocations();
  }, [authed, fetchLocations]);

  useEffect(() => {
    if (!authed) return;
    if (tab === 'records') fetchRecords();
    else if (tab === 'teachers') fetchTeachers();
    else if (tab === 'locations') fetchLocations();
    else if (tab === 'settings') fetchSettings();
  }, [authed, tab, fetchRecords, fetchTeachers, fetchLocations, fetchSettings]);

  const changeDate = (d: number) => {
    const dt = new Date(selectedDate);
    dt.setDate(dt.getDate() + d);
    setSelectedDate(dt.toISOString().split('T')[0]);
  };

  const addTeacher = async () => {
    if (!newTeacher.teacher_id || !newTeacher.full_name) { alert('กรุณากรอกรหัสครูและชื่อ'); return; }
    const { error } = await supabase.from('teachers').insert({
      ...newTeacher,
      location_id: newTeacher.location_id || null,
    });
    if (error) { alert(error.code === '23505' ? 'รหัสครูซ้ำ' : error.message); return; }
    setNewTeacher({ teacher_id: '', full_name: '', position: '', location_id: '', pin_code: '1234' });
    fetchTeachers();
  };

  const deleteTeacher = async (id: string, name: string) => {
    if (!confirm(`ลบครู "${name}" ?`)) return;
    await supabase.from('teachers').delete().eq('id', id);
    fetchTeachers();
  };

  const addLocation = async () => {
    if (!newLoc.short_name || !newLoc.district || !newLoc.lat || !newLoc.lng) { alert('กรุณากรอกชื่อย่อ, อำเภอ, และพิกัด'); return; }
    const { error } = await supabase.from('locations').insert({
      name: newLoc.name || newLoc.short_name,
      short_name: newLoc.short_name,
      district: newLoc.district,
      lat: parseFloat(newLoc.lat),
      lng: parseFloat(newLoc.lng),
      radius_meters: parseInt(newLoc.radius_meters) || 200,
    });
    if (error) { alert(error.message); return; }
    setNewLoc({ name: '', short_name: '', district: '', lat: '', lng: '', radius_meters: '200' });
    fetchLocations();
  };

  const deleteLocation = async (id: string, name: string) => {
    if (!confirm(`ลบหน่วยบริการ "${name}" ?`)) return;
    await supabase.from('locations').delete().eq('id', id);
    fetchLocations();
  };

  const updateLocation = async (loc: Location) => {
    await supabase.from('locations').update({
      name: loc.name, short_name: loc.short_name, district: loc.district,
      lat: loc.lat, lng: loc.lng, radius_meters: loc.radius_meters,
    }).eq('id', loc.id);
    setEditingLoc(null);
    fetchLocations();
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaveMsg('');
    const { error } = await supabase
      .from('attendance_settings')
      .update({ ...settingsForm, updated_at: new Date().toISOString() })
      .eq('id', settings.id);
    setSaveMsg(error ? 'เกิดข้อผิดพลาด: ' + error.message : 'บันทึกสำเร็จ');
    if (!error) fetchSettings();
  };

  const inputClass = 'px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500';

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-xs text-center">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">จัดการระบบ</h1>
          <p className="text-blue-400 text-sm mb-1">{ORG_SHORT}</p>
          <p className="text-slate-400 text-xs mb-6">กรอก PIN ผู้ดูแลระบบ</p>
          <input
            type="password" inputMode="numeric" maxLength={6}
            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="PIN"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-center text-2xl tracking-[0.5em] placeholder-slate-600 focus:outline-none focus:border-amber-500 mb-4"
          />
          <button onClick={handleLogin} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition">
            เข้าสู่ระบบ
          </button>
          <Link href="/" className="inline-block mt-4 text-slate-500 text-sm hover:text-white transition">← กลับหน้าหลัก</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <header className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur border-b border-slate-800">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" /><span className="text-sm">กลับ</span>
          </Link>
          <h1 className="text-white font-bold text-sm">{ORG_SHORT} - Admin</h1>
          <div className="w-16" />
        </div>
        <div className="flex border-b border-slate-800 overflow-x-auto">
          {([
            { key: 'records' as Tab, label: 'ประวัติ', icon: CalendarDays },
            { key: 'teachers' as Tab, label: 'ครู', icon: Users },
            { key: 'locations' as Tab, label: 'หน่วยบริการ', icon: Building2 },
            { key: 'settings' as Tab, label: 'ตั้งค่า', icon: Clock },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition border-b-2 whitespace-nowrap ${
                tab === key ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-blue-400 animate-spin" /></div>}

        {/* RECORDS */}
        {tab === 'records' && !loading && (
          <div>
            <div className="flex items-center justify-between mb-3 bg-slate-800/60 rounded-xl p-3">
              <button onClick={() => changeDate(-1)} className="p-1.5 text-slate-400 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
              <div className="text-center">
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-transparent text-white text-center text-sm focus:outline-none" />
                <p className="text-slate-500 text-xs">{formatDate(selectedDate)}</p>
              </div>
              <button onClick={() => changeDate(1)} className="p-1.5 text-slate-400 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
            </div>

            {/* Location filter */}
            <select value={filterLocationId} onChange={e => setFilterLocationId(e.target.value)}
              className="w-full mb-3 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
              <option value="">ทุกหน่วยบริการ</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.short_name} - อ.{l.district}</option>)}
            </select>

            <p className="text-slate-400 text-xs mb-3">ทั้งหมด {records.length} รายการ</p>

            {records.length === 0 ? (
              <div className="text-center text-slate-500 py-12">ไม่มีข้อมูล</div>
            ) : (
              <div className="space-y-2">
                {records.map(r => (
                  <div key={r.id} className="bg-slate-800/60 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-medium">{(r.teachers as unknown as Teacher)?.full_name || '-'}</span>
                      <span className="text-slate-500 text-xs">{(r.teachers as unknown as Teacher)?.teacher_id}</span>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span><span className="text-slate-500">เข้า: </span><span className="text-emerald-400">{formatDateTime(r.check_in_time)}</span></span>
                      <span><span className="text-slate-500">ออก: </span><span className="text-orange-400">{formatDateTime(r.check_out_time)}</span></span>
                    </div>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {r.locations && <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">{(r.locations as unknown as Location).short_name}</span>}
                      {r.check_in_liveness && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">Face✓</span>}
                      {r.status === 'late' && <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">เข้าสาย</span>}
                      {r.auto_checkout && <span className="text-[10px] px-1.5 py-0.5 bg-slate-500/20 text-slate-400 rounded">ออกอัตโนมัติ</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TEACHERS */}
        {tab === 'teachers' && !loading && (
          <div>
            <div className="bg-slate-800/60 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> เพิ่มครู / บุคลากร</h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input placeholder="รหัสครู *" value={newTeacher.teacher_id}
                  onChange={e => setNewTeacher({ ...newTeacher, teacher_id: e.target.value.toUpperCase() })} className={inputClass} />
                <input placeholder="ชื่อ-นามสกุล *" value={newTeacher.full_name}
                  onChange={e => setNewTeacher({ ...newTeacher, full_name: e.target.value })} className={inputClass} />
                <input placeholder="ตำแหน่ง" value={newTeacher.position}
                  onChange={e => setNewTeacher({ ...newTeacher, position: e.target.value })} className={inputClass} />
                <input placeholder="PIN (เริ่มต้น 1234)" value={newTeacher.pin_code}
                  onChange={e => setNewTeacher({ ...newTeacher, pin_code: e.target.value.replace(/\D/g, '') })} maxLength={6} inputMode="numeric" className={inputClass} />
              </div>
              <select value={newTeacher.location_id} onChange={e => setNewTeacher({ ...newTeacher, location_id: e.target.value })}
                className={`w-full mb-3 ${inputClass}`}>
                <option value="">-- ไม่ระบุหน่วยบริการ --</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.short_name} - อ.{l.district}</option>)}
              </select>
              <button onClick={addTeacher} className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition">เพิ่มครู</button>
            </div>

            <p className="text-slate-400 text-xs mb-3">ทั้งหมด {teachers.length} คน</p>
            <div className="space-y-2">
              {teachers.map(t => (
                <div key={t.id} className="bg-slate-800/60 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium">{t.full_name}</span>
                      {t.is_admin && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">Admin</span>}
                      {t.enrollment_status === 'enrolled' && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">ลงทะเบียนใบหน้าแล้ว</span>}
                      {t.enrollment_status === 'none' && <span className="text-[10px] px-1.5 py-0.5 bg-slate-500/20 text-slate-400 rounded">ยังไม่ลงทะเบียน</span>}
                      {t.enrollment_status === 'revoked' && <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">ถูกยกเลิก</span>}
                    </div>
                    <div className="text-slate-500 text-xs">
                      {t.teacher_id} · {t.position || '-'} · PIN: {t.pin_code}
                    </div>
                    {t.locations && <div className="text-blue-400 text-xs mt-0.5"><MapPin className="w-3 h-3 inline mr-0.5" />{(t.locations as unknown as Location).short_name}</div>}
                  </div>
                  <button onClick={() => deleteTeacher(t.id, t.full_name)} className="p-2 text-slate-500 hover:text-red-400 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOCATIONS */}
        {tab === 'locations' && !loading && (
          <div>
            <div className="bg-slate-800/60 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> เพิ่มหน่วยบริการ</h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input placeholder="ชื่อย่อ *" value={newLoc.short_name}
                  onChange={e => setNewLoc({ ...newLoc, short_name: e.target.value })} className={inputClass} />
                <input placeholder="อำเภอ *" value={newLoc.district}
                  onChange={e => setNewLoc({ ...newLoc, district: e.target.value })} className={inputClass} />
                <input placeholder="Lat *" type="number" step="any" value={newLoc.lat}
                  onChange={e => setNewLoc({ ...newLoc, lat: e.target.value })} className={inputClass} />
                <input placeholder="Lng *" type="number" step="any" value={newLoc.lng}
                  onChange={e => setNewLoc({ ...newLoc, lng: e.target.value })} className={inputClass} />
                <input placeholder="รัศมี (m)" type="number" value={newLoc.radius_meters}
                  onChange={e => setNewLoc({ ...newLoc, radius_meters: e.target.value })} className={inputClass} />
                <input placeholder="ชื่อเต็ม (ไม่บังคับ)" value={newLoc.name}
                  onChange={e => setNewLoc({ ...newLoc, name: e.target.value })} className={inputClass} />
              </div>
              <button onClick={addLocation} className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition">เพิ่มหน่วยบริการ</button>
            </div>

            <p className="text-slate-400 text-xs mb-3">หน่วยบริการทั้งหมด {locations.length} แห่ง (แตะเพื่อแก้ไข)</p>
            <div className="space-y-2">
              {locations.map(loc => (
                <div key={loc.id} className="bg-slate-800/60 rounded-xl p-3">
                  {editingLoc?.id === loc.id ? (
                    <div className="space-y-2">
                      <input value={editingLoc.short_name} onChange={e => setEditingLoc({ ...editingLoc, short_name: e.target.value })} className={`w-full ${inputClass}`} />
                      <div className="grid grid-cols-3 gap-2">
                        <div><label className="text-slate-500 text-[10px]">Lat</label>
                          <input type="number" step="any" value={editingLoc.lat} onChange={e => setEditingLoc({ ...editingLoc, lat: parseFloat(e.target.value) })} className={`w-full ${inputClass}`} /></div>
                        <div><label className="text-slate-500 text-[10px]">Lng</label>
                          <input type="number" step="any" value={editingLoc.lng} onChange={e => setEditingLoc({ ...editingLoc, lng: parseFloat(e.target.value) })} className={`w-full ${inputClass}`} /></div>
                        <div><label className="text-slate-500 text-[10px]">รัศมี(m)</label>
                          <input type="number" value={editingLoc.radius_meters} onChange={e => setEditingLoc({ ...editingLoc, radius_meters: parseInt(e.target.value) })} className={`w-full ${inputClass}`} /></div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateLocation(editingLoc)} className="flex-1 py-1.5 bg-blue-500 text-white rounded-lg text-xs">บันทึก</button>
                        <button onClick={() => setEditingLoc(null)} className="flex-1 py-1.5 bg-slate-600 text-white rounded-lg text-xs">ยกเลิก</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1 cursor-pointer" onClick={() => setEditingLoc({ ...loc })}>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{loc.short_name}</span>
                          {loc.is_headquarters && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">สำนักงานใหญ่</span>}
                        </div>
                        <p className="text-slate-500 text-xs">อ.{loc.district} · รัศมี {loc.radius_meters}m</p>
                        <p className="text-slate-600 text-[10px]">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-slate-600" />
                        {!loc.is_headquarters && (
                          <button onClick={() => deleteLocation(loc.id, loc.short_name)} className="p-2 text-slate-500 hover:text-red-400 transition"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {tab === 'settings' && !loading && settings && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> ช่วงเวลาลงเวลา (ใช้ร่วมกันทุกหน่วย)</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-slate-400 text-xs block mb-1">เวลาเข้างาน</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-slate-500 text-[10px]">เริ่ม</span>
                      <input type="time" value={settingsForm.check_in_start || ''} onChange={e => setSettingsForm({ ...settingsForm, check_in_start: e.target.value })} className={`w-full ${inputClass}`} /></div>
                    <div><span className="text-slate-500 text-[10px]">สิ้นสุด</span>
                      <input type="time" value={settingsForm.check_in_end || ''} onChange={e => setSettingsForm({ ...settingsForm, check_in_end: e.target.value })} className={`w-full ${inputClass}`} /></div>
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">เข้าสายหลังเวลา</label>
                  <input type="time" value={settingsForm.late_after || '08:30'} onChange={e => setSettingsForm({ ...settingsForm, late_after: e.target.value })}
                    className={`w-full ${inputClass}`} />
                  <p className="text-slate-500 text-[10px] mt-1">ลงเวลาเข้าหลังเวลานี้จะถูกบันทึกเป็น &quot;เข้าสาย&quot;</p>
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">เวลาออกงาน</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-slate-500 text-[10px]">เริ่ม</span>
                      <input type="time" value={settingsForm.check_out_start || ''} onChange={e => setSettingsForm({ ...settingsForm, check_out_start: e.target.value })} className={`w-full ${inputClass}`} /></div>
                    <div><span className="text-slate-500 text-[10px]">สิ้นสุด</span>
                      <input type="time" value={settingsForm.check_out_end || ''} onChange={e => setSettingsForm({ ...settingsForm, check_out_end: e.target.value })} className={`w-full ${inputClass}`} /></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">ค่าความแม่นยำการจับคู่ใบหน้า</h3>
              <div>
                <label className="text-slate-400 text-xs block mb-1">Threshold (ค่ายิ่งต่ำ ยิ่งเข้มงวด, แนะนำ 0.4–0.6)</label>
                <input type="number" step="0.05" min="0.1" max="1.0"
                  value={settingsForm.face_match_threshold ?? 0.5}
                  onChange={e => setSettingsForm({ ...settingsForm, face_match_threshold: parseFloat(e.target.value) })}
                  className={`w-full ${inputClass}`} />
              </div>
            </div>
            <button onClick={saveSettings} className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition">
              <Save className="w-5 h-5" />บันทึกการตั้งค่า
            </button>
            {saveMsg && <p className={`text-center text-sm ${saveMsg.includes('สำเร็จ') ? 'text-emerald-400' : 'text-red-400'}`}>{saveMsg}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
