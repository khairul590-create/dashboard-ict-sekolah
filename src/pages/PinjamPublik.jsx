import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { todayLocal } from '../lib/dateUtil'

const TODAY = todayLocal()

export default function PinjamPublik() {
  const { barangId } = useParams()
  const [barang, setBarang] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    nama: '', jawatan: '', sebab: '', anggaran_pulang: '',
  })

  useEffect(() => {
    async function fetchBarang() {
      const { data } = await supabase
        .from('barang_ict')
        .select('*')
        .eq('id', barangId)
        .single()
      setBarang(data)
      setLoading(false)
    }
    fetchBarang()
  }, [barangId])

  async function handleSubmit() {
    if (!form.nama.trim() || !form.sebab.trim()) {
      setError('Sila isi nama penuh dan sebab peminjaman.')
      return
    }
    if (barang?.tersedia < 1) {
      setError('Maaf, barang ini tiada stok tersedia.')
      return
    }

    setSubmitting(true)
    setError('')

    const { error: e1 } = await supabase.from('peminjaman_ict').insert([{
      peminjam: form.nama.trim(),
      jawatan: form.jawatan.trim(),
      barang: barang.nama,
      kod: barang.kod,
      kuantiti: 1,
      tarikh_pinjam: TODAY,
      tarikh_pulang: form.anggaran_pulang || null,
      catatan: form.sebab.trim(),
      status: 'dipinjam',
    }])

    if (e1) { setError('Ralat sistem: ' + e1.message); setSubmitting(false); return }

    await supabase.from('barang_ict')
      .update({ tersedia: barang.tersedia - 1 })
      .eq('id', barang.id)

    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#EEF2FF' }}>
        <div className="text-sm text-gray-500">Memuatkan...</div>
      </div>
    )
  }

  if (!barang) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#EEF2FF' }}>
        <div className="text-center">
          <div className="text-5xl mb-4">❓</div>
          <div className="text-base font-bold text-gray-800">Barang tidak dijumpai</div>
          <div className="text-sm text-gray-500 mt-1">QR kod mungkin sudah lapuk. Hubungi guru ICT.</div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#EEF2FF' }}>
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-4">✅</div>
          <div className="text-xl font-black mb-2" style={{ color: '#059669' }}>Berjaya Dipinjam!</div>
          <div className="rounded-2xl p-5 mb-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <div className="text-sm font-bold text-gray-800 mb-3">{barang.nama}</div>
            <div className="space-y-2 text-left">
              {[
                ['Peminjam', form.nama],
                ['Sebab', form.sebab],
                ['Tarikh', new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })],
                ...(form.anggaran_pulang ? [['Anggaran Pulang', new Date(form.anggaran_pulang).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2 text-xs">
                  <span className="text-gray-500 w-28 flex-shrink-0">{k}</span>
                  <span className="font-semibold text-gray-800">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Rekod peminjaman telah disimpan.<br />Sila pulangkan barang dalam keadaan baik.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#EEF2FF' }}>
      <div className="w-full max-w-sm space-y-4">

        {/* Header */}
        <div className="text-center">
          <img src="https://i.postimg.cc/pdhvk3Q2/images.jpg" alt="SK Darau"
            className="w-14 h-14 rounded-2xl object-cover mx-auto mb-3"
            style={{ border: '1px solid #E5E7EB' }} />
          <div className="text-xs font-bold" style={{ color: '#4F46E5' }}>SEKOLAH KEBANGSAAN DARAU</div>
          <div className="text-xs text-gray-500">Kota Kinabalu, Sabah</div>
        </div>

        {/* Barang info */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          {barang.gambar_url && (
            <img src={barang.gambar_url} alt={barang.nama}
              className="w-full h-40 object-cover" />
          )}
          <div className="p-4 flex items-center gap-3">
            {!barang.gambar_url && <div className="text-3xl">📦</div>}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-gray-900">{barang.nama}</div>
              <div className="text-xs text-gray-500">{barang.kod} • {barang.kategori}</div>
              {barang.lokasi && <div className="text-xs text-indigo-500 mt-0.5">📍 {barang.lokasi}</div>}
              {barang.no_siri && <div className="text-xs text-gray-400 mt-0.5">S/N: {barang.no_siri}</div>}
              <div className={`text-xs font-semibold mt-1 ${barang.tersedia > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {barang.tersedia > 0 ? `✅ ${barang.tersedia} unit tersedia` : '❌ Tiada stok'}
              </div>
            </div>
          </div>
        </div>

        {barang.tersedia < 1 ? (
          <div className="rounded-2xl p-4 text-center text-sm font-semibold text-red-600"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            Maaf, barang ini sedang habis dipinjam.<br />
            <span className="text-xs font-normal text-red-500">Hubungi guru ICT untuk maklumat lanjut.</span>
          </div>
        ) : (
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>

            <div className="text-sm font-bold" style={{ color: '#111827' }}>📝 Borang Peminjaman</div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4F46E5' }}>
                Nama Penuh *
              </label>
              <input value={form.nama}
                onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                placeholder="Contoh: Ahmad bin Ali"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4F46E5' }}>
                Jawatan / Kelas
              </label>
              <input value={form.jawatan}
                onChange={e => setForm(f => ({ ...f, jawatan: e.target.value }))}
                placeholder="Contoh: Guru Sains / 6 Amanah"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4F46E5' }}>
                Sebab Peminjaman *
              </label>
              <textarea value={form.sebab}
                onChange={e => setForm(f => ({ ...f, sebab: e.target.value }))}
                placeholder="Contoh: Pengajaran dan pembelajaran Matematik tahun 6..."
                rows={3}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>
                Anggaran Tarikh Pulang <span className="font-normal">(tidak wajib)</span>
              </label>
              <input type="date" value={form.anggaran_pulang}
                min={TODAY}
                onChange={e => setForm(f => ({ ...f, anggaran_pulang: e.target.value }))}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
            </div>

            {error && (
              <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                ⚠️ {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
              {submitting ? 'Menyimpan...' : '📤 Hantar Peminjaman'}
            </button>

            <div className="text-xs text-center text-gray-400">
              Rekod akan disimpan dalam sistem ICT SK Darau
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
