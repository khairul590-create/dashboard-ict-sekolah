import { useState } from 'react'
import { useAdmin } from '../contexts/AdminContext'

export default function AdminGate({ children }) {
  const { isAdmin, login, logout, loading } = useAdmin()
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ email: '', pass: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleLogin = async () => {
    setBusy(true)
    const ok = await login(form.email, form.pass)
    setBusy(false)
    if (ok) { setShow(false); setForm({ email: '', pass: '' }); setError('') }
    else setError('Emel atau password salah.')
  }

  if (loading) return null

  if (isAdmin) {
    return (
      <>
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: '#059669' }}>
            <span>🔓</span> Mod Admin Aktif
          </div>
          <button onClick={logout}
            className="text-xs px-3 py-1.5 rounded-xl border transition-colors"
            style={{ color: '#DC2626', borderColor: '#FECACA', background: '#FEF2F2' }}>
            Log Keluar Admin
          </button>
        </div>
        {children}
      </>
    )
  }

  return (
    <>
      <div className="rounded-2xl p-6 text-center"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div className="text-3xl mb-3">🔐</div>
        <div className="text-sm font-bold mb-1" style={{ color: '#111827' }}>Kawasan Admin</div>
        <div className="text-xs mb-4" style={{ color: '#6B7280' }}>Log masuk sebagai admin untuk mengurus data.</div>
        <button onClick={() => setShow(true)}
          className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
          Log Masuk Admin
        </button>
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => e.target === e.currentTarget && setShow(false)}>
          <div className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: '#FFFFFF', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div className="text-base font-bold mb-1" style={{ color: '#111827' }}>Log Masuk Admin</div>
            <div className="text-xs mb-5" style={{ color: '#6B7280' }}>Masukkan credentials untuk akses penuh.</div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4F46E5' }}>Emel Admin</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  type="email"
                  placeholder="admin@sekolah.edu.my"
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4F46E5' }}>Password</label>
                <input type="password" value={form.pass} onChange={e => setForm(f => ({ ...f, pass: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>
              {error && <div className="text-xs font-semibold" style={{ color: '#DC2626' }}>{error}</div>}
            </div>

            <div className="flex gap-2">
              <button onClick={handleLogin} disabled={busy}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
                {busy ? 'Masuk...' : 'Masuk'}
              </button>
              <button onClick={() => { setShow(false); setError('') }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
