import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import SectionHeader from '../components/SectionHeader'
import AdminGate from '../components/AdminGate'
import { useAdmin } from '../contexts/AdminContext'

const STATUS_GURU = {
  aktif:       { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Aktif' },
  tidak_aktif: { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Tidak Aktif' },
  cuti:        { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Cuti' },
}

const STATUS_MURID = {
  aktif:         { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Aktif' },
  kunci:         { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Dikunci' },
  tukar_sekolah: { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Tukar Sekolah' },
  tidak_aktif:   { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Tidak Aktif' },
}

const GRED_LIST = ['DG29','DG32','DG34','DG38','DG41','DG44','DG48','DG52','DG54']

const DEFAULT_KELAS = {
  '1': ['1 Unik', '1 Aplikasi', '1 Revolusi', '1 Aspirasi', '1 Dedikasi'],
  '2': ['2 Unik', '2 Aplikasi', '2 Revolusi', '2 Aspirasi', '2 Dedikasi'],
  '3': ['3 Unik', '3 Aplikasi', '3 Revolusi', '3 Aspirasi', '3 Dedikasi'],
  '4': ['4 Unik', '4 Aplikasi', '4 Revolusi', '4 Aspirasi', '4 Dedikasi'],
  '5': ['5 Unik', '5 Aplikasi', '5 Revolusi', '5 Aspirasi', '5 Dedikasi'],
  '6': ['6 Unik', '6 Aplikasi', '6 Revolusi', '6 Aspirasi', '6 Dedikasi'],
}

const generatePassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function StatusBadge({ status, map }) {
  const s = map[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status }
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${s.bg} ${s.text}`}>{s.label}</span>
}

export default function SistemIDDelima() {
  const { isAdmin } = useAdmin()
  const [tab, setTab]       = useState('dashboard')
  const [subTab, setSubTab] = useState('guru')
  const [guru, setGuru]     = useState([])
  const [murid, setMurid]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(null)
  const [toast, setToast]   = useState(null)
  const [carian, setCarian] = useState('')

  const [formGuru, setFormGuru] = useState({ nama: '', no_pekerja: '', email: '', no_tel: '', subjek: '', gred: 'DG41' })
  const [formMurid, setFormMurid] = useState({ nama: '', no_kad: '', email: '', kelas: '', jantina: 'L' })
  const [pwForm, setPwForm] = useState({ baru: '', sahkan: '', show: false })
  const [importing, setImporting] = useState(false)
  const importGuruRef  = useRef(null)
  const importMuridRef = useRef(null)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState(null)

  const [kelasConfig, setKelasConfig] = useState(DEFAULT_KELAS)
  const [kelasEdit, setKelasEdit] = useState(null)

  const allKelasFlat = ['1','2','3','4','5','6'].flatMap(t => kelasConfig[t] ?? [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  async function saveKelasEdit() {
    const { error } = await supabase.from('app_settings')
      .upsert({ key: 'kelas_config', value: kelasEdit }, { onConflict: 'key' })
    if (error) { showToast('Ralat: ' + error.message, 'error'); return }
    setKelasConfig(kelasEdit)
    setKelasEdit(null)
    showToast('✅ Nama kelas berjaya disimpan!')
  }

  async function fetchKelasConfig() {
    const { data } = await supabase.from('app_settings')
      .select('value').eq('key', 'kelas_config').single()
    if (data?.value) setKelasConfig(data.value)
  }

  function exportCSV(jenis) {
    const data = jenis === 'guru' ? guru : murid
    const headers = jenis === 'guru'
      ? ['id_delima','nama','no_pekerja','email','no_tel','subjek','gred','status']
      : ['id_delima','nama','no_kad','email','kelas','jantina','status']
    const escape = v => `"${(v ?? '').toString().replace(/"/g, '""')}"`
    const rows = data.map(d => headers.map(h => escape(d[h])).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `delima_${jenis}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  function downloadTemplate(jenis) {
    const headers = jenis === 'guru'
      ? 'id_delima,nama,no_pekerja,email,no_tel,subjek,gred,status'
      : 'id_delima,nama,no_kad,email,kelas,jantina,status'
    const sample = jenis === 'guru'
      ? 'AIR2024001,Ahmad bin Ali,G10001,ahmad@moe.edu.my,0123456789,Matematik,DG41,aktif'
      : 'MR2024001,Siti binti Abu,010101010101,siti@murid.edu.my,6 Arif,P,aktif'
    const blob = new Blob(['﻿' + [headers, sample].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `template_${jenis}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  function parseCSV(text) {
    const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim().split('\n')
    if (lines.length < 2) return []
    const parseRow = line => {
      const result = []; let cur = '', inQ = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++ } else inQ = !inQ }
        else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
        else cur += ch
      }
      result.push(cur.trim()); return result
    }
    const headers = parseRow(lines[0])
    return lines.slice(1).map(line => {
      const vals = parseRow(line); const obj = {}
      headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
      return obj
    }).filter(r => r.nama?.trim())
  }

  async function importCSV(jenis, e) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''; setImporting(true)
    try {
      const text = await file.text(); const rows = parseCSV(text)
      if (!rows.length) { showToast('Tiada data dalam fail CSV!', 'error'); return }
      const table = jenis === 'guru' ? 'guru_delima' : 'murid_delima'
      const toInsert = rows.map(r => ({ ...r, status: r.status || 'aktif', last_login: r.last_login || '—' }))
      const { error } = await supabase.from(table).upsert(toInsert, { onConflict: 'id_delima' })
      if (error) { showToast('Ralat import: ' + error.message, 'error'); return }
      showToast(`✅ ${toInsert.length} rekod berjaya diimport!`); fetchData()
    } finally { setImporting(false) }
  }

  async function fetchData() {
    setLoading(true)
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from('guru_delima').select('*').order('nama'),
      supabase.from('murid_delima').select('*').order('nama'),
    ])
    setGuru(g ?? []); setMurid(m ?? []); setLoading(false)
  }

  useEffect(() => { fetchData(); fetchKelasConfig() }, [])

  const stats = {
    guruAktif:  guru.filter(g => g.status === 'aktif').length,
    muridAktif: murid.filter(m => m.status === 'aktif').length,
    dikunci:    murid.filter(m => m.status === 'kunci').length,
    tidakAktif: [...guru, ...murid].filter(x => x.status === 'tidak_aktif').length,
  }

  async function tambahGuru() {
    if (!formGuru.nama || !formGuru.no_pekerja || !formGuru.email) {
      showToast('Sila lengkapkan maklumat wajib!', 'error'); return
    }
    const id_delima = `AIR2024${String(guru.length + 1).padStart(3,'0')}`
    const { error } = await supabase.from('guru_delima').insert([{ ...formGuru, id_delima, status: 'aktif', last_login: '—' }])
    if (error) { showToast('Ralat: ' + error.message, 'error'); return }
    setFormGuru({ nama: '', no_pekerja: '', email: '', no_tel: '', subjek: '', gred: 'DG41' })
    showToast('✅ ID DELIMA guru berjaya didaftarkan!'); fetchData()
    setTab('senarai'); setSubTab('guru')
  }

  async function tambahMurid() {
    if (!formMurid.nama || !formMurid.no_kad || !formMurid.kelas) {
      showToast('Sila lengkapkan maklumat wajib!', 'error'); return
    }
    const id_delima = `MR2024${String(murid.length + 1).padStart(3,'0')}`
    const email = formMurid.email || `${formMurid.no_kad.replace(/-/g,'')}@murid.edu.my`
    const { error } = await supabase.from('murid_delima').insert([{ ...formMurid, id_delima, email, status: 'aktif', last_login: '—' }])
    if (error) { showToast('Ralat: ' + error.message, 'error'); return }
    setFormMurid({ nama: '', no_kad: '', email: '', kelas: '', jantina: 'L' })
    showToast('✅ ID DELIMA murid berjaya didaftarkan!'); fetchData()
    setTab('senarai'); setSubTab('murid')
  }

  async function editRecord(jenis, id, data) {
    const table = jenis === 'guru' ? 'guru_delima' : 'murid_delima'
    const { error } = await supabase.from(table).update(data).eq('id', id)
    if (error) { showToast('Ralat: ' + error.message, 'error'); return }
    showToast('✅ Rekod berjaya dikemaskini!'); setModal(null); fetchData()
  }

  async function deleteRecord(jenis, id) {
    const table = jenis === 'guru' ? 'guru_delima' : 'murid_delima'
    await supabase.from(table).delete().eq('id', id)
    setModal(null); showToast('🗑️ Rekod berjaya dipadam!'); fetchData()
  }

  async function toggleStatus(jenis, id, status) {
    const table = jenis === 'guru' ? 'guru_delima' : 'murid_delima'
    const { error } = await supabase.from(table).update({ status }).eq('id', id)
    if (error) { showToast('Ralat: ' + error.message, 'error'); return }
    setModal(null); showToast('✅ Status berjaya dikemaskini!'); fetchData()
  }

  function resetPassword(jenis, id) {
    const pw = generatePassword()
    showToast(`🔑 Password reset! Password baru: ${pw}`)
    setModal(null); setPwForm({ baru: '', sahkan: '', show: false })
  }

  const filteredGuru = guru.filter(g =>
    g.nama?.toLowerCase().includes(carian.toLowerCase()) ||
    g.id_delima?.toLowerCase().includes(carian.toLowerCase()) ||
    g.no_pekerja?.toLowerCase().includes(carian.toLowerCase())
  )

  const filteredMurid = murid.filter(m =>
    m.nama?.toLowerCase().includes(carian.toLowerCase()) ||
    m.id_delima?.toLowerCase().includes(carian.toLowerCase()) ||
    m.kelas?.toLowerCase().includes(carian.toLowerCase())
  )

  function openModal(jenis, data) {
    setPwForm({ baru: '', sahkan: '', show: false })
    setEditMode(false); setEditData(null); setModal({ jenis, data })
  }

  const TABS = [
    { id: 'dashboard', label: '🏠 Utama' },
    { id: 'daftar',    label: '➕ Daftar' },
    { id: 'senarai',   label: '👥 Senarai' },
    { id: 'admin',     label: '⚙️ Admin' },
  ]

  // Murid grouped by kelas
  function getMuridByKelas(kelasList) {
    return kelasList.map(k => ({
      kelas: k,
      senarai: filteredMurid.filter(m => m.kelas === k),
    }))
  }

  // Murid not in any configured class
  const muridLainLain = filteredMurid.filter(m => !allKelasFlat.includes(m.kelas))

  return (
    <Layout>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full text-sm font-semibold text-white shadow-xl transition-all max-w-sm text-center ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-blue-600'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Tab Nav */}
      <div className="tab-nav-sticky flex gap-1.5 rounded-2xl p-1.5 overflow-x-auto scrollbar-hide"
        style={{ background: '#FFFFFF', border: '2px solid #111827', boxShadow: '3px 3px 0 #111827' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setCarian('') }}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={tab === t.id
              ? { background: '#2563EB', color: '#fff', border: '1.5px solid #111827', boxShadow: '2px 2px 0 #111827' }
              : { background: 'transparent', color: '#64748B' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { num: stats.guruAktif,  label: 'Guru Aktif',    icon: '👨‍🏫', bg: '#EDE9FE', numColor: '#7C3AED' },
              { num: stats.muridAktif, label: 'Murid Aktif',   icon: '🎓',  bg: '#DBEAFE', numColor: '#1D4ED8' },
              { num: stats.dikunci,    label: 'Akaun Dikunci', icon: '🔒',  bg: '#FEE2E2', numColor: '#DC2626' },
              { num: stats.tidakAktif, label: 'Tidak Aktif',   icon: '⭕',  bg: '#F3F4F6', numColor: '#6B7280' },
            ].map((s, i) => (
              <div key={i} className="neo-card p-5 animate-fade-up" style={{ background: s.bg }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl mb-3"
                  style={{ background: 'rgba(255,255,255,0.6)' }}>{s.icon}</div>
                <div className="text-3xl font-black" style={{ color: s.numColor, fontFamily: "'JetBrains Mono', monospace" }}>{s.num}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {stats.dikunci > 0 && (
            <div className="rounded-2xl p-4 flex gap-3 items-start"
              style={{ background: '#FEE2E2', border: '3px solid #111827', boxShadow: '4px 4px 0 #111827', borderRadius: 20 }}>
              <span className="text-2xl">🔒</span>
              <div>
                <div className="text-sm font-bold text-red-700">{stats.dikunci} Akaun Dikunci</div>
                <div className="text-xs text-red-600 mt-1">Terdapat akaun murid yang perlu dibuka kunci.</div>
                <button onClick={() => { setTab('senarai'); setSubTab('murid') }}
                  className="mt-2 text-xs font-bold text-red-400 underline">
                  Urus sekarang →
                </button>
              </div>
            </div>
          )}

          {/* Guru preview */}
          <div className="neo-card p-5">
            <SectionHeader icon="👨‍🏫" title="ID DELIMA Guru" color="text-violet-400"
              onMore={() => { setTab('senarai'); setSubTab('guru') }} />
            <div className="space-y-2.5 mt-4">
              {guru.slice(0, 4).map(g => (
                <div key={g.id} onClick={() => openModal('guru', g)}
                  className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 cursor-pointer hover:bg-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate">{g.nama}</div>
                    <div className="text-xs font-mono text-gray-500">{g.id_delima} • {g.subjek}</div>
                  </div>
                  <StatusBadge status={g.status} map={STATUS_GURU} />
                </div>
              ))}
              {guru.length === 0 && !loading && (
                <div className="text-center text-xs text-gray-500 py-4">Tiada rekod guru</div>
              )}
            </div>
          </div>

          {/* Murid preview — public sees nama only */}
          <div className="neo-card p-5">
            <SectionHeader icon="🎓" title="ID DELIMA Murid" color="text-purple-400"
              onMore={() => { setTab('senarai'); setSubTab('murid') }} />
            <div className="space-y-2.5 mt-4">
              {murid.slice(0, 4).map(m => (
                <div key={m.id}
                  className={`flex items-center gap-3 bg-gray-50 rounded-xl p-3 ${isAdmin ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                  onClick={isAdmin ? () => openModal('murid', m) : undefined}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${m.jantina === 'P' ? 'bg-pink-50' : 'bg-blue-50'}`}>
                    {m.jantina === 'P' ? '👧' : '👦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate">{m.nama}</div>
                    {isAdmin && <div className="text-xs font-mono text-gray-500">{m.id_delima} • {m.kelas}</div>}
                  </div>
                  {isAdmin && <StatusBadge status={m.status} map={STATUS_MURID} />}
                </div>
              ))}
              {murid.length === 0 && !loading && (
                <div className="text-center text-xs text-gray-500 py-4">Tiada rekod murid</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── DAFTAR ── */}
      {tab === 'daftar' && (
        <>
          <div className="flex gap-2 rounded-2xl p-1.5"
            style={{ background: '#FFFFFF', border: '2px solid #111827', boxShadow: '3px 3px 0 #111827' }}>
            {['guru','murid'].map(s => (
              <button key={s} onClick={() => setSubTab(s)}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                style={subTab === s
                  ? { background: '#2563EB', color: '#fff', border: '1.5px solid #111827', boxShadow: '2px 2px 0 #111827' }
                  : { background: 'transparent', color: '#64748B' }}>
                {s === 'guru' ? '👨‍🏫 Daftar Guru' : '🎓 Daftar Murid'}
              </button>
            ))}
          </div>

          {subTab === 'guru' ? (
            <div className="neo-card p-5 space-y-4">
              <div className="text-sm font-bold text-violet-400">📝 Daftar ID DELIMA Guru Baru</div>
              {[
                { label: 'Nama Penuh *',  field: 'nama',       placeholder: 'Nama penuh guru' },
                { label: 'No. Pekerja *', field: 'no_pekerja', placeholder: 'Contoh: G10239' },
                { label: 'E-mel *',       field: 'email',      placeholder: 'nama@moe.edu.my' },
                { label: 'No. Telefon',   field: 'no_tel',     placeholder: '01x-xxxxxxx' },
                { label: 'Subjek',        field: 'subjek',     placeholder: 'Contoh: Sains' },
              ].map(f => (
                <div key={f.field}>
                  <label className="block text-xs font-semibold text-violet-400 mb-1.5">{f.label}</label>
                  <input value={formGuru[f.field]} onChange={e => setFormGuru(p => ({ ...p, [f.field]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-400" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-violet-400 mb-1.5">Gred</label>
                <select value={formGuru.gred} onChange={e => setFormGuru(p => ({ ...p, gred: e.target.value }))}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-violet-400">
                  {GRED_LIST.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="rounded-xl p-3 text-xs" style={{ background: '#EEF3FF', border: '2px solid #2563EB', color: '#1D4ED8' }}>
                ℹ️ ID DELIMA format AIR2024XXX akan dijana automatik.
              </div>
              <button onClick={tambahGuru}
                className="w-full py-3.5 rounded-2xl text-sm font-black neo-btn"
                style={{ background: '#2563EB', color: '#fff', fontFamily: "'Fredoka', sans-serif" }}>
                🔐 Jana ID DELIMA Guru
              </button>
            </div>
          ) : (
            <div className="neo-card p-5 space-y-4">
              <div className="text-sm font-bold text-violet-400">📝 Daftar ID DELIMA Murid Baru</div>
              {[
                { label: 'Nama Penuh *',        field: 'nama',   placeholder: 'Nama penuh murid' },
                { label: 'No. Kad Pengenalan *', field: 'no_kad', placeholder: 'xxxxxx-xx-xxxx' },
                { label: 'E-mel (jika ada)',     field: 'email',  placeholder: 'email@murid.edu.my' },
              ].map(f => (
                <div key={f.field}>
                  <label className="block text-xs font-semibold text-violet-400 mb-1.5">{f.label}</label>
                  <input value={formMurid[f.field]} onChange={e => setFormMurid(p => ({ ...p, [f.field]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-400" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-violet-400 mb-1.5">Kelas *</label>
                <select value={formMurid.kelas} onChange={e => setFormMurid(p => ({ ...p, kelas: e.target.value }))}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-violet-400">
                  <option value="">-- Pilih Kelas --</option>
                  {['1','2','3','4','5','6'].map(tahun => (
                    <optgroup key={tahun} label={`Tahun ${tahun}`}>
                      {(kelasConfig[tahun] ?? []).map(k => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-violet-400 mb-1.5">Jantina</label>
                <div className="flex gap-3">
                  {[{ val: 'L', label: '👦 Lelaki', bg: 'bg-blue-50 border-blue-300 text-blue-700' },
                    { val: 'P', label: '👧 Perempuan', bg: 'bg-pink-50 border-pink-300 text-pink-700' }].map(j => (
                    <button key={j.val} type="button"
                      onClick={() => setFormMurid(p => ({ ...p, jantina: j.val }))}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                        formMurid.jantina === j.val ? j.bg : 'border-gray-200 text-gray-400 bg-white'
                      }`}>
                      {j.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl p-3 text-xs" style={{ background: '#EEF3FF', border: '2px solid #2563EB', color: '#1D4ED8' }}>
                ℹ️ ID DELIMA format MR2024XXX. Default password: No. Kad (tanpa '-').
              </div>
              <button onClick={tambahMurid}
                className="w-full py-3.5 rounded-2xl text-sm font-black neo-btn"
                style={{ background: '#2563EB', color: '#fff', fontFamily: "'Fredoka', sans-serif" }}>
                🔐 Jana ID DELIMA Murid
              </button>
            </div>
          )}
        </>
      )}

      {/* ── SENARAI ── */}
      {tab === 'senarai' && (
        <>
          <input ref={importGuruRef}  type="file" accept=".csv" className="hidden" onChange={e => importCSV('guru', e)} />
          <input ref={importMuridRef} type="file" accept=".csv" className="hidden" onChange={e => importCSV('murid', e)} />

          <div className="flex gap-2 rounded-2xl p-1.5"
            style={{ background: '#FFFFFF', border: '2px solid #111827', boxShadow: '3px 3px 0 #111827' }}>
            {['guru','murid'].map(s => (
              <button key={s} onClick={() => { setSubTab(s); setCarian('') }}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                style={subTab === s
                  ? { background: '#2563EB', color: '#fff', border: '1.5px solid #111827', boxShadow: '2px 2px 0 #111827' }
                  : { background: 'transparent', color: '#64748B' }}>
                {s === 'guru' ? `👨‍🏫 Guru (${guru.length})` : `🎓 Murid (${murid.length})`}
              </button>
            ))}
          </div>

          {/* CSV actions */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => exportCSV(subTab)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold neo-btn"
              style={{ background: '#DCFCE7', color: '#15803D' }}>
              📥 Export CSV
            </button>
            {isAdmin && (
              <button onClick={() => (subTab === 'guru' ? importGuruRef : importMuridRef).current?.click()}
                disabled={importing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold neo-btn disabled:opacity-60"
                style={{ background: '#EEF3FF', color: '#2563EB' }}>
                {importing ? '⏳ Importing...' : '📤 Import CSV'}
              </button>
            )}
            <button onClick={() => downloadTemplate(subTab)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold neo-btn"
              style={{ background: '#F3F4F6', color: '#374151' }}>
              📋 Template
            </button>
            <button onClick={() => window.print()}
              className="no-print flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold neo-btn"
              style={{ background: '#F3F4F6', color: '#374151' }}>
              🖨️ Print
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input value={carian} onChange={e => setCarian(e.target.value)}
              placeholder={subTab === 'guru' ? 'Cari nama, ID, no. pekerja...' : 'Cari nama, kelas...'}
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-400" />
          </div>

          {/* ── GURU flat list ── */}
          {subTab === 'guru' && (
            <div className="space-y-2.5">
              {filteredGuru.map(item => (
                <div key={item.id}
                  className="neo-card p-4 flex items-center gap-3 cursor-pointer"
                  onClick={() => openModal('guru', item)}>
                  <div className="w-11 h-11 bg-violet-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">👨‍🏫</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900">{item.nama}</div>
                    <div className="text-xs font-mono text-gray-500 mt-0.5">{item.id_delima}</div>
                    <div className="text-xs text-gray-500">{item.subjek} • {item.gred} • {item.no_pekerja}</div>
                  </div>
                  <StatusBadge status={item.status} map={STATUS_GURU} />
                </div>
              ))}
              {filteredGuru.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-5xl mb-3">📭</div>
                  <div className="text-sm">Tiada rekod ditemui</div>
                </div>
              )}
            </div>
          )}

          {/* ── MURID grouped by kelas ── */}
          {subTab === 'murid' && (
            <div className="space-y-4">
              {['1','2','3','4','5','6'].map(tahun => {
                const kelasTahun = kelasConfig[tahun] ?? []
                const grouped = getMuridByKelas(kelasTahun)
                const totalTahun = grouped.reduce((a, g) => a + g.senarai.length, 0)
                if (carian && totalTahun === 0) return null

                return (
                  <div key={tahun} className="neo-card overflow-hidden">
                    {/* Tahun header */}
                    <div className="flex items-center justify-between px-4 py-3"
                      style={{ background: '#EDE9FE' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">📚</span>
                        <span className="text-sm font-black text-violet-700">Tahun {tahun}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>👦 {grouped.reduce((a,g) => a + g.senarai.filter(m=>m.jantina==='L').length, 0)}</span>
                        <span>👧 {grouped.reduce((a,g) => a + g.senarai.filter(m=>m.jantina==='P').length, 0)}</span>
                        <span className="font-bold text-violet-600">{totalTahun} murid</span>
                      </div>
                    </div>

                    {/* Kelas sections */}
                    {grouped.map(({ kelas, senarai: ms }) => {
                      if (carian && ms.length === 0) return null
                      const lelaki    = ms.filter(m => m.jantina === 'L').length
                      const perempuan = ms.filter(m => m.jantina === 'P').length

                      return (
                        <div key={kelas} className="border-t border-gray-100">
                          {/* Kelas header */}
                          <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
                            <span className="text-xs font-bold text-gray-700">{kelas}</span>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>👦 {lelaki}</span>
                              <span>👧 {perempuan}</span>
                              <span className="text-gray-300">|</span>
                              <span>{ms.length} murid</span>
                            </div>
                          </div>

                          {/* Students grid */}
                          {ms.length > 0 ? (
                            <div className="px-3 py-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {ms.map(m => (
                                <div key={m.id}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl transition-colors ${
                                    isAdmin ? 'cursor-pointer hover:bg-violet-50 hover:border hover:border-violet-100' : 'bg-gray-50/50'
                                  }`}
                                  onClick={isAdmin ? () => openModal('murid', m) : undefined}>
                                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                                    m.jantina === 'P' ? 'bg-pink-50' : 'bg-blue-50'
                                  }`}>
                                    {m.jantina === 'P' ? '👧' : '👦'}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-semibold text-gray-900 truncate">{m.nama}</div>
                                    {isAdmin && (
                                      <>
                                        <div className="text-xs font-mono text-gray-400 truncate">{m.id_delima}</div>
                                        <div className="text-xs text-gray-400 truncate">{m.no_kad}</div>
                                      </>
                                    )}
                                  </div>
                                  {isAdmin && <StatusBadge status={m.status} map={STATUS_MURID} />}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="px-4 py-3 text-xs text-gray-300 italic">Tiada murid berdaftar</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {/* Lain-lain (kelas tidak dikenali) */}
              {muridLainLain.length > 0 && (
                <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-amber-50">
                    <div className="flex items-center gap-2">
                      <span className="text-base">❓</span>
                      <span className="text-sm font-bold text-amber-700">Kelas Tidak Dikenali</span>
                    </div>
                    <span className="text-xs text-amber-600">{muridLainLain.length} murid</span>
                  </div>
                  <div className="px-3 py-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {muridLainLain.map(m => (
                      <div key={m.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50/50 ${isAdmin ? 'cursor-pointer hover:bg-violet-50' : ''}`}
                        onClick={isAdmin ? () => openModal('murid', m) : undefined}>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${m.jantina === 'P' ? 'bg-pink-50' : 'bg-blue-50'}`}>
                          {m.jantina === 'P' ? '👧' : '👦'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-gray-900 truncate">{m.nama}</div>
                          <div className="text-xs text-amber-500">{m.kelas || '(tiada kelas)'}</div>
                          {isAdmin && <div className="text-xs font-mono text-gray-400 truncate">{m.id_delima}</div>}
                        </div>
                        {isAdmin && <StatusBadge status={m.status} map={STATUS_MURID} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredMurid.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-5xl mb-3">📭</div>
                  <div className="text-sm">Tiada rekod murid ditemui</div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── ADMIN ── */}
      {tab === 'admin' && (
        <AdminGate>
          <div className="flex gap-2 rounded-2xl p-1.5"
            style={{ background: '#FFFFFF', border: '2px solid #111827', boxShadow: '3px 3px 0 #111827' }}>
            {[
              { id: 'guru',  label: `👨‍🏫 Guru (${guru.length})` },
              { id: 'murid', label: `🎓 Murid (${murid.length})` },
              { id: 'kelas', label: '🏫 Kelas' },
            ].map(s => (
              <button key={s.id} onClick={() => setSubTab(s.id)}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                style={subTab === s.id
                  ? { background: '#2563EB', color: '#fff', border: '1.5px solid #111827', boxShadow: '2px 2px 0 #111827' }
                  : { background: 'transparent', color: '#64748B' }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Admin Guru list */}
          {subTab === 'guru' && (
            <div className="neo-card p-5">
              <SectionHeader icon="👨‍🏫" title="Semua Guru" color="text-violet-400" />
              <div className="space-y-2.5 mt-4">
                {guru.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openModal('guru', item)}>
                      <div className="text-xs font-bold text-gray-900 truncate">{item.nama}</div>
                      <div className="text-xs font-mono text-gray-500">{item.id_delima} • {item.gred}</div>
                    </div>
                    <StatusBadge status={item.status} map={STATUS_GURU} />
                    <button onClick={() => deleteRecord('guru', item.id)}
                      className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-900/30 transition-colors flex-shrink-0">
                      🗑️
                    </button>
                  </div>
                ))}
                {guru.length === 0 && <div className="text-center py-8 text-gray-500 text-xs">Tiada rekod</div>}
              </div>
            </div>
          )}

          {/* Admin Murid list */}
          {subTab === 'murid' && (
            <div className="neo-card p-5">
              <SectionHeader icon="🎓" title="Semua Murid" color="text-violet-400" />
              <div className="space-y-2.5 mt-4">
                {murid.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${item.jantina === 'P' ? 'bg-pink-50' : 'bg-blue-50'}`}>
                      {item.jantina === 'P' ? '👧' : '👦'}
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openModal('murid', item)}>
                      <div className="text-xs font-bold text-gray-900 truncate">{item.nama}</div>
                      <div className="text-xs font-mono text-gray-500">{item.id_delima} • {item.kelas}</div>
                      <div className="text-xs text-gray-400 truncate">{item.no_kad} • {item.email}</div>
                    </div>
                    <StatusBadge status={item.status} map={STATUS_MURID} />
                    <button onClick={() => deleteRecord('murid', item.id)}
                      className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-900/30 transition-colors flex-shrink-0">
                      🗑️
                    </button>
                  </div>
                ))}
                {murid.length === 0 && <div className="text-center py-8 text-gray-500 text-xs">Tiada rekod</div>}
              </div>
            </div>
          )}

          {/* Admin Kelas config editor */}
          {subTab === 'kelas' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700 flex gap-2 items-start">
                <span className="text-base">ℹ️</span>
                <div>Edit nama kelas untuk setiap tahun. Klik <strong>Simpan</strong> setelah selesai.</div>
              </div>

              {kelasEdit === null ? (
                <>
                  {/* View mode */}
                  {['1','2','3','4','5','6'].map(tahun => (
                    <div key={tahun} className="neo-card p-4">
                      <div className="text-xs font-bold text-violet-400 mb-3">📚 Tahun {tahun}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(kelasConfig[tahun] ?? []).map((nama, i) => (
                          <div key={i} className="px-3 py-2 text-xs font-semibold text-center"
                            style={{ background: '#EEF3FF', border: '1.5px solid #2563EB', borderRadius: 12 }}>
                            {nama}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setKelasEdit(JSON.parse(JSON.stringify(kelasConfig)))}
                    className="w-full py-3 rounded-2xl text-sm font-bold neo-btn"
                    style={{ background: '#2563EB', color: '#fff' }}>
                    ✏️ Edit Nama Kelas
                  </button>
                </>
              ) : (
                <>
                  {/* Edit mode */}
                  {['1','2','3','4','5','6'].map(tahun => (
                    <div key={tahun} className="neo-card p-4 space-y-2">
                      <div className="text-xs font-bold text-violet-400">📚 Tahun {tahun}</div>
                      {(kelasEdit[tahun] ?? []).map((nama, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-14 flex-shrink-0">Kelas {i+1}</span>
                          <input
                            value={nama}
                            onChange={e => setKelasEdit(prev => ({
                              ...prev,
                              [tahun]: prev[tahun].map((v, j) => j === i ? e.target.value : v)
                            }))}
                            className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-violet-400" />
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button onClick={saveKelasEdit}
                      className="flex-1 py-3 rounded-2xl text-sm font-bold neo-btn"
                      style={{ background: '#2563EB', color: '#fff' }}>
                      💾 Simpan Nama Kelas
                    </button>
                    <button onClick={() => setKelasEdit(null)}
                      className="px-6 bg-gray-100 text-gray-600 py-3 rounded-2xl text-sm font-bold hover:bg-gray-200 transition-colors">
                      Batal
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </AdminGate>
      )}

      {/* ── MODAL ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            style={{ border: '3px solid #111827', borderBottom: 'none' }}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />

            {modal.jenis === 'guru' && (() => {
              const g = modal.data; const ed = editData ?? {}
              return (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center text-3xl">👨‍🏫</div>
                      <div>
                        <div className="text-base font-bold text-violet-400">{g.nama}</div>
                        <div className="font-mono text-xs text-gray-500 mt-0.5">{g.id_delima}</div>
                      </div>
                    </div>
                    {isAdmin && !editMode && (
                      <button onClick={() => { setEditMode(true); setEditData({ nama: g.nama, no_pekerja: g.no_pekerja, email: g.email, no_tel: g.no_tel || '', subjek: g.subjek || '', gred: g.gred }) }}
                        className="px-3 py-1.5 bg-violet-50 text-violet-600 border border-violet-200 rounded-xl text-xs font-bold hover:bg-violet-100">
                        ✏️ Edit
                      </button>
                    )}
                  </div>

                  {editMode ? (
                    <div className="space-y-3 mb-4">
                      {[
                        { label: 'Nama Penuh', key: 'nama' },
                        { label: 'No. Pekerja', key: 'no_pekerja' },
                        { label: 'E-mel', key: 'email' },
                        { label: 'No. Tel', key: 'no_tel' },
                        { label: 'Subjek', key: 'subjek' },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                          <input value={ed[f.key] ?? ''} onChange={e => setEditData(d => ({ ...d, [f.key]: e.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-violet-400" />
                        </div>
                      ))}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Gred</label>
                        <select value={ed.gred ?? 'DG41'} onChange={e => setEditData(d => ({ ...d, gred: e.target.value }))}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-violet-400">
                          {GRED_LIST.map(gr => <option key={gr}>{gr}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => editRecord('guru', g.id, editData)}
                          className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700">
                          💾 Simpan
                        </button>
                        <button onClick={() => { setEditMode(false); setEditData(null) }}
                          className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold">
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {[['No. Pekerja', g.no_pekerja], ['E-mel', g.email], ['No. Tel', g.no_tel || '—'],
                        ['Subjek', g.subjek], ['Gred', g.gred], ['Login Terakhir', g.last_login]].map(([k, v]) => (
                        <div key={k} className="flex justify-between py-2 border-b border-gray-200">
                          <span className="text-xs text-gray-500">{k}</span>
                          <span className="text-xs font-bold text-gray-900">{v}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-xs text-gray-500">Status</span>
                        <StatusBadge status={g.status} map={STATUS_GURU} />
                      </div>
                    </>
                  )}

                  {isAdmin && (
                    <div className="mt-4 bg-gray-100 rounded-2xl p-4">
                      <div className="text-xs font-bold text-violet-400 mb-3">🔐 Pengurusan Kata Laluan</div>
                      <div className="space-y-2.5 mb-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Password Baru</label>
                          <div className="relative">
                            <input type={pwForm.show ? 'text' : 'password'} value={pwForm.baru}
                              onChange={e => setPwForm(f => ({ ...f, baru: e.target.value }))}
                              placeholder="Masukkan password baru"
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-900 focus:outline-none focus:border-violet-400" />
                            <button onClick={() => setPwForm(f => ({ ...f, show: !f.show }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                              {pwForm.show ? '🙈' : '👁️'}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Sahkan Password</label>
                          <input type={pwForm.show ? 'text' : 'password'} value={pwForm.sahkan}
                            onChange={e => setPwForm(f => ({ ...f, sahkan: e.target.value }))}
                            placeholder="Ulang password baru"
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-violet-400" />
                        </div>
                        {pwForm.baru && pwForm.sahkan && (
                          <div className={`text-xs font-semibold ${pwForm.baru === pwForm.sahkan ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pwForm.baru === pwForm.sahkan ? '✅ Password sepadan' : '❌ Password tidak sepadan'}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          if (!pwForm.baru || pwForm.baru !== pwForm.sahkan) { showToast('Password tidak sepadan!', 'error'); return }
                          if (pwForm.baru.length < 8) { showToast('Password minimum 8 aksara!', 'error'); return }
                          showToast('✅ Password berjaya ditukar!'); setModal(null)
                          setPwForm({ baru: '', sahkan: '', show: false })
                        }}
                          className="flex-1 bg-violet-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-violet-700">
                          💾 Simpan Password
                        </button>
                        <button onClick={() => resetPassword('guru', g.id)}
                          className="px-4 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-200">
                          🔑 Reset
                        </button>
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="mt-4">
                      <div className="text-xs font-bold text-gray-500 mb-2">Urus Status Akaun</div>
                      <div className="flex gap-2 flex-wrap">
                        {g.status !== 'aktif' && (
                          <button onClick={() => toggleStatus('guru', g.id, 'aktif')}
                            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold hover:bg-emerald-500/30">
                            ✅ Aktifkan
                          </button>
                        )}
                        {g.status !== 'tidak_aktif' && (
                          <button onClick={() => toggleStatus('guru', g.id, 'tidak_aktif')}
                            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200">
                            ⭕ Nyahaktif
                          </button>
                        )}
                        {g.status !== 'cuti' && (
                          <button onClick={() => toggleStatus('guru', g.id, 'cuti')}
                            className="px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold hover:bg-amber-500/30">
                            🌴 Cuti
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <button onClick={() => deleteRecord('guru', g.id)}
                      className="w-full mt-3 border border-red-800 text-red-500 py-3 rounded-2xl text-sm font-bold hover:bg-red-900/30 transition-colors">
                      🗑️ Padam Rekod
                    </button>
                  )}
                  <button onClick={() => setModal(null)}
                    className="w-full mt-3 border border-gray-200 text-gray-500 py-3 rounded-2xl text-sm font-bold">
                    Tutup
                  </button>
                </>
              )
            })()}

            {modal.jenis === 'murid' && (() => {
              const m = modal.data; const ed = editData ?? {}
              return (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${m.jantina === 'P' ? 'bg-pink-50' : 'bg-blue-50'}`}>
                        {m.jantina === 'P' ? '👧' : '👦'}
                      </div>
                      <div>
                        <div className="text-base font-bold text-violet-400">{m.nama}</div>
                        <div className="font-mono text-xs text-gray-500 mt-0.5">{m.id_delima}</div>
                        <div className="text-xs text-gray-400">{m.kelas} • {m.jantina === 'L' ? 'Lelaki' : 'Perempuan'}</div>
                      </div>
                    </div>
                    {isAdmin && !editMode && (
                      <button onClick={() => { setEditMode(true); setEditData({ nama: m.nama, no_kad: m.no_kad, email: m.email || '', kelas: m.kelas, jantina: m.jantina }) }}
                        className="px-3 py-1.5 bg-violet-50 text-violet-600 border border-violet-200 rounded-xl text-xs font-bold hover:bg-violet-100">
                        ✏️ Edit
                      </button>
                    )}
                  </div>

                  {editMode ? (
                    <div className="space-y-3 mb-4">
                      {[
                        { label: 'Nama Penuh', key: 'nama' },
                        { label: 'No. Kad Pengenalan', key: 'no_kad' },
                        { label: 'E-mel', key: 'email' },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                          <input value={ed[f.key] ?? ''} onChange={e => setEditData(d => ({ ...d, [f.key]: e.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-violet-400" />
                        </div>
                      ))}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Kelas</label>
                        <select value={ed.kelas ?? ''} onChange={e => setEditData(d => ({ ...d, kelas: e.target.value }))}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-violet-400">
                          <option value="">-- Pilih Kelas --</option>
                          {['1','2','3','4','5','6'].map(tahun => (
                            <optgroup key={tahun} label={`Tahun ${tahun}`}>
                              {(kelasConfig[tahun] ?? []).map(k => <option key={k} value={k}>{k}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Jantina</label>
                        <select value={ed.jantina ?? 'L'} onChange={e => setEditData(d => ({ ...d, jantina: e.target.value }))}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-violet-400">
                          <option value="L">Lelaki</option>
                          <option value="P">Perempuan</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => editRecord('murid', m.id, editData)}
                          className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700">
                          💾 Simpan
                        </button>
                        <button onClick={() => { setEditMode(false); setEditData(null) }}
                          className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold">
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {[
                        ['Kelas', m.kelas],
                        ['Jantina', m.jantina === 'L' ? '👦 Lelaki' : '👧 Perempuan'],
                        ['No. Kad', m.no_kad],
                        ['E-mel', m.email],
                        ['ID DELIMA', m.id_delima],
                        ['Login Terakhir', m.last_login],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between py-2 border-b border-gray-200">
                          <span className="text-xs text-gray-500">{k}</span>
                          <span className="text-xs font-bold text-gray-900">{v}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-xs text-gray-500">Status</span>
                        <StatusBadge status={m.status} map={STATUS_MURID} />
                      </div>
                    </>
                  )}

                  {isAdmin && (
                    <div className="mt-4">
                      <div className="text-xs font-bold text-gray-500 mb-2">Urus Status Akaun</div>
                      <div className="flex gap-2 flex-wrap">
                        {m.status !== 'aktif' && (
                          <button onClick={() => toggleStatus('murid', m.id, 'aktif')}
                            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold">
                            ✅ Aktifkan
                          </button>
                        )}
                        {m.status !== 'kunci' && (
                          <button onClick={() => toggleStatus('murid', m.id, 'kunci')}
                            className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold">
                            🔒 Kunci
                          </button>
                        )}
                        {m.status !== 'tukar_sekolah' && (
                          <button onClick={() => toggleStatus('murid', m.id, 'tukar_sekolah')}
                            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold">
                            🏫 Tukar Sekolah
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <button onClick={() => deleteRecord('murid', m.id)}
                      className="w-full mt-3 border border-red-800 text-red-500 py-3 rounded-2xl text-sm font-bold hover:bg-red-900/30 transition-colors">
                      🗑️ Padam Rekod
                    </button>
                  )}
                  <button onClick={() => setModal(null)}
                    className="w-full mt-3 border border-gray-200 text-gray-500 py-3 rounded-2xl text-sm font-bold">
                    Tutup
                  </button>
                </>
              )
            })()}
          </div>
        </div>
      )}

    </Layout>
  )
}
