import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { todayLocal, monthLocal } from '../lib/dateUtil'

const MONTHS_MS = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogs','Sep','Okt','Nov','Dis']

function getMonthlyData(records, dateField = 'created_at', months = 6) {
  const now = new Date()
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const label = MONTHS_MS[d.getMonth()]
    const count = records.filter(r => {
      const rd = new Date(r[dateField])
      return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth()
    }).length
    return { label, count }
  })
}

const DONUT_COLORS = ['#4A9EFF', '#2ECC71', '#F5A623', '#E74C3C', '#9B59B6']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
      className="rounded-xl px-3 py-2 text-xs">
      <div className="mb-1" style={{ color: '#6B7280' }}>{label}</div>
      <div className="font-bold" style={{ color: '#111827' }}>{payload[0].value}</div>
    </div>
  )
}

export default function DashboardUtama() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tempahan, setTempahan] = useState([])
  const [peminjaman, setPeminjaman] = useState([])
  const [barang, setBarang] = useState([])
  const [guru, setGuru] = useState([])
  const [murid, setMurid] = useState([])
  const [showLaporan, setShowLaporan] = useState(false)
  const [bulanLaporan, setBulanLaporan] = useState(monthLocal())
  const [bilikTutup, setBilikTutup] = useState([])

  useEffect(() => {
    async function fetchAll() {
      const [t, p, b, g, m, bt] = await Promise.all([
        supabase.from('tempahan_bilik').select('*').order('created_at', { ascending: false }),
        supabase.from('peminjaman_ict').select('*').order('created_at', { ascending: false }),
        supabase.from('barang_ict').select('*'),
        supabase.from('guru_delima').select('*'),
        supabase.from('murid_delima').select('*'),
        supabase.from('bilik_tutup').select('*').order('tarikh_mula'),
      ])
      setTempahan(t.data ?? [])
      setPeminjaman(p.data ?? [])
      setBarang(b.data ?? [])
      setGuru(g.data ?? [])
      setMurid(m.data ?? [])
      setBilikTutup(bt.data ?? [])
      setLoading(false)
    }
    fetchAll()

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tempahan_bilik' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'peminjaman_ict' }, fetchAll)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const TODAY = todayLocal()
  const pendingTempahan = tempahan.filter(t => t.status === 'pending').length
  const approvedTempahan = tempahan.filter(t => t.status === 'approved').length
  const lewatICT = peminjaman.filter(p => p.status === 'lewat' || (p.status === 'dipinjam' && p.tarikh_pulang < TODAY)).length
  const dipinjamICT = peminjaman.filter(p => p.status === 'dipinjam').length
  const guruAktif = guru.filter(g => g.status === 'aktif').length
  const muridAktif = murid.filter(m => m.status === 'aktif').length
  const todayTempahan = tempahan.filter(t => t.tarikh === TODAY).length

  // Chart data
  const tempahanTrend = getMonthlyData(tempahan, 'created_at', 6)
  const peminjamanTrend = getMonthlyData(peminjaman, 'created_at', 6)

  const ictBarData = barang.slice(0, 6).map(b => ({
    label: b.nama?.length > 10 ? b.nama.slice(0, 10) + '…' : b.nama,
    tersedia: b.tersedia,
    dipinjam: b.kuantiti - b.tersedia,
  }))

  const delimaDonut = [
    { name: 'Guru Aktif',    value: guruAktif },
    { name: 'Murid Aktif',   value: muridAktif },
    { name: 'Akaun Dikunci', value: murid.filter(m => m.status === 'kunci').length },
    { name: 'Tidak Aktif',   value: [...guru, ...murid].filter(x => x.status === 'tidak_aktif').length },
  ].filter(d => d.value > 0)

  const closuresToday = bilikTutup.filter(t => {
    if (TODAY < t.tarikh_mula || TODAY > t.tarikh_tamat) return false
    if (t.masa_mula && t.masa_tamat) {
      const now = new Date()
      const nowM = now.getHours() * 60 + now.getMinutes()
      const [sh, sm] = t.masa_mula.split(':').map(Number)
      const [eh, em] = t.masa_tamat.split(':').map(Number)
      return nowM >= sh * 60 + sm && nowM < eh * 60 + em
    }
    return true
  })

  const alerts = [
    pendingTempahan > 0 && {
      color: '#D97706', bg: '#FFFBEB', border: '#FDE68A',
      icon: '🏫', title: `${pendingTempahan} Tempahan Menunggu Kelulusan`,
      desc: 'Semak dan luluskan permohonan bilik khas.', route: '/tempahan',
    },
    lewatICT > 0 && {
      color: '#DC2626', bg: '#FEF2F2', border: '#FECACA',
      icon: '⚠️', title: `${lewatICT} Barang ICT Lewat Dipulangkan`,
      desc: 'Hubungi peminjam untuk pulangkan barang segera.', route: '/ict',
    },
    ...closuresToday.map(t => ({
      color: '#DC2626', bg: '#FFF1F2', border: '#FCA5A5',
      icon: '🚫',
      title: `${t.bilik} — ${t.masa_mula ? `Ditutup Sementara (${t.masa_mula}–${t.masa_tamat})` : 'Ditutup / Penyelenggaraan'}`,
      desc: t.sebab || (t.masa_mula ? 'Penutupan sementara hari ini.' : `${t.tarikh_mula} → ${t.tarikh_tamat}`),
      route: '/tempahan',
    })),
  ].filter(Boolean)

  const kpiCards = [
    {
      num: barang.length,
      label: 'Jenis Barang ICT',
      sub: `${dipinjamICT} sedang dipinjam`,
      bg: '#DBEAFE', color: '#1D4ED8',
      icon: '💻',
    },
    {
      num: pendingTempahan + lewatICT,
      label: 'Perlu Tindakan',
      sub: pendingTempahan + lewatICT > 0 ? 'Ada item mendesak' : 'Tiada tindakan perlu',
      bg: pendingTempahan + lewatICT > 0 ? '#FEF3C7' : '#DCFCE7',
      color: pendingTempahan + lewatICT > 0 ? '#D97706' : '#059669',
      icon: '⚡',
    },
    {
      num: guruAktif + muridAktif,
      label: 'Pengguna DELIMA',
      sub: `${guruAktif} guru • ${muridAktif} murid`,
      bg: '#EDE9FE', color: '#7C3AED',
      icon: '👥',
    },
    {
      num: approvedTempahan,
      label: 'Tempahan Diluluskan',
      sub: `${todayTempahan} tempahan hari ini`,
      bg: '#DCFCE7', color: '#059669',
      icon: '✅',
    },
  ]

  if (loading) {
    return (
      <Layout badgeCounts={{ tempahan: pendingTempahan, ict: lewatICT }}>
        <div className="flex items-center justify-center h-64">
          <div className="text-sm animate-pulse" style={{ color: '#6B7280' }}>Memuatkan data...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout badgeCounts={{ tempahan: pendingTempahan, ict: lewatICT }}>

      {/* ── ALERTS ── */}
      {alerts.length > 0 && (
        <div className="space-y-2.5">
          {alerts.map((a, i) => (
            <div key={i} className="neo-card flex items-center gap-3 px-4 py-3 animate-slide-up"
              style={{ background: a.bg, animationDelay: `${i * 0.1}s` }}>
              <span className="text-xl flex-shrink-0">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black" style={{ fontFamily: "'Fredoka', sans-serif", color: '#111827' }}>{a.title}</div>
                <div className="text-xs mt-0.5 italic font-semibold" style={{ color: '#64748B' }}>{a.desc}</div>
              </div>
              <button onClick={() => navigate(a.route)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 neo-btn"
                style={{ background: a.color, color: '#fff' }}>
                Urus →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((k, i) => (
          <div key={i} className="neo-card animate-fade-up p-5"
            style={{ background: k.bg, animationDelay: `${i * 0.07}s` }}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl mb-3"
              style={{ background: 'rgba(255,255,255,0.6)', border: '2px solid #111827' }}>
              {k.icon}
            </div>
            <div className="text-3xl font-black" style={{ fontFamily: "'JetBrains Mono', monospace", color: k.color }}>{k.num}</div>
            <div className="text-xs font-black mt-1" style={{ fontFamily: "'Fredoka', sans-serif", color: '#111827', fontSize: 13 }}>{k.label}</div>
            <div className="text-xs mt-0.5 italic font-semibold" style={{ color: '#64748B' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── AKTIVITI TERKINI ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Tempahan terkini */}
        <div className="neo-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: '#111827' }}>🏫 Tempahan Terkini</div>
            <button onClick={() => navigate('/tempahan')}
              className="text-xs font-semibold hover:text-white transition-colors"
              style={{ color: '#4A9EFF' }}>
              Lihat semua →
            </button>
          </div>
          <div className="space-y-2">
            {tempahan.slice(0, 5).map(t => {
              const colors = { approved: '#2ECC71', pending: '#F5A623', rejected: '#E74C3C' }
              const labels = { approved: 'Lulus', pending: 'Tunggu', rejected: 'Tolak' }
              const c = colors[t.status] ?? '#F5A623'
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                  style={{ background: '#F0F7FF' }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: '#1E3A8A' }}>{t.guru}</div>
                    <div className="text-xs truncate italic" style={{ color: '#64748B' }}>{t.bilik} • {t.tarikh} • {t.masa}</div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: c + '22', color: c }}>
                    {labels[t.status] ?? 'Tunggu'}
                  </span>
                </div>
              )
            })}
            {tempahan.length === 0 && (
              <div className="text-center py-6 text-xs" style={{ color: '#9CA3AF' }}>Tiada rekod tempahan</div>
            )}
          </div>
        </div>

        {/* ICT terkini */}
        <div className="neo-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: '#111827' }}>💻 Peminjaman ICT Terkini</div>
            <button onClick={() => navigate('/ict')}
              className="text-xs font-semibold hover:text-white transition-colors"
              style={{ color: '#9B59B6' }}>
              Lihat semua →
            </button>
          </div>
          <div className="space-y-2">
            {peminjaman.slice(0, 5).map(p => {
              const colors = { dipinjam: '#4A9EFF', lewat: '#E74C3C', dipulangkan: '#2ECC71', pending: '#F5A623' }
              const labels = { dipinjam: 'Dipinjam', lewat: 'Lewat', dipulangkan: 'Pulang', pending: 'Tunggu' }
              const c = colors[p.status] ?? '#4A9EFF'
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: '#F0F7FF' }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: '#1E3A8A' }}>{p.peminjam}</div>
                    <div className="text-xs truncate italic" style={{ color: '#64748B' }}>{p.barang} • Pulang: {p.tarikh_pulang}</div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: c + '22', color: c }}>
                    {labels[p.status] ?? 'Dipinjam'}
                  </span>
                </div>
              )
            })}
            {peminjaman.length === 0 && (
              <div className="text-center py-6 text-xs" style={{ color: '#9CA3AF' }}>Tiada rekod peminjaman</div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3 SISTEM CARDS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {[
          {
            label: 'Tempahan Bilik Khas', icon: '🏫', route: '/tempahan',
            gradient: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
            stats: [
              { num: tempahan.length, label: 'Jumlah' },
              { num: pendingTempahan, label: 'Pending' },
              { num: todayTempahan,   label: 'Hari Ini' },
            ],
          },
          {
            label: 'Peminjaman Barang ICT', icon: '💻', route: '/ict',
            gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            stats: [
              { num: barang.length, label: 'Jenis' },
              { num: dipinjamICT,   label: 'Dipinjam' },
              { num: lewatICT,      label: 'Lewat' },
            ],
          },
          {
            label: 'Pengurusan ID DELIMA', icon: '🌺', route: '/delima',
            gradient: 'linear-gradient(135deg, #f43f5e, #ec4899)',
            stats: [
              { num: guru.length,       label: 'Guru' },
              { num: murid.length,      label: 'Murid' },
              { num: guruAktif + muridAktif, label: 'Aktif' },
            ],
          },
        ].map((s, i) => (
          <div key={i} onClick={() => navigate(s.route)}
            className="neo-card overflow-hidden cursor-pointer">
            <div className="p-5" style={{ background: s.gradient }}>
              <div className="flex items-start justify-between">
                <span className="text-3xl">{s.icon}</span>
                <span className="text-xs font-bold bg-white/20 text-white px-2.5 py-1 rounded-full">Buka →</span>
              </div>
              <div className="mt-3 text-base font-bold text-white leading-tight">{s.label}</div>
            </div>
            <div className="grid grid-cols-3 divide-x px-1 py-3"
              style={{ borderTop: '1px solid var(--border)', borderColor: 'rgba(255,255,255,0.06)' }}>
              {s.stats.map((st, j) => (
                <div key={j} className="text-center px-2">
                  <div className="text-xl font-black" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#111827' }}>{st.num}</div>
                  <div className="text-xs mt-0.5 italic font-semibold" style={{ color: '#64748B' }}>{st.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── CHARTS ROW 1: Trend Tempahan + Trend Peminjaman ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <div className="neo-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold" style={{ color: '#111827' }}>Trend Tempahan Bilik</div>
              <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>6 bulan lepas</div>
            </div>
            <span className="text-xl">🏫</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={tempahanTrend}>
              <defs>
                <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4A9EFF" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#4A9EFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="count" stroke="#4A9EFF" strokeWidth={2}
                fill="url(#blueGrad)" dot={{ fill: '#4A9EFF', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="neo-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold" style={{ color: '#111827' }}>Trend Peminjaman ICT</div>
              <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>6 bulan lepas</div>
            </div>
            <span className="text-xl">💻</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={peminjamanTrend}>
              <defs>
                <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9B59B6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#9B59B6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="count" stroke="#9B59B6" strokeWidth={2}
                fill="url(#purpleGrad)" dot={{ fill: '#9B59B6', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── CHARTS ROW 2: Bar Inventori + Donut DELIMA ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <div className="neo-card lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold" style={{ color: '#111827' }}>Status Inventori ICT</div>
              <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Tersedia vs Dipinjam</div>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: '#6B7280' }}>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#4A9EFF] inline-block" />Tersedia</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F5A623] inline-block" />Dipinjam</span>
            </div>
          </div>
          {ictBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={ictBarData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="tersedia" fill="#4A9EFF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dipinjam" fill="#F5A623" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-xs" style={{ color: '#9CA3AF' }}>
              Tiada data inventori
            </div>
          )}
        </div>

        <div className="neo-card p-5">
          <div className="mb-4">
            <div className="text-sm font-semibold" style={{ color: '#111827' }}>Pengguna DELIMA</div>
            <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Taburan status</div>
          </div>
          {delimaDonut.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={delimaDonut} cx="50%" cy="50%" innerRadius={38} outerRadius={58}
                    dataKey="value" paddingAngle={3}>
                    {delimaDonut.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {delimaDonut.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5" style={{ color: '#6B7280' }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      {d.name}
                    </span>
                    <span className="font-bold text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-xs" style={{ color: '#9CA3AF' }}>
              Tiada data DELIMA
            </div>
          )}
        </div>
      </div>

      {/* ── LAPORAN BULANAN ── */}
      <div className="neo-card overflow-hidden">
        <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => setShowLaporan(v => !v)}>
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <div>
              <div className="text-sm font-semibold" style={{ color: '#111827' }}>Laporan Bulanan</div>
              <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Jana laporan ringkasan untuk fail / pengetua</div>
            </div>
          </div>
          <span className="text-gray-400 text-sm">{showLaporan ? '▲' : '▼'}</span>
        </div>

        {showLaporan && (() => {
          const [tahun, bulan] = bulanLaporan.split('-').map(Number)
          const labelBulan = new Date(tahun, bulan - 1).toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' })
          const tBulan = tempahan.filter(t => t.tarikh?.startsWith(bulanLaporan))
          const pBulan = peminjaman.filter(p => p.tarikh_pinjam?.startsWith(bulanLaporan))

          return (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="flex items-center justify-between mt-4 mb-5 no-print">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-gray-600">Bulan:</label>
                  <input type="month" value={bulanLaporan}
                    onChange={e => setBulanLaporan(e.target.value)}
                    className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400" />
                </div>
                <button onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                  🖨️ Print Laporan
                </button>
              </div>

              {/* Print header */}
              <div className="laporan-header mb-6 text-center border-b border-gray-200 pb-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">LAPORAN BULANAN ICT</div>
                <div className="text-lg font-black text-gray-900 mt-1">Sekolah Kebangsaan Darau</div>
                <div className="text-xs text-gray-500">Kota Kinabalu, Sabah</div>
                <div className="text-sm font-semibold text-indigo-600 mt-2">{labelBulan}</div>
                <div className="text-xs text-gray-400 mt-1">Disediakan oleh: En. Khairul Azwani bin Haji Ahinin, Guru ICT</div>
              </div>

              {/* Ringkasan */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Tempahan Diluluskan', num: tBulan.filter(t => t.status === 'approved').length, color: 'text-emerald-600' },
                  { label: 'Tempahan Pending', num: tBulan.filter(t => t.status === 'pending').length, color: 'text-amber-600' },
                  { label: 'Peminjaman ICT', num: pBulan.length, color: 'text-blue-600' },
                  { label: 'Dipulangkan', num: pBulan.filter(p => p.status === 'dipulangkan').length, color: 'text-emerald-600' },
                ].map((s, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-3 text-center">
                    <div className={`text-2xl font-black ${s.color}`}>{s.num}</div>
                    <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Tempahan table */}
              <div className="mb-6">
                <div className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">🏫 Rekod Tempahan Bilik Khas</div>
                {tBulan.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr style={{ background: '#F3F4F6' }}>
                          {['Guru', 'Bilik', 'Tarikh', 'Masa', 'Status'].map(h => (
                            <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tBulan.map(t => (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 border border-gray-100 text-gray-900 font-medium">{t.guru}</td>
                            <td className="px-3 py-2 border border-gray-100 text-gray-600">{t.bilik}</td>
                            <td className="px-3 py-2 border border-gray-100 text-gray-600">{t.tarikh}</td>
                            <td className="px-3 py-2 border border-gray-100 text-gray-600 font-mono">{t.masa}</td>
                            <td className="px-3 py-2 border border-gray-100">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                                t.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                t.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                                                          'bg-red-100 text-red-700'
                              }`}>
                                {t.status === 'approved' ? 'Lulus' : t.status === 'pending' ? 'Tunggu' : 'Tolak'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic py-3">Tiada rekod tempahan untuk bulan ini.</div>
                )}
              </div>

              {/* Peminjaman table */}
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">💻 Rekod Peminjaman Barang ICT</div>
                {pBulan.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr style={{ background: '#F3F4F6' }}>
                          {['Peminjam', 'Jawatan', 'Barang', 'Tarikh Pinjam', 'Tarikh Pulang', 'Status'].map(h => (
                            <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pBulan.map(p => {
                          const sc = { dipinjam: 'bg-blue-100 text-blue-700', dipulangkan: 'bg-emerald-100 text-emerald-700', lewat: 'bg-red-100 text-red-700' }
                          const sl = { dipinjam: 'Dipinjam', dipulangkan: 'Dipulangkan', lewat: 'Lewat' }
                          return (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 border border-gray-100 text-gray-900 font-medium">{p.peminjam}</td>
                              <td className="px-3 py-2 border border-gray-100 text-gray-600">{p.jawatan || '—'}</td>
                              <td className="px-3 py-2 border border-gray-100 text-gray-600">{p.barang}</td>
                              <td className="px-3 py-2 border border-gray-100 text-gray-600">{p.tarikh_pinjam}</td>
                              <td className="px-3 py-2 border border-gray-100 text-gray-600">{p.tarikh_pulang || '—'}</td>
                              <td className="px-3 py-2 border border-gray-100">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${sc[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {sl[p.status] ?? p.status}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic py-3">Tiada rekod peminjaman untuk bulan ini.</div>
                )}
              </div>

              {/* Inventori summary */}
              <div>
                <div className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">📦 Status Inventori ICT</div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ background: '#F3F4F6' }}>
                      {['Barang', 'Kod', 'Jumlah', 'Tersedia'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {barang.map(b => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 border border-gray-100 text-gray-900 font-medium">{b.nama}</td>
                        <td className="px-3 py-2 border border-gray-100 text-gray-500 font-mono">{b.kod}</td>
                        <td className="px-3 py-2 border border-gray-100 text-gray-600">{b.kuantiti}</td>
                        <td className="px-3 py-2 border border-gray-100">
                          <span className={`font-bold ${b.tersedia === 0 ? 'text-red-600' : 'text-emerald-600'}`}>{b.tersedia}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}
      </div>

    </Layout>
  )
}
