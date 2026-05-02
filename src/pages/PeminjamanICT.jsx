import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import SectionHeader from '../components/SectionHeader'
import AdminGate from '../components/AdminGate'
import { useAdmin } from '../contexts/AdminContext'
import { QRCodeSVG } from 'qrcode.react'

const KATEGORI_ICON = {
  Laptop: '💻', Projektor: '📽️', Tablet: '📱',
  Kamera: '📷', Audio: '🎙️', Lain: '📦',
}

const STATUS_CONFIG = {
  dipinjam:    { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Dipinjam',    dot: 'bg-blue-400' },
  dipulangkan: { bg: 'bg-emerald-100',text: 'text-emerald-700',label: 'Dipulangkan', dot: 'bg-emerald-400' },
  lewat:       { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Lewat',       dot: 'bg-red-400' },
  pending:     { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Menunggu',    dot: 'bg-amber-400' },
}

const STATUS_SERVIS = {
  dilaporkan:   { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Dilaporkan',   dot: 'bg-red-400' },
  dalam_servis: { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Dalam Servis', dot: 'bg-amber-400' },
  siap:         { bg: 'bg-emerald-100',text: 'text-emerald-700',label: 'Siap',         dot: 'bg-emerald-400' },
}

const LOG_ICONS = {
  tambah_barang:     '📦',
  padam_barang:      '🗑️',
  import_excel:      '📥',
  tambah_peminjaman: '📝',
  pulang_barang:     '✅',
  edit_barang:       '✏️',
}

const TODAY = new Date().toISOString().slice(0, 10)
const KATEGORI_LIST = ['Laptop','Projektor','Tablet','Kamera','Audio','Lain']

function getKategoriIcon(nama) {
  const found = Object.entries(KATEGORI_ICON).find(([k]) =>
    nama?.toLowerCase().includes(k.toLowerCase())
  )
  return found ? found[1] : '📦'
}

const formatRM = n =>
  'RM ' + (n || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PeminjamanICT() {
  const { isAdmin } = useAdmin()
  const [tab, setTab] = useState('dashboard')
  const [tabAdmin, setTabAdmin] = useState('peminjaman')
  const [items, setItems] = useState([])
  const [peminjaman, setPeminjaman] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('semua')
  const [searchInv, setSearchInv] = useState('')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [log, setLog] = useState([])
  const [importLoading, setImportLoading] = useState(false)

  const [form, setForm] = useState({
    peminjam: '', jawatan: '', barang: '', kod: '',
    kuantiti: 1, tarikh_pinjam: TODAY, tarikh_pulang: '', catatan: '',
  })

  const [formBarang, setFormBarang] = useState({
    nama: '', kod: '', kategori: 'Laptop', kuantiti: 1,
    no_siri: '', lokasi: '', tarikh_terima: '', harga_unit: '',
  })
  const [gambarFile, setGambarFile] = useState(null)
  const [gambarPreview, setGambarPreview] = useState(null)
  const [qrModal, setQrModal] = useState(null)
  const qrRef = useRef(null)
  const BASE_URL = window.location.origin

  const [servis, setServis] = useState([])
  const [formServis, setFormServis] = useState({
    barang_nama: '', kod: '', masalah: '', dilaporkan_oleh: '', tarikh_lapor: TODAY, catatan: '',
  })
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  async function fetchData() {
    setLoading(true)
    const [{ data: b }, { data: p }] = await Promise.all([
      supabase.from('barang_ict').select('*'),
      supabase.from('peminjaman_ict').select('*').order('created_at', { ascending: false }),
    ])
    setItems(b ?? [])
    setPeminjaman(p ?? [])
    setLoading(false)
  }

  async function fetchServis() {
    const { data } = await supabase.from('penyelenggaraan_ict').select('*').order('created_at', { ascending: false })
    setServis(data ?? [])
  }

  async function fetchLog() {
    const { data } = await supabase.from('log_ict').select('*').order('created_at', { ascending: false }).limit(100)
    setLog(data ?? [])
  }

  useEffect(() => { fetchData(); fetchServis(); fetchLog() }, [])

  async function addLog(aksi, butiran) {
    await supabase.from('log_ict').insert([{ aksi, butiran }])
  }

  const stats = {
    totalBarang: items.length,
    sedangDipinjam: peminjaman.filter(p => p.status === 'dipinjam').length,
    lewat: peminjaman.filter(p => p.status === 'lewat').length,
    dipulangkan: peminjaman.filter(p => p.status === 'dipulangkan').length,
    totalNilai: items.reduce((s, i) => s + (parseFloat(i.harga_unit) || 0) * i.kuantiti, 0),
  }

  const filteredItems = items.filter(i => {
    if (!searchInv) return true
    const q = searchInv.toLowerCase()
    return (
      i.nama.toLowerCase().includes(q) ||
      (i.kod || '').toLowerCase().includes(q) ||
      (i.lokasi || '').toLowerCase().includes(q) ||
      (i.kategori || '').toLowerCase().includes(q)
    )
  })

  function handleFormChange(e) {
    const { name, value } = e.target
    if (name === 'barang') {
      const item = items.find(i => i.nama === value)
      setForm(f => ({ ...f, barang: value, kod: item?.kod ?? '' }))
    } else {
      setForm(f => ({ ...f, [name]: value }))
    }
  }

  async function submitPeminjaman() {
    if (!form.peminjam || !form.barang || !form.tarikh_pinjam || !form.tarikh_pulang || !form.catatan) {
      showToast('Sila isi nama, barang, tujuan, dan tarikh pulang!', 'error'); return
    }
    const item = items.find(i => i.nama === form.barang)
    if (!item || item.tersedia < parseInt(form.kuantiti)) {
      showToast('Stok tidak mencukupi!', 'error'); return
    }

    const { error: e1 } = await supabase.from('peminjaman_ict').insert([{
      ...form, kuantiti: parseInt(form.kuantiti), status: 'dipinjam',
    }])
    if (e1) { showToast('Ralat: ' + e1.message, 'error'); return }

    const { error: e2 } = await supabase.from('barang_ict')
      .update({ tersedia: item.tersedia - parseInt(form.kuantiti) })
      .eq('id', item.id)
    if (e2) { showToast('Ralat kemaskini stok: ' + e2.message, 'error'); return }

    addLog('tambah_peminjaman', `${form.peminjam} pinjam ${form.barang} (${form.kuantiti} unit)`)
    setForm({ peminjam: '', jawatan: '', barang: '', kod: '', kuantiti: 1, tarikh_pinjam: TODAY, tarikh_pulang: '', catatan: '' })
    showToast('✅ Rekod peminjaman berjaya disimpan!')
    fetchData()
    setTab('senarai')
  }

  async function tambahBarang() {
    if (!formBarang.nama) { showToast('Sila isi nama barang!', 'error'); return }
    const qty = parseInt(formBarang.kuantiti) || 1

    let gambar_url = null
    if (gambarFile) {
      const filePath = `${Date.now()}-${gambarFile.name}`
      const { error: upErr } = await supabase.storage.from('ict-gambar').upload(filePath, gambarFile)
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('ict-gambar').getPublicUrl(filePath)
        gambar_url = urlData.publicUrl
      }
    }

    const { data, error } = await supabase.from('barang_ict').insert([{
      nama: formBarang.nama,
      kod: formBarang.kod || null,
      kategori: formBarang.kategori,
      kuantiti: qty,
      tersedia: qty,
      no_siri: formBarang.no_siri || null,
      lokasi: formBarang.lokasi || null,
      tarikh_terima: formBarang.tarikh_terima || null,
      harga_unit: parseFloat(formBarang.harga_unit) || null,
      gambar_url,
    }]).select().single()

    if (error) { showToast('Ralat: ' + error.message, 'error'); return }
    addLog('tambah_barang', `${formBarang.nama} (${formBarang.kod || 'tiada kod'}) — ${qty} unit`)
    setFormBarang({ nama: '', kod: '', kategori: 'Laptop', kuantiti: 1, no_siri: '', lokasi: '', tarikh_terima: '', harga_unit: '' })
    setGambarFile(null)
    setGambarPreview(null)
    showToast('✅ Barang berjaya ditambah! Jana QR sekarang.')
    fetchData()
    if (data) setQrModal(data)
  }

  async function deletePeminjaman(rec) {
    const item = items.find(i => i.nama === rec.barang)
    await supabase.from('peminjaman_ict').delete().eq('id', rec.id)
    if (item && rec.status !== 'dipulangkan') {
      await supabase.from('barang_ict')
        .update({ tersedia: item.tersedia + rec.kuantiti })
        .eq('id', item.id)
    }
    setModal(null)
    showToast('🗑️ Rekod berjaya dipadam!')
    fetchData()
  }

  async function deleteBarang(id) {
    const item = items.find(i => i.id === id)
    await supabase.from('barang_ict').delete().eq('id', id)
    addLog('padam_barang', `${item?.nama || id} dipadam`)
    showToast('🗑️ Barang dipadam!')
    fetchData()
  }

  async function pulangBarang(rec) {
    const item = items.find(i => i.nama === rec.barang)
    await supabase.from('peminjaman_ict').update({ status: 'dipulangkan' }).eq('id', rec.id)
    if (item) {
      await supabase.from('barang_ict')
        .update({ tersedia: item.tersedia + rec.kuantiti })
        .eq('id', item.id)
    }
    addLog('pulang_barang', `${rec.peminjam} pulangkan ${rec.barang}`)
    setModal(null)
    showToast('✅ Barang berjaya dipulangkan!')
    fetchData()
  }

  async function editPeminjaman(id, data) {
    const { error } = await supabase.from('peminjaman_ict').update(data).eq('id', id)
    if (error) { showToast('Ralat: ' + error.message, 'error'); return }
    showToast('✅ Rekod berjaya dikemaskini!')
    setModal(null); setEditMode(false); setEditData(null)
    fetchData()
  }

  async function editBarang(id, data) {
    const { error } = await supabase.from('barang_ict').update(data).eq('id', id)
    if (error) { showToast('Ralat: ' + error.message, 'error'); return }
    addLog('edit_barang', `${data.nama || id} dikemaskini`)
    showToast('✅ Barang berjaya dikemaskini!')
    setModal(null); setEditMode(false); setEditData(null)
    fetchData()
  }

  async function tambahServis() {
    if (!formServis.barang_nama || !formServis.masalah || !formServis.dilaporkan_oleh) {
      showToast('Sila lengkapkan maklumat wajib!', 'error'); return
    }
    const { error } = await supabase.from('penyelenggaraan_ict').insert([{ ...formServis, status: 'dilaporkan' }])
    if (error) { showToast('Ralat: ' + error.message, 'error'); return }
    setFormServis({ barang_nama: '', kod: '', masalah: '', dilaporkan_oleh: '', tarikh_lapor: TODAY, catatan: '' })
    showToast('✅ Laporan rosak berjaya dihantar!')
    fetchServis()
  }

  async function updateStatusServis(id, status, tarikh_siap = null) {
    const update = tarikh_siap ? { status, tarikh_siap } : { status }
    await supabase.from('penyelenggaraan_ict').update(update).eq('id', id)
    showToast('✅ Status servis dikemaskini!')
    fetchServis()
  }

  async function deleteServis(id) {
    await supabase.from('penyelenggaraan_ict').delete().eq('id', id)
    showToast('🗑️ Rekod servis dipadam!')
    fetchServis()
  }

  // ── Excel Import ──
  async function importExcel(file) {
    setImportLoading(true)
    try {
      const wb = XLSX.read(await file.arrayBuffer())
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws)
      if (rows.length === 0) { showToast('Fail Excel kosong!', 'error'); return }

      let success = 0
      for (const row of rows) {
        const nama = row['nama'] || row['Nama'] || row['NAMA']
        if (!nama) continue
        const qty = parseInt(row['kuantiti'] || row['Kuantiti'] || row['KUANTITI'] || 1)
        const { error } = await supabase.from('barang_ict').insert([{
          nama,
          kod: row['kod'] || row['Kod Aset'] || row['KOD'] || null,
          kategori: row['kategori'] || row['Kategori'] || row['KATEGORI'] || 'Lain',
          kuantiti: qty,
          tersedia: qty,
          no_siri: row['no_siri'] || row['No. Siri'] || row['NO SIRI'] || null,
          lokasi: row['lokasi'] || row['Lokasi'] || row['LOKASI'] || null,
          tarikh_terima: row['tarikh_terima'] || row['Tarikh Terima'] || null,
          harga_unit: parseFloat(row['harga_unit'] || row['Harga Unit'] || row['HARGA'] || 0) || null,
        }])
        if (!error) success++
      }
      showToast(`✅ ${success}/${rows.length} barang berjaya diimport!`)
      addLog('import_excel', `${success} barang diimport dari Excel`)
      fetchData()
    } catch (err) {
      showToast('Ralat baca fail: ' + err.message, 'error')
    } finally {
      setImportLoading(false)
    }
  }

  // ── Excel Export ──
  function exportInventori() {
    const data = items.map(i => ({
      'Nama': i.nama,
      'Kod Aset': i.kod || '',
      'Kategori': i.kategori || '',
      'No. Siri': i.no_siri || '',
      'Lokasi': i.lokasi || '',
      'Kuantiti': i.kuantiti,
      'Tersedia': i.tersedia,
      'Harga Unit (RM)': parseFloat(i.harga_unit) || 0,
      'Nilai Aset (RM)': (parseFloat(i.harga_unit) || 0) * i.kuantiti,
      'Tarikh Terima': i.tarikh_terima || '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventori ICT')
    XLSX.writeFile(wb, `Inventori_ICT_${TODAY}.xlsx`)
  }

  function exportPeminjaman() {
    const data = filteredPeminjaman.map(p => ({
      'Peminjam': p.peminjam,
      'Jawatan': p.jawatan || '',
      'Barang': p.barang,
      'Kod Aset': p.kod || '',
      'Kuantiti': p.kuantiti,
      'Tarikh Pinjam': p.tarikh_pinjam,
      'Tarikh Pulang': p.tarikh_pulang,
      'Status': STATUS_CONFIG[p.status]?.label || p.status,
      'Tujuan': p.catatan || '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Peminjaman ICT')
    XLSX.writeFile(wb, `Peminjaman_ICT_${TODAY}.xlsx`)
  }

  function downloadTemplate() {
    const template = [{
      'nama': 'Laptop Acer Aspire',
      'kod': 'SK/ICT/001',
      'kategori': 'Laptop',
      'kuantiti': 10,
      'no_siri': 'SN123456',
      'lokasi': 'Makmal ICT 1',
      'tarikh_terima': '2024-01-15',
      'harga_unit': 2500,
    }]
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'Template_Import_Barang.xlsx')
  }

  const filteredPeminjaman = filterStatus === 'semua'
    ? peminjaman
    : peminjaman.filter(p => p.status === filterStatus)

  const servisAktif = servis.filter(s => s.status !== 'siap').length

  const TABS = [
    { id: 'dashboard', label: '🏠 Utama' },
    { id: 'pinjam',    label: '➕ Pinjam' },
    { id: 'senarai',   label: '📋 Senarai' },
    { id: 'inventori', label: '📦 Inventori' },
    { id: 'servis',    label: '🔧 Servis', badge: servisAktif },
    { id: 'admin',     label: '⚙️ Admin' },
  ]

  const ADMIN_TABS = [
    { id: 'peminjaman', label: '📋 Peminjaman' },
    { id: 'inventori',  label: '📦 Inventori' },
    { id: 'import',     label: '📥 Import' },
    { id: 'log',        label: '📜 Log' },
  ]

  return (
    <Layout badgeCounts={{ ict: stats.lewat }}>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full text-sm font-semibold text-white ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-600'
        }`}
          style={{ border: '2px solid #111827', boxShadow: '3px 3px 0 #111827' }}>
          {toast.msg}
        </div>
      )}

      {/* Tab Nav */}
      <div className="flex gap-1.5 rounded-2xl p-1.5 overflow-x-auto scrollbar-hide"
        style={{ background: '#FFFFFF', border: '2px solid #111827', boxShadow: '3px 3px 0 #111827' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-shrink-0 relative px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={tab === t.id
              ? { background: '#2563EB', color: '#fff', border: '1.5px solid #111827', boxShadow: '2px 2px 0 #111827' }
              : { background: 'transparent', color: '#64748B' }}>
            {t.label}
            {t.badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { num: stats.totalBarang,    label: 'Jenis Barang',    bg: '#DBEAFE', numColor: '#1D4ED8' },
              { num: stats.sedangDipinjam, label: 'Sedang Dipinjam', bg: '#E0F2FE', numColor: '#0369A1' },
              { num: stats.lewat,          label: 'Lewat Pulang',    bg: '#FEE2E2', numColor: '#DC2626' },
              { num: stats.dipulangkan,    label: 'Dipulangkan',     bg: '#DCFCE7', numColor: '#059669' },
            ].map((s, i) => (
              <div key={i} className="neo-card p-5 animate-fade-up" style={{ background: s.bg }}>
                <div className="text-3xl font-black" style={{ color: s.numColor, fontFamily: "'JetBrains Mono', monospace" }}>{s.num}</div>
                <div className="text-xs text-gray-500 mt-1" style={{ fontFamily: "'Fredoka', sans-serif" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Nilai Aset */}
          {stats.totalNilai > 0 && (
            <div className="neo-card p-4 flex items-center gap-4" style={{ background: '#EEF3FF' }}>
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">💰</div>
              <div className="flex-1">
                <div className="text-xs text-indigo-500 font-semibold">Jumlah Nilai Aset ICT</div>
                <div className="text-2xl font-black text-indigo-700">{formatRM(stats.totalNilai)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-indigo-400">{items.length} jenis</div>
                <div className="text-xs text-indigo-400">{items.reduce((s, i) => s + i.kuantiti, 0)} unit</div>
              </div>
            </div>
          )}

          {stats.lewat > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 items-start">
              <span className="text-2xl">🚨</span>
              <div>
                <div className="text-sm font-bold text-red-700">{stats.lewat} Peminjaman Lewat!</div>
                <div className="text-xs text-red-600 mt-1">Sila hubungi peminjam untuk pulangkan barang segera.</div>
              </div>
            </div>
          )}

          <div className="neo-card p-5">
            <SectionHeader icon="📦" title="Status Inventori" color="text-indigo-400" />
            <div className="space-y-3 mt-4">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                    {getKategoriIcon(item.nama)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate">{item.nama}</div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                      <div className={`h-1.5 rounded-full ${
                        item.tersedia === 0 ? 'bg-red-400' : item.tersedia < item.kuantiti / 2 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                        style={{ width: `${(item.tersedia / item.kuantiti) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-xs font-bold text-gray-500 flex-shrink-0">
                    {item.tersedia}/{item.kuantiti}
                  </div>
                </div>
              ))}
              {items.length === 0 && !loading && (
                <div className="text-center text-xs text-gray-500 py-4">Tiada barang dalam inventori</div>
              )}
            </div>
          </div>

          <div className="neo-card p-5">
            <SectionHeader icon="📋" title="Peminjaman Terkini" color="text-indigo-400"
              onMore={() => setTab('senarai')} />
            <div className="space-y-2.5 mt-4">
              {peminjaman.slice(0, 4).map(p => {
                const s = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.dipinjam
                return (
                  <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 cursor-pointer hover:bg-gray-100"
                    onClick={() => setModal({ type: 'detail', data: p })}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-900 truncate">{p.peminjam}</div>
                      <div className="text-xs text-gray-500 truncate">{p.barang} • Pulang: {p.tarikh_pulang}</div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${s.bg} ${s.text}`}>{s.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── FORM PINJAM ── */}
      {tab === 'pinjam' && (
        <div className="neo-card p-5 space-y-4">
          <div className="text-sm font-bold text-indigo-400 flex items-center gap-2">
            <span>📝</span> Borang Peminjaman Baru
          </div>

          {[
            { label: 'Nama Peminjam *', name: 'peminjam', placeholder: 'Nama penuh' },
            { label: 'Jawatan',         name: 'jawatan',  placeholder: 'Contoh: Guru Sains' },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-xs font-semibold text-indigo-400 mb-1.5">{f.label}</label>
              <input name={f.name} value={form[f.name]} onChange={handleFormChange}
                placeholder={f.placeholder}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-indigo-400 mb-1.5">Pilih Barang *</label>
            <select name="barang" value={form.barang} onChange={handleFormChange}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400">
              <option value="">-- Pilih Barang --</option>
              {items.filter(i => i.tersedia > 0).map(i => (
                <option key={i.id} value={i.nama}>{i.nama} (Tersedia: {i.tersedia})</option>
              ))}
            </select>
          </div>

          {form.kod && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 text-xs text-indigo-700 font-semibold">
              Kod Aset: {form.kod}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-indigo-400 mb-1.5">Kuantiti</label>
            <input name="kuantiti" type="number" min="1" value={form.kuantiti} onChange={handleFormChange}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-indigo-400 mb-1.5">Tarikh Pinjam</label>
              <input name="tarikh_pinjam" type="date" value={form.tarikh_pinjam} onChange={handleFormChange}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-indigo-400 mb-1.5">Tarikh Pulang *</label>
              <input name="tarikh_pulang" type="date" value={form.tarikh_pulang} onChange={handleFormChange}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-indigo-400 mb-1.5">Tujuan Peminjaman *</label>
            <textarea name="catatan" value={form.catatan} onChange={handleFormChange}
              placeholder="Contoh: Untuk kelas Matematik Tingkatan 4"
              rows={3}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 resize-none" />
          </div>

          <button onClick={submitPeminjaman}
            className="w-full py-3.5 rounded-2xl text-sm font-black neo-btn"
            style={{ background: '#2563EB', color: '#fff', fontFamily: "'Fredoka', sans-serif" }}>
            💾 Simpan Rekod Peminjaman
          </button>
        </div>
      )}

      {/* ── SENARAI ── */}
      {tab === 'senarai' && (
        <>
          <div className="flex items-center justify-between no-print">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {['semua', 'dipinjam', 'lewat', 'dipulangkan'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition-all ${
                    filterStatus === s
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}>
                  {s === 'semua' ? 'Semua' : STATUS_CONFIG[s]?.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={exportPeminjaman}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors">
                📊 Excel
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:border-indigo-500 hover:text-indigo-600 transition-colors">
                🖨️ Print
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredPeminjaman.map(p => {
              const s = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.dipinjam
              return (
                <div key={p.id}
                  className="neo-card p-4 flex items-start gap-3 cursor-pointer"
                  onClick={() => setModal({ type: 'detail', data: p })}>
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                    {getKategoriIcon(p.barang)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900">{p.peminjam}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{p.barang} • {p.kuantiti} unit</div>
                    <div className="text-xs text-gray-500">📅 {p.tarikh_pinjam} → {p.tarikh_pulang}</div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${s.bg} ${s.text}`}>{s.label}</span>
                </div>
              )
            })}
            {filteredPeminjaman.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-5xl mb-3">📭</div>
                <div className="text-sm">Tiada rekod ditemui</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── INVENTORI ── */}
      {tab === 'inventori' && (
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <input
              type="search"
              placeholder="🔍 Cari nama, kod, lokasi..."
              value={searchInv}
              onChange={e => setSearchInv(e.target.value)}
              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400"
            />
            <button onClick={exportInventori}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors whitespace-nowrap">
              📊 Excel
            </button>
          </div>
          <div className="text-xs text-gray-400">
            {filteredItems.length} daripada {items.length} barang
            {stats.totalNilai > 0 && ` • Nilai: ${formatRM(stats.totalNilai)}`}
          </div>

          {filteredItems.map(item => (
            <div key={item.id}
              className="neo-card p-4 flex items-center gap-4 cursor-pointer"
              onClick={() => setModal({ type: 'item', data: item })}>
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
                {item.gambar_url
                  ? <img src={item.gambar_url} className="w-full h-full object-cover" />
                  : <span className="text-2xl">{getKategoriIcon(item.nama)}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900">{item.nama}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.kod} • {item.kategori}</div>
                {item.lokasi && <div className="text-xs text-indigo-500 mt-0.5">📍 {item.lokasi}</div>}
                {item.harga_unit > 0 && (
                  <div className="text-xs text-emerald-600 mt-0.5 font-semibold">
                    💰 {formatRM(item.harga_unit)} / unit
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${
                      item.tersedia === 0 ? 'bg-red-400' : item.tersedia < item.kuantiti / 2 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                      style={{ width: `${(item.tersedia / item.kuantiti) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-400">{item.tersedia}/{item.kuantiti}</span>
                </div>
              </div>
              <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                item.tersedia === 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
              }`}>
                {item.tersedia === 0 ? 'Habis' : 'Ada'}
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-5xl mb-3">{searchInv ? '🔍' : '📦'}</div>
              <div className="text-sm">{searchInv ? `Tiada barang untuk "${searchInv}"` : 'Tiada barang dalam inventori'}</div>
            </div>
          )}
        </div>
      )}

      {/* ── SERVIS ── */}
      {tab === 'servis' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { num: servis.filter(s => s.status === 'dilaporkan').length,   label: 'Dilaporkan',   bg: '#FEE2E2', numColor: '#DC2626' },
              { num: servis.filter(s => s.status === 'dalam_servis').length, label: 'Dalam Servis', bg: '#FEF3C7', numColor: '#D97706' },
              { num: servis.filter(s => s.status === 'siap').length,         label: 'Siap',         bg: '#DCFCE7', numColor: '#059669' },
            ].map((s, i) => (
              <div key={i} className="neo-card p-4 text-center" style={{ background: s.bg }}>
                <div className="text-2xl font-black" style={{ color: s.numColor, fontFamily: "'JetBrains Mono', monospace" }}>{s.num}</div>
                <div className="text-xs text-gray-500 mt-1" style={{ fontFamily: "'Fredoka', sans-serif" }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="neo-card p-5 space-y-3">
            <div className="text-sm font-bold text-red-500">🔧 Lapor Barang Rosak / Penyelenggaraan</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-indigo-400 mb-1.5">Nama Barang *</label>
                <select value={formServis.barang_nama}
                  onChange={e => {
                    const item = items.find(i => i.nama === e.target.value)
                    setFormServis(f => ({ ...f, barang_nama: e.target.value, kod: item?.kod ?? '' }))
                  }}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400">
                  <option value="">-- Pilih Barang --</option>
                  {items.map(i => <option key={i.id} value={i.nama}>{i.nama}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-indigo-400 mb-1.5">Dilaporkan Oleh *</label>
                <input value={formServis.dilaporkan_oleh}
                  onChange={e => setFormServis(f => ({ ...f, dilaporkan_oleh: e.target.value }))}
                  placeholder="Nama guru / staf"
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-indigo-400 mb-1.5">Jenis Masalah *</label>
              <textarea value={formServis.masalah}
                onChange={e => setFormServis(f => ({ ...f, masalah: e.target.value }))}
                placeholder="Huraikan kerosakan atau masalah..."
                rows={2}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-indigo-400 mb-1.5">Tarikh Lapor</label>
                <input type="date" value={formServis.tarikh_lapor}
                  onChange={e => setFormServis(f => ({ ...f, tarikh_lapor: e.target.value }))}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Catatan Tambahan</label>
                <input value={formServis.catatan}
                  onChange={e => setFormServis(f => ({ ...f, catatan: e.target.value }))}
                  placeholder="Tidak wajib"
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
              </div>
            </div>
            <button onClick={tambahServis}
              className="w-full bg-gradient-to-r from-red-500 to-orange-400 text-white py-3 rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity">
              📋 Hantar Laporan Rosak
            </button>
          </div>

          <div className="space-y-3">
            {servis.map(s => {
              const sc = STATUS_SERVIS[s.status] ?? STATUS_SERVIS.dilaporkan
              return (
                <div key={s.id} className="neo-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🔧</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-bold text-gray-900">{s.barang_nama}</div>
                        {s.kod && <div className="text-xs text-gray-400">{s.kod}</div>}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>
                      </div>
                      <div className="text-xs text-red-600 mt-1 font-semibold">{s.masalah}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Dilaporkan: {s.dilaporkan_oleh} • {s.tarikh_lapor}</div>
                      {s.catatan && <div className="text-xs text-gray-400 mt-0.5 italic">{s.catatan}</div>}
                      {s.tarikh_siap && <div className="text-xs text-emerald-600 mt-0.5">✅ Siap: {s.tarikh_siap}</div>}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {s.status === 'dilaporkan' && (
                        <button onClick={() => updateStatusServis(s.id, 'dalam_servis')}
                          className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors">
                          🔄 Dalam Servis
                        </button>
                      )}
                      {s.status === 'dalam_servis' && (
                        <button onClick={() => updateStatusServis(s.id, 'siap', TODAY)}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors">
                          ✅ Tandakan Siap
                        </button>
                      )}
                      <button onClick={() => deleteServis(s.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-500 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors">
                        🗑️ Padam
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {servis.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-5xl mb-3">✅</div>
                <div className="text-sm">Tiada rekod servis/rosak</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ADMIN ── */}
      {tab === 'admin' && (
        <AdminGate>
          {/* Admin sub-tabs */}
          <div className="flex gap-1.5 rounded-2xl p-1.5 overflow-x-auto scrollbar-hide"
            style={{ background: '#FFFFFF', border: '2px solid #111827', boxShadow: '3px 3px 0 #111827' }}>
            {ADMIN_TABS.map(t => (
              <button key={t.id}
                onClick={() => { setTabAdmin(t.id); if (t.id === 'log') fetchLog() }}
                className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={tabAdmin === t.id
                  ? { background: '#2563EB', color: '#fff', border: '1.5px solid #111827', boxShadow: '2px 2px 0 #111827' }
                  : { background: 'transparent', color: '#64748B' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Admin: Peminjaman */}
          {tabAdmin === 'peminjaman' && (
            <div className="neo-card p-5">
              <SectionHeader icon="📋" title="Semua Peminjaman" color="text-indigo-400" />
              <div className="space-y-2.5 mt-4">
                {peminjaman.map(p => {
                  const s = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.dipinjam
                  return (
                    <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setModal({ type: 'detail', data: p })}>
                        <div className="text-xs font-semibold text-gray-900 truncate">{p.peminjam}</div>
                        <div className="text-xs text-gray-500 truncate">{p.barang} • {p.tarikh_pulang}</div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${s.bg} ${s.text}`}>{s.label}</span>
                      <button onClick={() => deletePeminjaman(p)}
                        className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                        🗑️
                      </button>
                    </div>
                  )
                })}
                {peminjaman.length === 0 && <div className="text-center py-8 text-gray-500 text-xs">Tiada rekod</div>}
              </div>
            </div>
          )}

          {/* Admin: Inventori */}
          {tabAdmin === 'inventori' && (
            <div className="neo-card p-5 space-y-4">
              <SectionHeader icon="📦" title="Urus Inventori" color="text-indigo-400" />

              <div className="rounded-2xl p-4 space-y-3" style={{ background: '#EEF3FF', border: '2px solid #111827' }}>
                <div className="text-xs font-bold text-indigo-400">➕ Tambah Barang Baru</div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Gambar Barang</label>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                      style={{ background: '#E5E7EB', border: '1px solid #D1D5DB' }}>
                      {gambarPreview
                        ? <img src={gambarPreview} className="w-full h-full object-cover" />
                        : <span className="text-2xl">📷</span>}
                    </div>
                    <label className="flex-1 cursor-pointer">
                      <div className="w-full bg-white border border-dashed border-indigo-300 rounded-xl px-3 py-2.5 text-xs text-indigo-500 font-semibold text-center hover:bg-indigo-50 transition-colors">
                        {gambarFile ? gambarFile.name : 'Klik untuk pilih gambar'}
                      </div>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => {
                          const f = e.target.files[0]
                          if (f) { setGambarFile(f); setGambarPreview(URL.createObjectURL(f)) }
                        }} />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nama Barang *</label>
                    <input value={formBarang.nama} onChange={e => setFormBarang(f => ({ ...f, nama: e.target.value }))}
                      placeholder="Contoh: Laptop Acer"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Kod Aset</label>
                    <input value={formBarang.kod} onChange={e => setFormBarang(f => ({ ...f, kod: e.target.value }))}
                      placeholder="Contoh: SK/ICT/001"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">No. Siri</label>
                    <input value={formBarang.no_siri} onChange={e => setFormBarang(f => ({ ...f, no_siri: e.target.value }))}
                      placeholder="Contoh: SN123456"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Lokasi / Bilik</label>
                    <input value={formBarang.lokasi} onChange={e => setFormBarang(f => ({ ...f, lokasi: e.target.value }))}
                      placeholder="Contoh: Makmal ICT 1"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Kategori</label>
                    <select value={formBarang.kategori} onChange={e => setFormBarang(f => ({ ...f, kategori: e.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400">
                      {KATEGORI_LIST.map(k => <option key={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Kuantiti</label>
                    <input type="number" min="1" value={formBarang.kuantiti}
                      onChange={e => setFormBarang(f => ({ ...f, kuantiti: e.target.value }))}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Harga Unit (RM)</label>
                    <input type="number" min="0" step="0.01" value={formBarang.harga_unit}
                      onChange={e => setFormBarang(f => ({ ...f, harga_unit: e.target.value }))}
                      placeholder="0.00"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tarikh Terima</label>
                  <input type="date" value={formBarang.tarikh_terima}
                    onChange={e => setFormBarang(f => ({ ...f, tarikh_terima: e.target.value }))}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-400" />
                </div>

                <button onClick={tambahBarang}
                  className="w-full py-2.5 rounded-xl text-xs font-black neo-btn"
                  style={{ background: '#2563EB', color: '#fff', fontFamily: "'Fredoka', sans-serif" }}>
                  ➕ Tambah Barang
                </button>
              </div>

              <div className="space-y-2.5">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="text-xl">{getKategoriIcon(item.nama)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-900 truncate">{item.nama}</div>
                      <div className="text-xs text-gray-500">{item.kod} • {item.tersedia}/{item.kuantiti} tersedia</div>
                      {item.harga_unit > 0 && (
                        <div className="text-xs text-emerald-600 font-semibold">{formatRM(item.harga_unit)}</div>
                      )}
                    </div>
                    <button onClick={() => setQrModal(item)}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-bold transition-colors flex-shrink-0"
                      style={{ background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE' }}>
                      📱 QR
                    </button>
                    <button onClick={() => deleteBarang(item.id)}
                      className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                      🗑️
                    </button>
                  </div>
                ))}
                {items.length === 0 && <div className="text-center py-8 text-gray-500 text-xs">Tiada barang</div>}
              </div>
            </div>
          )}

          {/* Admin: Import Excel */}
          {tabAdmin === 'import' && (
            <div className="space-y-4">
              <div className="neo-card p-5 space-y-4">
                <div className="text-sm font-bold text-indigo-400">📥 Import Barang dari Excel</div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold text-indigo-700">Format lajur yang diterima:</div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      ['nama *', 'Nama barang (wajib)'],
                      ['kod', 'Kod aset'],
                      ['kategori', 'Laptop/Projektor/dll'],
                      ['kuantiti', 'Jumlah unit'],
                      ['no_siri', 'No. siri'],
                      ['lokasi', 'Bilik/makmal'],
                      ['harga_unit', 'Harga seunit (RM)'],
                      ['tarikh_terima', 'YYYY-MM-DD'],
                    ].map(([k, v]) => (
                      <div key={k} className="text-xs">
                        <span className="font-mono font-bold text-indigo-600">{k}</span>
                        <span className="text-indigo-500"> — {v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={downloadTemplate}
                  className="w-full border border-indigo-200 text-indigo-600 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors">
                  ⬇️ Muat Turun Template Excel
                </button>

                <div>
                  <label className="block text-xs font-semibold text-indigo-400 mb-1.5">Upload Fail Excel (.xlsx / .xls)</label>
                  <label className="block cursor-pointer">
                    <div className={`w-full border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      importLoading
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50'
                    }`}>
                      {importLoading ? (
                        <>
                          <div className="text-3xl mb-2">⏳</div>
                          <div className="text-sm font-bold text-amber-600">Sedang import...</div>
                        </>
                      ) : (
                        <>
                          <div className="text-3xl mb-2">📂</div>
                          <div className="text-sm font-bold text-indigo-600">Klik untuk pilih fail Excel</div>
                          <div className="text-xs text-gray-400 mt-1">.xlsx atau .xls</div>
                        </>
                      )}
                    </div>
                    <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importLoading}
                      onChange={e => {
                        const f = e.target.files[0]
                        if (f) importExcel(f)
                        e.target.value = ''
                      }} />
                  </label>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="text-xs font-bold text-amber-700 mb-1">⚠️ Nota Penting</div>
                <ul className="text-xs text-amber-600 space-y-1 list-disc list-inside">
                  <li>Baris tanpa nama barang akan diabaikan</li>
                  <li>Kuantiti tersedia = kuantiti (stok penuh)</li>
                  <li>Semak data sebelum import — tiada undo</li>
                </ul>
              </div>
            </div>
          )}

          {/* Admin: Log Sejarah */}
          {tabAdmin === 'log' && (
            <div className="neo-card p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader icon="📜" title="Log Sejarah" color="text-indigo-400" />
                <button onClick={fetchLog}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                  🔄 Muat Semula
                </button>
              </div>

              {log.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-4xl mb-2">📜</div>
                  <div className="text-sm text-gray-500">Tiada log</div>
                  <div className="text-xs text-gray-400 mt-1">Pastikan jadual log_ict wujud dalam Supabase</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {log.map(l => (
                    <div key={l.id} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
                      <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center text-base flex-shrink-0">
                        {LOG_ICONS[l.aksi] || '📋'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-gray-900">{l.butiran}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(l.created_at).toLocaleString('ms-MY', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </AdminGate>
      )}

      {/* ── QR MODAL ── */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setQrModal(null)}>
          <div className="rounded-3xl p-6 w-full max-w-xs"
            style={{ background: '#FFFFFF', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

            <div ref={qrRef} id="qr-print-area"
              className="text-center p-5 rounded-2xl"
              style={{ background: '#FFFFFF', border: '2px solid #E5E7EB' }}>
              <img src="https://i.postimg.cc/pdhvk3Q2/images.jpg" alt="SK Darau"
                className="w-12 h-12 rounded-xl object-cover mx-auto mb-2"
                style={{ border: '1px solid #E5E7EB' }} />
              <div className="text-xs font-black mb-0.5" style={{ color: '#4F46E5' }}>SK DARAU</div>
              <div className="text-xs text-gray-500 mb-3">Kota Kinabalu, Sabah</div>

              <div className="flex justify-center mb-3">
                <QRCodeSVG
                  value={`${BASE_URL}/pinjam/${qrModal.id}`}
                  size={160}
                  bgColor="#FFFFFF"
                  fgColor="#1E1B4B"
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div className="text-sm font-black text-gray-900 mb-0.5">{qrModal.nama}</div>
              <div className="text-xs text-gray-500 mb-1">{qrModal.kod}</div>
              <div className="text-xs font-semibold px-3 py-1 rounded-full inline-block"
                style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                Imbas untuk pinjam
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => {
                const w = window.open('', '_blank')
                const svg = document.querySelector('#qr-print-area svg')
                const svgData = svg ? new XMLSerializer().serializeToString(svg) : ''
                const svgB64 = btoa(unescape(encodeURIComponent(svgData)))
                w.document.write(`<!DOCTYPE html><html><head><title>QR - ${qrModal.nama}</title>
                  <style>
                    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #EEF2FF; font-family: sans-serif; }
                    .card { background: white; border: 2px solid #E5E7EB; border-radius: 20px; padding: 32px; text-align: center; max-width: 300px; }
                    img.logo { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; border: 1px solid #E5E7EB; margin-bottom: 8px; }
                    .sekolah { font-size: 11px; font-weight: 900; color: #4F46E5; margin-bottom: 2px; }
                    .lokasi { font-size: 10px; color: #6B7280; margin-bottom: 16px; }
                    .qr-img { width: 180px; height: 180px; margin: 0 auto 12px; display: block; }
                    .nama { font-size: 15px; font-weight: 900; color: #111827; margin-bottom: 2px; }
                    .kod { font-size: 11px; color: #6B7280; margin-bottom: 8px; }
                    .badge { display: inline-block; background: #EEF2FF; color: #4F46E5; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; }
                    @media print { body { background: white; } }
                  </style>
                </head><body>
                  <div class="card">
                    <img class="logo" src="https://i.postimg.cc/pdhvk3Q2/images.jpg" />
                    <div class="sekolah">SK DARAU</div>
                    <div class="lokasi">Kota Kinabalu, Sabah</div>
                    <img class="qr-img" src="data:image/svg+xml;base64,${svgB64}" />
                    <div class="nama">${qrModal.nama}</div>
                    <div class="kod">${qrModal.kod}</div>
                    <div class="badge">Imbas untuk pinjam</div>
                  </div>
                  <script>window.onload=()=>window.print()</script>
                </body></html>`)
                w.document.close()
              }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
                🖨️ Print QR
              </button>
              <button onClick={() => setQrModal(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                Tutup
              </button>
            </div>

            <div className="mt-3 text-xs text-center text-gray-400 break-all">
              {BASE_URL}/pinjam/{qrModal.id}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) { setModal(null); setEditMode(false); setEditData(null) } }}>
          <div className="bg-white border border-gray-200 rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />

            {modal.type === 'detail' && (() => {
              const p = modal.data
              const live = peminjaman.find(x => x.id === p.id) ?? p
              const s = STATUS_CONFIG[live?.status] ?? STATUS_CONFIG.dipinjam
              const ed = editData ?? {}
              return (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-base font-bold text-indigo-400">Detail Peminjaman</div>
                    {isAdmin && !editMode && (
                      <button onClick={() => { setEditMode(true); setEditData({ peminjam: live.peminjam, jawatan: live.jawatan, tarikh_pulang: live.tarikh_pulang, catatan: live.catatan }) }}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100">
                        ✏️ Edit
                      </button>
                    )}
                  </div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text} mb-4`}>{s.label}</div>

                  {editMode ? (
                    <div className="space-y-3 mb-4">
                      {[
                        { label: 'Peminjam', key: 'peminjam' },
                        { label: 'Jawatan', key: 'jawatan' },
                        { label: 'Tarikh Pulang', key: 'tarikh_pulang', type: 'date' },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                          <input type={f.type || 'text'} value={ed[f.key] ?? ''}
                            onChange={e => setEditData(d => ({ ...d, [f.key]: e.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-400" />
                        </div>
                      ))}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Catatan</label>
                        <textarea value={ed.catatan ?? ''} rows={2}
                          onChange={e => setEditData(d => ({ ...d, catatan: e.target.value }))}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-400 resize-none" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => editPeminjaman(live.id, editData)}
                          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700">
                          💾 Simpan
                        </button>
                        <button onClick={() => { setEditMode(false); setEditData(null) }}
                          className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200">
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {[
                        ['Peminjam', live.peminjam], ['Jawatan', live.jawatan], ['Barang', live.barang],
                        ['Kod Aset', live.kod], ['Kuantiti', live.kuantiti + ' unit'],
                        ['Tarikh Pinjam', live.tarikh_pinjam], ['Tarikh Pulang', live.tarikh_pulang],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between py-2 border-b border-gray-200">
                          <span className="text-xs text-gray-500">{k}</span>
                          <span className="text-xs font-bold text-gray-900">{v}</span>
                        </div>
                      ))}
                      {live.catatan && <div className="mt-3 text-xs bg-gray-100 rounded-xl p-3 text-gray-600">{live.catatan}</div>}
                    </>
                  )}

                  {!editMode && (live?.status === 'dipinjam' || live?.status === 'lewat') && (
                    <button onClick={() => pulangBarang(live)}
                      className="w-full mt-4 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 py-3 rounded-2xl text-sm font-bold hover:bg-emerald-500/30">
                      ✅ Tandakan Dipulangkan
                    </button>
                  )}
                  {!editMode && isAdmin && (
                    <button onClick={() => deletePeminjaman(live)}
                      className="w-full mt-2 border border-red-200 text-red-500 py-3 rounded-2xl text-sm font-bold hover:bg-red-50 transition-colors">
                      🗑️ Padam Rekod
                    </button>
                  )}
                  {!editMode && <button onClick={() => { setModal(null); setEditMode(false); setEditData(null) }} className="w-full mt-2 border border-gray-200 text-gray-500 py-3 rounded-2xl text-sm font-bold">Tutup</button>}
                </>
              )
            })()}

            {modal.type === 'item' && (() => {
              const item = modal.data
              const rekodBarang = peminjaman.filter(p => p.barang === item.nama && p.status !== 'dipulangkan')
              const ed = editData ?? {}
              return (
                <>
                  {item.gambar_url && (
                    <div className="w-full h-44 rounded-2xl overflow-hidden mb-4" style={{ border: '1px solid #E5E7EB' }}>
                      <img src={item.gambar_url} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-base font-bold text-indigo-600">{item.nama}</div>
                      <div className="text-xs text-gray-500">{item.kod}</div>
                    </div>
                    {isAdmin && !editMode && (
                      <button onClick={() => {
                        setEditMode(true)
                        setEditData({
                          nama: item.nama, kod: item.kod, kategori: item.kategori,
                          no_siri: item.no_siri || '', lokasi: item.lokasi || '',
                          kuantiti: item.kuantiti, tarikh_terima: item.tarikh_terima || '',
                          harga_unit: item.harga_unit || '',
                        })
                      }}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100">
                        ✏️ Edit
                      </button>
                    )}
                  </div>

                  {editMode ? (
                    <div className="space-y-3 mb-4">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Nama Barang', key: 'nama' },
                          { label: 'Kod Aset', key: 'kod' },
                          { label: 'No. Siri', key: 'no_siri' },
                          { label: 'Lokasi', key: 'lokasi' },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                            <input value={ed[f.key] ?? ''} onChange={e => setEditData(d => ({ ...d, [f.key]: e.target.value }))}
                              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-400" />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Kategori</label>
                          <select value={ed.kategori ?? 'Laptop'} onChange={e => setEditData(d => ({ ...d, kategori: e.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-400">
                            {KATEGORI_LIST.map(k => <option key={k}>{k}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Kuantiti</label>
                          <input type="number" min="1" value={ed.kuantiti ?? 1} onChange={e => setEditData(d => ({ ...d, kuantiti: parseInt(e.target.value) }))}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-400" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Harga (RM)</label>
                          <input type="number" min="0" step="0.01" value={ed.harga_unit ?? ''} onChange={e => setEditData(d => ({ ...d, harga_unit: e.target.value }))}
                            placeholder="0.00"
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-400" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Tarikh Terima</label>
                        <input type="date" value={ed.tarikh_terima ?? ''} onChange={e => setEditData(d => ({ ...d, tarikh_terima: e.target.value }))}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-400" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => editBarang(item.id, editData)}
                          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700">
                          💾 Simpan
                        </button>
                        <button onClick={() => { setEditMode(false); setEditData(null) }}
                          className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200">
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {[
                        ['Kategori',      item.kategori],
                        ['No. Siri',      item.no_siri || '—'],
                        ['Lokasi',        item.lokasi || '—'],
                        ['Tarikh Terima', item.tarikh_terima ? new Date(item.tarikh_terima).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
                        ['Jumlah',        item.kuantiti + ' unit'],
                        ['Tersedia',      item.tersedia + ' unit'],
                        ['Harga Unit',    item.harga_unit > 0 ? formatRM(item.harga_unit) : '—'],
                        ['Nilai Aset',    item.harga_unit > 0 ? formatRM(item.harga_unit * item.kuantiti) : '—'],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-xs text-gray-500">{k}</span>
                          <span className="text-xs font-bold text-gray-900 text-right max-w-[55%]">{v}</span>
                        </div>
                      ))}
                      {rekodBarang.length > 0 && (
                        <div className="mt-4">
                          <div className="text-xs font-bold text-gray-500 mb-2">Sedang Dipinjam Oleh:</div>
                          {rekodBarang.map(r => (
                            <div key={r.id} className="bg-indigo-50 rounded-xl px-3 py-2 text-xs mb-2" style={{ border: '1px solid #C7D2FE' }}>
                              <span className="font-bold text-gray-900">{r.peminjam}</span>
                              {r.jawatan && <span className="text-gray-500"> • {r.jawatan}</span>}
                              <div className="text-gray-500 mt-0.5">{r.kuantiti} unit {r.tarikh_pulang ? `• Pulang: ${r.tarikh_pulang}` : ''}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {!editMode && <button onClick={() => { setModal(null); setEditMode(false); setEditData(null) }}
                    className="w-full mt-4 border border-gray-200 text-gray-500 py-3 rounded-2xl text-sm font-bold">
                    Tutup
                  </button>}
                </>
              )
            })()}
          </div>
        </div>
      )}

    </Layout>
  )
}
