import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import SectionHeader from '../components/SectionHeader'
import AdminGate from '../components/AdminGate'
import { useAdmin } from '../contexts/AdminContext'

const ICON_LIST = ['🏫','🔬','🧪','💻','🖥️','⚙️','📚','🏛️','📽️','🎨','🎭','🏋️','🔭','🧬','📐']

const STATUS_CONFIG = {
  approved: { dot: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700', label: 'Lulus',  btn: 'bg-emerald-900/40 border-emerald-700 text-emerald-400' },
  pending:  { dot: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700',     label: 'Tunggu', btn: 'bg-amber-900/40 border-amber-700 text-amber-400' },
  rejected: { dot: 'bg-red-400',     badge: 'bg-red-100 text-red-700',         label: 'Tolak',  btn: 'bg-red-900/40 border-red-700 text-red-400' },
}

// Slot masa 30 minit ikut waktu sekolah
const SLOT_PAGI = [
  { masa: '06:50–07:20', label: 'P1' },
  { masa: '07:20–07:50', label: 'P2' },
  { masa: '07:50–08:20', label: 'P3' },
  { masa: '08:20–08:50', label: 'P4' },
  { masa: '08:50–09:20', label: 'P5' },
  { masa: '09:20–09:50', label: 'P6' },
  { masa: 'REHAT',       label: '—',  rehat: true },
  { masa: '10:10–10:40', label: 'P7' },
  { masa: '10:40–11:10', label: 'P8' },
  { masa: '11:10–11:40', label: 'P9' },
  { masa: '11:40–12:10', label: 'P10' },
]
const SLOT_PETANG = [
  { masa: '12:30–13:00', label: 'T1' },
  { masa: '13:00–13:30', label: 'T2' },
  { masa: '13:30–14:00', label: 'T3' },
  { masa: '14:00–14:30', label: 'T4' },
  { masa: '14:30–15:00', label: 'T5' },
  { masa: '15:00–15:20', label: '—',  rehat: true },
  { masa: '15:20–15:50', label: 'T6' },
  { masa: '15:50–16:20', label: 'T7' },
  { masa: '16:20–16:50', label: 'T8' },
  { masa: '16:50–17:20', label: 'T9' },
  { masa: '17:20–17:40', label: 'T10' },
]

const PAGI_STARTS = SLOT_PAGI.filter(s => !s.rehat).map(s => s.masa.split('–')[0])
const PAGI_ENDS   = SLOT_PAGI.filter(s => !s.rehat).map(s => s.masa.split('–')[1])
const PETANG_STARTS = SLOT_PETANG.filter(s => !s.rehat).map(s => s.masa.split('–')[0])
const PETANG_ENDS   = SLOT_PETANG.filter(s => !s.rehat).map(s => s.masa.split('–')[1])
const ALL_STARTS = [...PAGI_STARTS, ...PETANG_STARTS]

function toMins(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function hasOverlap(masa1, masa2) {
  try {
    const [s1, e1] = masa1.split('–').map(toMins)
    const [s2, e2] = masa2.split('–').map(toMins)
    return s1 < e2 && e1 > s2
  } catch { return false }
}

function slotDalamRange(bookingMasa, slotMasa) {
  try {
    const [bs, be] = bookingMasa.split('–').map(toMins)
    const [ss, se] = slotMasa.split('–').map(toMins)
    return bs <= ss && be >= se
  } catch { return bookingMasa === slotMasa }
}

function durasiLabel(mula, tamat) {
  if (!mula || !tamat) return ''
  const mins = toMins(tamat) - toMins(mula)
  if (mins <= 0) return ''
  const j = Math.floor(mins / 60)
  const m = mins % 60
  return `${j > 0 ? j + ' jam ' : ''}${m > 0 ? m + ' minit' : ''}`.trim()
}

const TODAY = new Date().toISOString().slice(0, 10)

export default function TempahanBilik() {
  const { isAdmin } = useAdmin()
  const [tab, setTab] = useState('dashboard')
  const [tempahan, setTempahan] = useState([])
  const [bilikList, setBilikList] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [filterStatus, setFilterStatus] = useState('semua')
  const [jadualDate, setJadualDate] = useState(TODAY)

  const [form, setForm] = useState({
    guru: '', bilik: '', tarikh: TODAY, masa_mula: '', masa_tamat: '', tujuan: '',
  })

  const [formBilik, setFormBilik] = useState({ nama: '', icon: '🏫', kapasiti: '30 pelajar' })
  const [bilikTutup, setBilikTutup] = useState([])
  const [formTutup, setFormTutup] = useState({ bilik: '', tarikh_mula: TODAY, tarikh_tamat: TODAY, sebab: '' })

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  async function fetchTempahan() {
    const { data } = await supabase
      .from('tempahan_bilik')
      .select('*')
      .order('created_at', { ascending: false })
    const rows = data ?? []
    setTempahan(rows)
    setLoading(false)
    return rows
  }

  async function fetchBilik() {
    const { data } = await supabase.from('bilik_khas').select('*').order('created_at')
    setBilikList(data ?? [])
  }

  async function fetchBilikTutup() {
    const { data } = await supabase.from('bilik_tutup').select('*').order('tarikh_mula')
    setBilikTutup(data ?? [])
  }

  async function tambahTutup() {
    if (!formTutup.bilik || !formTutup.tarikh_mula || !formTutup.tarikh_tamat) {
      showToast('Sila lengkapkan maklumat penutupan!', 'error'); return
    }
    if (formTutup.tarikh_tamat < formTutup.tarikh_mula) {
      showToast('Tarikh tamat mestilah selepas tarikh mula!', 'error'); return
    }
    const { error } = await supabase.from('bilik_tutup').insert([formTutup])
    if (error) { showToast('Ralat: ' + error.message, 'error'); return }
    setFormTutup({ bilik: '', tarikh_mula: TODAY, tarikh_tamat: TODAY, sebab: '' })
    showToast('🚫 Penutupan bilik berjaya ditetapkan!')
    fetchBilikTutup()
  }

  async function hapusTutup(id) {
    await supabase.from('bilik_tutup').delete().eq('id', id)
    showToast('✅ Penutupan dibatalkan!')
    fetchBilikTutup()
  }

  function getTutupInfo(namaBilik, tarikh) {
    const norm = s => s?.trim().toLowerCase()
    return bilikTutup.find(t =>
      norm(t.bilik) === norm(namaBilik) &&
      tarikh >= t.tarikh_mula && tarikh <= t.tarikh_tamat
    ) ?? null
  }

  async function tambahBilik() {
    if (!formBilik.nama) { showToast('Sila masukkan nama bilik!', 'error'); return }
    const { error } = await supabase.from('bilik_khas').insert([formBilik])
    if (error) { showToast('Ralat: ' + error.message, 'error'); return }
    setFormBilik({ nama: '', icon: '🏫', kapasiti: '30 pelajar' })
    showToast('✅ Bilik berjaya ditambah!')
    fetchBilik()
  }

  async function deleteBilik(id) {
    await supabase.from('bilik_khas').delete().eq('id', id)
    showToast('🗑️ Bilik dipadam!')
    fetchBilik()
  }

  useEffect(() => { fetchTempahan(); fetchBilik(); fetchBilikTutup() }, [])

  const pendingCount = tempahan.filter(t => t.status === 'pending').length
  const todayCount   = tempahan.filter(t => t.tarikh === TODAY).length

  // Room status: setiap bilik, cek ada tempahan approved hari ini
  function getRoomStatus(namaBilik) {
    const norm = s => s?.trim().toLowerCase()
    const masaHariIni = tempahan.filter(t =>
      norm(t.bilik) === norm(namaBilik) && t.tarikh === TODAY && t.status === 'approved'
    )
    const pendingBilik = tempahan.find(t =>
      norm(t.bilik) === norm(namaBilik) && t.tarikh === TODAY && t.status === 'pending'
    )
    if (masaHariIni.length > 0) return 'booked'
    if (pendingBilik) return 'pending'
    return 'available'
  }

  // Semak konflik masa range
  const masaRange = form.masa_mula && form.masa_tamat
    ? `${form.masa_mula}–${form.masa_tamat}` : null

  const slotKonflik = masaRange && form.bilik && form.tarikh
    ? tempahan.find(t =>
        t.bilik === form.bilik &&
        t.tarikh === form.tarikh &&
        t.status !== 'rejected' &&
        hasOverlap(t.masa, masaRange)
      )
    : null

  const bilikDitutup = form.bilik && form.tarikh
    ? getTutupInfo(form.bilik, form.tarikh)
    : null

  // End times — same session as mula, after mula
  const availableTamat = (() => {
    if (!form.masa_mula) return []
    const isPagi = PAGI_STARTS.includes(form.masa_mula)
    const ends = isPagi ? PAGI_ENDS : PETANG_ENDS
    return ends.filter(e => toMins(e) > toMins(form.masa_mula))
  })()

  async function submitTempahan() {
    if (!form.guru || !form.bilik || !form.tarikh || !form.masa_mula || !form.masa_tamat) {
      showToast('Sila lengkapkan semua maklumat!', 'error'); return
    }
    if (toMins(form.masa_tamat) <= toMins(form.masa_mula)) {
      showToast('Masa tamat mestilah selepas masa mula!', 'error'); return
    }
    if (bilikDitutup) {
      showToast(`🚫 ${form.bilik} ditutup sehingga ${bilikDitutup.tarikh_tamat}!`, 'error'); return
    }
    if (slotKonflik) {
      showToast(`⚠️ Masa ini sudah ditempah oleh ${slotKonflik.guru}!`, 'error'); return
    }
    const masa = `${form.masa_mula}–${form.masa_tamat}`
    const { error } = await supabase.from('tempahan_bilik').insert([{
      guru: form.guru, bilik: form.bilik, tarikh: form.tarikh,
      masa, tujuan: form.tujuan, status: 'pending',
    }])
    if (error) { showToast('Ralat: ' + error.message, 'error'); return }
    const tarikhDitempah = form.tarikh
    setForm({ guru: '', bilik: '', tarikh: TODAY, masa_mula: '', masa_tamat: '', tujuan: '' })
    showToast('✅ Tempahan berjaya dihantar!')
    await fetchTempahan()
    setJadualDate(tarikhDitempah)
    setTab('jadual')
  }

  async function bulkApprove() {
    const pendingIds = tempahan.filter(t => t.status === 'pending').map(t => t.id)
    if (!pendingIds.length) return
    await supabase.from('tempahan_bilik').update({ status: 'approved' }).in('id', pendingIds)
    showToast(`✅ ${pendingIds.length} tempahan diluluskan sekaligus!`)
    fetchTempahan()
  }

  async function deleteTempahan(id) {
    await supabase.from('tempahan_bilik').delete().eq('id', id)
    showToast('🗑️ Rekod berjaya dipadam!')
    setModal(null)
    fetchTempahan()
  }

  async function updateStatus(id, status) {
    const { error } = await supabase
      .from('tempahan_bilik').update({ status }).eq('id', id)
    if (error) { showToast('Ralat: ' + error.message, 'error'); return }
    showToast(status === 'approved' ? '✅ Tempahan diluluskan!' : '❌ Tempahan ditolak!')
    setModal(null)
    fetchTempahan()
  }

  const filtered = filterStatus === 'semua'
    ? tempahan
    : tempahan.filter(t => t.status === filterStatus)

  const TABS = [
    { id: 'dashboard', label: '🏠 Utama' },
    { id: 'jadual',    label: '📅 Jadual' },
    { id: 'tempah',    label: '➕ Tempah' },
    { id: 'senarai',   label: '📋 Senarai' },
    { id: 'admin',     label: '⚙️ Admin' },
  ]

  return (
    <Layout badgeCounts={{ tempahan: pendingCount }}>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full text-sm font-semibold text-white shadow-xl transition-all max-w-xs text-center ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-600'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Tab Nav */}
      <div className="tab-nav-sticky flex gap-1.5 rounded-2xl p-1.5 overflow-x-auto scrollbar-hide"
        style={{ background: '#FFFFFF', border: '2px solid #111827', boxShadow: '3px 3px 0 #111827' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={tab === t.id
              ? { background: '#2563EB', color: '#fff', border: '1.5px solid #111827', boxShadow: '2px 2px 0 #111827' }
              : { background: 'transparent', color: '#64748B' }}>
            {t.label}
            {t.id === 'admin' && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { num: bilikList.length, label: 'Jumlah Bilik',       bg: '#DBEAFE', numColor: '#1D4ED8' },
              { num: pendingCount,      label: 'Menunggu Lulus',     bg: '#FEF3C7', numColor: '#D97706' },
              { num: todayCount,        label: 'Tempahan Hari Ini',  bg: '#DCFCE7', numColor: '#059669' },
            ].map((s, i) => (
              <div key={i} className="neo-card p-5 text-center animate-fade-up" style={{ background: s.bg }}>
                <div className="text-3xl font-black" style={{ color: s.numColor, fontFamily: "'JetBrains Mono', monospace" }}>{s.num}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Room Grid */}
          <div className="neo-card p-5">
            <SectionHeader icon="🏫" title="Status Bilik Khas" color="text-sky-400" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              {bilikList.map(b => {
                const status = getRoomStatus(b.nama)
                const roomBg = { available: '#F0FDF4', booked: '#FEF2F2', pending: '#FFFBEB' }
                const badges = {
                  available: 'bg-emerald-100 text-emerald-700',
                  booked:    'bg-red-100 text-red-700',
                  pending:   'bg-amber-100 text-amber-700',
                }
                const badgeLabel = { available: 'Kosong', booked: 'Ditempah', pending: 'Tunggu' }
                return (
                  <div key={b.nama}
                    className="neo-card p-3 cursor-pointer transition-all hover:scale-[1.02]"
                    style={{ background: roomBg[status] }}
                    onClick={() => setTab('tempah')}>
                    <div className="text-2xl mb-2">{b.icon}</div>
                    <div className="text-xs font-bold text-gray-900 leading-tight">{b.nama}</div>
                    <div className="text-xs text-gray-500 mt-1">{b.kapasiti}</div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-2 inline-block ${badges[status]}`}>
                      {badgeLabel[status]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Terkini */}
          <div className="neo-card p-5">
            <SectionHeader icon="📋" title="Tempahan Terkini" color="text-sky-400"
              onMore={() => setTab('senarai')} />
            <div className="space-y-2.5 mt-4">
              {tempahan.slice(0, 4).map(t => {
                const s = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.pending
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-all"
                    style={{ background: '#F0F7FF' }}
                    onClick={() => setModal(t)}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-900 truncate">{t.guru}</div>
                      <div className="text-xs text-gray-500 truncate">{t.bilik} • {t.masa}</div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${s.badge}`}>{s.label}</span>
                  </div>
                )
              })}
              {tempahan.length === 0 && !loading && (
                <div className="text-center text-xs text-gray-500 py-6">Tiada rekod tempahan</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── JADUAL MASA ── */}
      {tab === 'jadual' && (
        <>
          {/* Print button — desktop only */}
          <div className="hidden sm:flex justify-end no-print">
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:border-sky-500 hover:text-sky-600 transition-colors">
              🖨️ Print Jadual
            </button>
          </div>

          {/* Date picker — stacks on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-xs font-semibold text-sky-400 shrink-0">Pilih Tarikh:</label>
            <input type="date" value={jadualDate}
              onChange={e => setJadualDate(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400 w-full sm:w-auto" />
            <span className="text-xs text-gray-400">
              {new Date(jadualDate).toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {[
              { color: 'bg-emerald-100 border-emerald-300', label: 'Lulus' },
              { color: 'bg-amber-100 border-amber-300',     label: 'Tunggu' },
              { color: 'bg-white border-gray-200',          label: 'Kosong' },
              { color: 'bg-blue-100 border-blue-300',       label: 'Rehat' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded border ${l.color}`} />
                <span className="text-gray-500">{l.label}</span>
              </div>
            ))}
          </div>

          {/* Timetable — full-width on mobile, rounded on desktop */}
          <div className="overflow-x-auto -mx-4 sm:mx-0 border-y sm:border sm:rounded-2xl border-gray-200">
            <table className="border-collapse text-xs" style={{ width: '100%', minWidth: `${Math.max(400, bilikList.length * 88 + 88)}px` }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th className="px-2 py-3 text-left text-gray-500 font-semibold border-b border-r border-gray-200 sticky left-0 w-20 sm:w-28" style={{ background: '#F9FAFB' }}>
                    Masa
                  </th>
                  {bilikList.map(b => {
                    const tutup = getTutupInfo(b.nama, jadualDate)
                    return (
                      <th key={b.nama} className={`px-1 py-2 text-center font-semibold border-b border-r border-gray-200 ${tutup ? 'bg-red-50' : ''}`} style={{ minWidth: 84 }}>
                        <div className="text-base leading-none">{b.icon}</div>
                        <div className={`text-[10px] leading-tight mt-0.5 px-0.5 line-clamp-2 ${tutup ? 'text-red-600' : 'text-gray-700'}`}>{b.nama}</div>
                        {tutup && <div className="text-[9px] text-red-400 font-normal mt-0.5 leading-none">🚫 Tutup</div>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Sesi Pagi header */}
                <tr style={{ background: 'rgba(74,158,255,0.05)' }}>
                  <td colSpan={bilikList.length + 1}
                    className="px-3 py-1.5 text-xs font-bold border-b border-gray-200"
                    style={{ color: '#4A9EFF' }}>
                    ☀️ SESI PAGI
                  </td>
                </tr>

                {SLOT_PAGI.map((slot) => {
                  if (slot.rehat) {
                    return (
                      <tr key="rehat">
                        <td className="px-2 py-2 text-xs font-bold border-b border-r border-gray-200 sticky left-0 text-blue-500"
                          style={{ background: '#EFF6FF' }}>
                          <div className="leading-tight">09:50</div>
                          <div className="leading-tight">10:10</div>
                        </td>
                        <td colSpan={bilikList.length}
                          className="text-center py-2 border-b border-gray-200 text-xs font-bold tracking-wide"
                          style={{ background: 'rgba(74,158,255,0.06)', color: '#4A9EFF' }}>
                          — WAKTU REHAT —
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <JadualRow key={slot.masa} slot={slot} bilikList={bilikList}
                      tempahan={tempahan} tarikh={jadualDate} getTutupInfo={getTutupInfo}
                      onBook={(bilik, masa) => {
                        const [mula, tamat] = masa.split('–')
                        setForm(f => ({ ...f, bilik, tarikh: jadualDate, masa_mula: mula, masa_tamat: tamat }))
                        setTab('tempah')
                      }} />
                  )
                })}

                {/* Sesi Petang header */}
                <tr style={{ background: 'rgba(245,166,35,0.05)' }}>
                  <td colSpan={bilikList.length + 1}
                    className="px-3 py-1.5 text-xs font-bold border-b border-gray-200"
                    style={{ color: '#F5A623' }}>
                    🌙 SESI PETANG
                  </td>
                </tr>

                {SLOT_PETANG.map((slot) => {
                  if (slot.rehat) {
                    return (
                      <tr key="rehat-petang">
                        <td className="px-2 py-2 text-xs font-bold border-b border-r border-gray-200 sticky left-0 text-amber-500"
                          style={{ background: '#FFFBEB' }}>
                          <div className="leading-tight">15:00</div>
                          <div className="leading-tight">15:20</div>
                        </td>
                        <td colSpan={bilikList.length}
                          className="text-center py-2 border-b border-gray-200 text-xs font-bold tracking-wide"
                          style={{ background: 'rgba(245,166,35,0.06)', color: '#F5A623' }}>
                          — WAKTU REHAT —
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <JadualRow key={slot.masa} slot={slot} bilikList={bilikList}
                      tempahan={tempahan} tarikh={jadualDate} getTutupInfo={getTutupInfo}
                      onBook={(bilik, masa) => {
                        const [mula, tamat] = masa.split('–')
                        setForm(f => ({ ...f, bilik, tarikh: jadualDate, masa_mula: mula, masa_tamat: tamat }))
                        setTab('tempah')
                      }} />
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Print button — mobile bottom */}
          <div className="flex sm:hidden no-print">
            <button onClick={() => window.print()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:border-sky-500 hover:text-sky-600 transition-colors">
              🖨️ Print Jadual
            </button>
          </div>
        </>
      )}

      {/* ── FORM TEMPAH ── */}
      {tab === 'tempah' && (
        <div className="neo-card p-5 space-y-4">
          <div className="text-sm font-bold text-sky-400 flex items-center gap-2">
            <span>📝</span> Borang Tempahan Bilik Khas
          </div>

          {[
            { label: 'Nama Guru *', field: 'guru', type: 'text', placeholder: 'Nama penuh guru' },
          ].map(f => (
            <div key={f.field}>
              <label className="block text-xs font-semibold text-sky-400 mb-1.5">{f.label}</label>
              <input type={f.type} value={form[f.field]}
                onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-sky-400 mb-1.5">Pilih Bilik *</label>
            <select value={form.bilik} onChange={e => setForm(p => ({ ...p, bilik: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400">
              <option value="">-- Pilih Bilik --</option>
              {bilikList.map(b => <option key={b.nama}>{b.nama}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-sky-400 mb-1.5">Tarikh *</label>
            <input type="date" value={form.tarikh} min={TODAY}
              onChange={e => setForm(p => ({ ...p, tarikh: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-sky-400 mb-1.5">Masa Mula *</label>
              <select value={form.masa_mula}
                onChange={e => setForm(p => ({ ...p, masa_mula: e.target.value, masa_tamat: '' }))}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400">
                <option value="">-- Pilih --</option>
                <optgroup label="☀️ Sesi Pagi">
                  {PAGI_STARTS.map(t => <option key={t} value={t}>{t}</option>)}
                </optgroup>
                <optgroup label="🌙 Sesi Petang">
                  {PETANG_STARTS.map(t => <option key={t} value={t}>{t}</option>)}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-sky-400 mb-1.5">Masa Tamat *</label>
              <select value={form.masa_tamat}
                onChange={e => setForm(p => ({ ...p, masa_tamat: e.target.value }))}
                disabled={!form.masa_mula}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400 disabled:opacity-50">
                <option value="">-- Pilih --</option>
                {availableTamat.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Bilik ditutup warning */}
          {bilikDitutup && (
            <div className="rounded-xl px-3 py-2.5 text-xs font-semibold bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
              <span className="text-base leading-none shrink-0">🚫</span>
              <div>
                <div className="font-bold">{form.bilik} ditutup / penyelenggaraan</div>
                <div className="font-normal mt-0.5">{bilikDitutup.tarikh_mula} → {bilikDitutup.tarikh_tamat}</div>
                {bilikDitutup.sebab && <div className="font-normal text-red-500 italic mt-0.5">"{bilikDitutup.sebab}"</div>}
              </div>
            </div>
          )}

          {/* Durasi + konflik indicator */}
          {form.masa_mula && form.masa_tamat && !bilikDitutup && (
            <div className={`rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2 ${
              slotKonflik
                ? 'bg-red-50 border border-red-200 text-red-600'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            }`}>
              {slotKonflik ? (
                <>🔴 Masa bertindih dengan tempahan <span className="font-bold">{slotKonflik.guru}</span>{slotKonflik.status === 'pending' ? ' (menunggu lulus)' : ''}</>
              ) : (
                <>🟢 Slot kosong • Tempoh: <span className="font-bold">{durasiLabel(form.masa_mula, form.masa_tamat)}</span></>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-sky-400 mb-1.5">Tujuan / Catatan</label>
            <textarea value={form.tujuan} onChange={e => setForm(p => ({ ...p, tujuan: e.target.value }))}
              placeholder="Tujuan penggunaan bilik..."
              rows={3}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 resize-none" />
          </div>

          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-700">
            ℹ️ Permohonan akan disemak oleh pentadbir. Hubungi Guru ICT terus sekiranya terdapat keperluan mendesak.
          </div>

          <button onClick={submitTempahan} disabled={!!bilikDitutup}
            className="w-full py-3.5 rounded-2xl text-sm font-black neo-btn disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#2563EB', color: '#fff', fontFamily: "'Fredoka', sans-serif" }}>
            📤 Hantar Permohonan Tempahan
          </button>
        </div>
      )}

      {/* ── SENARAI ── */}
      {tab === 'senarai' && (
        <>
          {/* Filter */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {['semua', 'pending', 'approved', 'rejected'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className="px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all"
                style={filterStatus === s
                  ? { background: '#2563EB', color: '#fff', border: '1.5px solid #111827', boxShadow: '2px 2px 0 #111827' }
                  : { background: '#fff', color: '#64748B', border: '1.5px solid #CBD5E1' }}>
                {s === 'semua' ? 'Semua' : STATUS_CONFIG[s]?.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.map(t => {
              const s = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.pending
              return (
                <div key={t.id}
                  className="neo-card p-4 flex items-start gap-3 cursor-pointer"
                  onClick={() => setModal(t)}>
                  <div className="w-10 h-10 bg-sky-900/40 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🏫</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900">{t.guru}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{t.bilik}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{t.tarikh} • {t.masa}</div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${s.badge}`}>{s.label}</span>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-5xl mb-3">📭</div>
                <div className="text-sm">Tiada rekod ditemui</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ADMIN ── */}
      {tab === 'admin' && (
        <AdminGate>
          <div className="neo-card p-5">
            <div className="flex items-center justify-between">
              <SectionHeader icon="⏳" title="Menunggu Kelulusan" color="text-amber-400" />
              {pendingCount > 1 && (
                <button onClick={bulkApprove}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
                  style={{ background: '#DCFCE7', color: '#059669', border: '2px solid #111827', boxShadow: '2px 2px 0 #111827' }}>
                  ✅ Luluskan Semua ({pendingCount})
                </button>
              )}
            </div>
            <div className="space-y-3 mt-4">
              {tempahan.filter(t => t.status === 'pending').map(t => (
                <div key={t.id} className="rounded-2xl p-4" style={{ background: '#EEF3FF', border: '2px solid #111827' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🏫</div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-900">{t.guru}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{t.bilik}</div>
                      <div className="text-xs text-gray-500">{t.tarikh} • {t.masa}</div>
                      {t.tujuan && <div className="text-xs text-gray-500 mt-1 italic">"{t.tujuan}"</div>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => updateStatus(t.id, 'approved')}
                      className="flex-1 px-3 py-2 rounded-xl text-xs font-bold neo-btn"
                      style={{ background: '#DCFCE7', color: '#059669' }}>
                      ✅ Luluskan
                    </button>
                    <button onClick={() => updateStatus(t.id, 'rejected')}
                      className="flex-1 px-3 py-2 rounded-xl text-xs font-bold neo-btn"
                      style={{ background: '#FEE2E2', color: '#DC2626' }}>
                      ❌ Tolak
                    </button>
                    <button onClick={() => deleteTempahan(t.id)}
                      className="px-3 py-2 rounded-xl text-xs font-bold neo-btn"
                      style={{ background: '#FEE2E2', color: '#DC2626' }}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {tempahan.filter(t => t.status === 'pending').length === 0 && (
                <div className="text-center py-8 text-gray-500 text-xs">Tiada tempahan menunggu kelulusan</div>
              )}
            </div>
          </div>

          {/* Semua tempahan */}
          <div className="neo-card p-5">
            <SectionHeader icon="📋" title="Semua Tempahan" color="text-sky-400" />
            <div className="space-y-2.5 mt-4">
              {tempahan.map(t => {
                const s = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.pending
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: '#F0F7FF' }}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setModal(t)}>
                      <div className="text-xs font-semibold text-gray-900 truncate">{t.guru}</div>
                      <div className="text-xs text-gray-500 truncate">{t.bilik} • {t.tarikh} • {t.masa}</div>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${s.badge}`}>{s.label}</span>
                    <button onClick={() => deleteTempahan(t.id)}
                      className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-900/30 transition-colors flex-shrink-0">
                      🗑️
                    </button>
                  </div>
                )
              })}
              {tempahan.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-xs">Tiada rekod</div>
              )}
            </div>
          </div>

          {/* Tutup / Penyelenggaraan Bilik */}
          <div className="neo-card p-5 space-y-4">
            <SectionHeader icon="🚫" title="Penutupan / Penyelenggaraan Bilik" color="text-red-400" />

            {/* Form tambah tutup */}
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-3">
              <div className="text-xs font-bold text-red-500">➕ Tutup Bilik (Penyelenggaraan / Tidak Boleh Guna)</div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bilik *</label>
                <select value={formTutup.bilik} onChange={e => setFormTutup(f => ({ ...f, bilik: e.target.value }))}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-red-400">
                  <option value="">-- Pilih Bilik --</option>
                  {bilikList.map(b => <option key={b.id} value={b.nama}>{b.icon} {b.nama}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dari Tarikh *</label>
                  <input type="date" value={formTutup.tarikh_mula}
                    onChange={e => setFormTutup(f => ({ ...f, tarikh_mula: e.target.value }))}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-red-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hingga Tarikh *</label>
                  <input type="date" value={formTutup.tarikh_tamat}
                    onChange={e => setFormTutup(f => ({ ...f, tarikh_tamat: e.target.value }))}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-red-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sebab / Catatan</label>
                <input value={formTutup.sebab} onChange={e => setFormTutup(f => ({ ...f, sebab: e.target.value }))}
                  placeholder="Contoh: Penyelenggaraan projector, Pertandingan..."
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-400" />
              </div>
              <button onClick={tambahTutup}
                className="w-full bg-red-500 hover:bg-red-400 text-white py-2.5 rounded-xl text-xs font-bold transition-colors">
                🚫 Tetapkan Penutupan
              </button>
            </div>

            {/* Senarai penutupan aktif */}
            <div className="space-y-2">
              {bilikTutup.length === 0 && (
                <div className="text-center py-4 text-xs text-gray-400">Tiada penutupan bilik ditetapkan</div>
              )}
              {bilikTutup.map(t => (
                <div key={t.id} className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
                  <span className="text-lg leading-none mt-0.5">🚫</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-red-700">{t.bilik}</div>
                    <div className="text-xs text-red-500 mt-0.5">{t.tarikh_mula} → {t.tarikh_tamat}</div>
                    {t.sebab && <div className="text-xs text-gray-500 italic mt-0.5">"{t.sebab}"</div>}
                  </div>
                  <button onClick={() => hapusTutup(t.id)}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors shrink-0">
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Urus Bilik */}
          <div className="neo-card p-5 space-y-4">
            <SectionHeader icon="🏫" title="Urus Bilik Khas" color="text-sky-400" />

            {/* Form tambah bilik */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: '#EEF3FF', border: '2px solid #111827' }}>
              <div className="text-xs font-bold text-sky-400">➕ Tambah Bilik Baru</div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nama Bilik *</label>
                <input value={formBilik.nama} onChange={e => setFormBilik(f => ({ ...f, nama: e.target.value }))}
                  placeholder="Contoh: Makmal ICT 3"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ikon</label>
                  <select value={formBilik.icon} onChange={e => setFormBilik(f => ({ ...f, icon: e.target.value }))}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400">
                    {ICON_LIST.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Kapasiti</label>
                  <input value={formBilik.kapasiti} onChange={e => setFormBilik(f => ({ ...f, kapasiti: e.target.value }))}
                    placeholder="30 pelajar"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
              <button onClick={tambahBilik}
                className="w-full py-2.5 rounded-xl text-xs font-black neo-btn"
                style={{ background: '#2563EB', color: '#fff' }}>
                ➕ Tambah Bilik
              </button>
            </div>

            {/* Senarai bilik */}
            <div className="space-y-2">
              {bilikList.map(b => (
                <div key={b.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <span className="text-xl">{b.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-900">{b.nama}</div>
                    <div className="text-xs text-gray-500">{b.kapasiti}</div>
                  </div>
                  <button onClick={() => deleteBilik(b.id)}
                    className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-900/30 transition-colors">
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        </AdminGate>
      )}

      {/* ── MODAL ── */}
      {modal && (
        <ModalTempahan
          modal={modal} isAdmin={isAdmin} bilikList={bilikList}
          STATUS_CONFIG={STATUS_CONFIG} TODAY={TODAY}
          PAGI_STARTS={PAGI_STARTS} PAGI_ENDS={PAGI_ENDS}
          PETANG_STARTS={PETANG_STARTS} PETANG_ENDS={PETANG_ENDS}
          toMins={toMins} durasiLabel={durasiLabel}
          onClose={() => setModal(null)}
          onApprove={id => updateStatus(id, 'approved')}
          onReject={id => updateStatus(id, 'rejected')}
          onDelete={id => deleteTempahan(id)}
          onEdit={async (id, data) => {
            const { error } = await supabase.from('tempahan_bilik').update(data).eq('id', id)
            if (error) { showToast('Ralat: ' + error.message, 'error'); return }
            showToast('✅ Tempahan berjaya dikemaskini!')
            setModal(null)
            fetchTempahan()
          }}
        />
      )}

    </Layout>
  )
}

function ModalTempahan({ modal, isAdmin, bilikList, STATUS_CONFIG, TODAY, PAGI_STARTS, PAGI_ENDS, PETANG_STARTS, PETANG_ENDS, toMins, durasiLabel, onClose, onApprove, onReject, onDelete, onEdit }) {
  const [editMode, setEditMode] = useState(false)
  const [ed, setEd] = useState(null)

  const availTamat = (() => {
    if (!ed?.masa_mula) return []
    const isPagi = PAGI_STARTS.includes(ed.masa_mula)
    const ends = isPagi ? PAGI_ENDS : PETANG_ENDS
    return ends.filter(e => toMins(e) > toMins(ed.masa_mula))
  })()

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        style={{ border: '3px solid #111827', borderBottom: 'none' }}>
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-4">
          <div className="text-base font-bold text-sky-400">Detail Tempahan</div>
          {isAdmin && !editMode && (
            <button onClick={() => {
              const [mula, tamat] = (modal.masa || '–').split('–')
              setEd({ guru: modal.guru, bilik: modal.bilik, tarikh: modal.tarikh, masa_mula: mula?.trim() || '', masa_tamat: tamat?.trim() || '', tujuan: modal.tujuan || '' })
              setEditMode(true)
            }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold neo-btn"
              style={{ background: '#EFF6FF', color: '#2563EB' }}>
              ✏️ Edit
            </button>
          )}
        </div>

        {editMode && ed ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nama Guru</label>
              <input value={ed.guru} onChange={e => setEd(d => ({ ...d, guru: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bilik</label>
              <select value={ed.bilik} onChange={e => setEd(d => ({ ...d, bilik: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-400">
                {bilikList.map(b => <option key={b.id}>{b.nama}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tarikh</label>
              <input type="date" value={ed.tarikh} min={TODAY}
                onChange={e => setEd(d => ({ ...d, tarikh: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Masa Mula</label>
                <select value={ed.masa_mula} onChange={e => setEd(d => ({ ...d, masa_mula: e.target.value, masa_tamat: '' }))}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-400">
                  <option value="">-- Pilih --</option>
                  <optgroup label="☀️ Pagi">{PAGI_STARTS.map(t => <option key={t}>{t}</option>)}</optgroup>
                  <optgroup label="🌙 Petang">{PETANG_STARTS.map(t => <option key={t}>{t}</option>)}</optgroup>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Masa Tamat</label>
                <select value={ed.masa_tamat} disabled={!ed.masa_mula}
                  onChange={e => setEd(d => ({ ...d, masa_tamat: e.target.value }))}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-400 disabled:opacity-50">
                  <option value="">-- Pilih --</option>
                  {availTamat.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {ed.masa_mula && ed.masa_tamat && (
              <div className="text-xs text-sky-600 font-semibold">
                ⏱️ {durasiLabel(ed.masa_mula, ed.masa_tamat)}
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tujuan</label>
              <textarea value={ed.tujuan} rows={2} onChange={e => setEd(d => ({ ...d, tujuan: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-sky-400 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(modal.id, { ...ed, masa: `${ed.masa_mula}–${ed.masa_tamat}` })}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold neo-btn"
                style={{ background: '#2563EB', color: '#fff' }}>
                💾 Simpan
              </button>
              <button onClick={() => { setEditMode(false); setEd(null) }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold neo-btn"
                style={{ background: '#F1F5F9', color: '#64748B' }}>
                Batal
              </button>
            </div>
          </div>
        ) : (
          <>
            {[
              ['Guru', modal.guru],
              ['Bilik', modal.bilik],
              ['Tarikh', modal.tarikh],
              ['Masa', modal.masa],
              ['Tujuan', modal.tujuan || '—'],
              ['Status', STATUS_CONFIG[modal.status]?.label ?? modal.status],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-xs text-gray-500">{k}</span>
                <span className="text-xs font-bold text-gray-900">{v}</span>
              </div>
            ))}
            {modal.status === 'pending' && isAdmin && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => onApprove(modal.id)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold neo-btn"
                  style={{ background: '#DCFCE7', color: '#059669' }}>
                  ✅ Luluskan
                </button>
                <button onClick={() => onReject(modal.id)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold neo-btn"
                  style={{ background: '#FEE2E2', color: '#DC2626' }}>
                  ❌ Tolak
                </button>
              </div>
            )}
            {isAdmin && (
              <button onClick={() => onDelete(modal.id)}
                className="w-full mt-3 py-2.5 rounded-xl text-sm font-bold neo-btn"
                style={{ background: '#FEE2E2', color: '#DC2626' }}>
                🗑️ Padam Rekod
              </button>
            )}
            <button onClick={onClose}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-bold neo-btn"
              style={{ background: '#F1F5F9', color: '#64748B' }}>
              Tutup
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function nowMins() {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

function JadualRow({ slot, bilikList, tempahan, tarikh, getTutupInfo, onBook }) {
  const [startStr, endStr] = slot.masa.split('–')
  const isNow = tarikh === TODAY &&
    nowMins() >= toMins(startStr) && nowMins() < toMins(endStr)

  return (
    <tr className={isNow ? 'bg-sky-50' : 'hover:bg-gray-50 transition-colors'}>
      <td className={`px-2 py-2 border-b border-r border-gray-200 sticky left-0 ${
        isNow ? 'bg-sky-50' : 'bg-white'
      }`}>
        <div className={`text-[10px] font-bold leading-none ${isNow ? 'text-sky-600' : 'text-gray-400'}`}>
          {slot.label}{isNow ? ' ←' : ''}
        </div>
        <div className={`text-xs font-semibold mt-0.5 leading-tight ${isNow ? 'text-sky-700' : 'text-gray-600'}`}>
          {startStr}
        </div>
        <div className="text-[10px] text-gray-400 leading-none">–{endStr}</div>
      </td>
      {bilikList.map(bilik => {
        const tutup = getTutupInfo(bilik.nama, tarikh)
        if (tutup) {
          return (
            <td key={bilik.nama} className="p-1 border-b border-r border-gray-200">
              <div className="rounded-lg min-h-[44px] flex items-center justify-center bg-red-50 border border-red-100">
                <span className="text-[10px] text-red-300">🚫</span>
              </div>
            </td>
          )
        }
        const booking = tempahan.find(t =>
          t.bilik?.trim().toLowerCase() === bilik.nama?.trim().toLowerCase() &&
          t.tarikh === tarikh && slotDalamRange(t.masa, slot.masa)
        )
        if (!booking) {
          return (
            <td key={bilik.nama} className="p-1 border-b border-r border-gray-200 text-center">
              <button onClick={() => onBook(bilik.nama, slot.masa)}
                className="w-full min-h-[44px] rounded-lg text-base text-gray-300 hover:bg-sky-50 hover:text-sky-400 active:bg-sky-100 transition-all flex items-center justify-center">
                +
              </button>
            </td>
          )
        }
        const isApproved = booking.status === 'approved'
        const isPending  = booking.status === 'pending'
        return (
          <td key={bilik.nama} className="p-1 border-b border-r border-gray-200">
            <div className={`rounded-lg px-1 py-1.5 text-center border min-h-[44px] flex flex-col items-center justify-center ${
              isApproved ? 'bg-emerald-50 border-emerald-200' :
              isPending  ? 'bg-amber-50 border-amber-200' :
                           'bg-red-50 border-red-200'
            }`}>
              <div className={`text-[10px] font-bold leading-tight line-clamp-2 w-full text-center ${
                isApproved ? 'text-emerald-800' : isPending ? 'text-amber-800' : 'text-red-800'
              }`}>{booking.guru}</div>
              <div className={`text-[10px] mt-0.5 font-medium ${
                isApproved ? 'text-emerald-600' : isPending ? 'text-amber-500' : 'text-red-500'
              }`}>
                {isApproved ? '✓' : isPending ? '⏳' : '✗'}
              </div>
            </div>
          </td>
        )
      })}
    </tr>
  )
}
