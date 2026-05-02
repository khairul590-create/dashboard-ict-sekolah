import { useLocation, Link } from 'react-router-dom'

const TITLES = {
  '/':         'Gambaran Keseluruhan',
  '/tempahan': '🏫 Tempahan Bilik Khas',
  '/ict':      '💻 Peminjaman Barang ICT',
  '/delima':   '🌺 Pengurusan ID DELIMA',
}

const MOBILE_NAV = [
  { to: '/',         label: '🏠 Utama' },
  { to: '/tempahan', label: '🏫 Bilik' },
  { to: '/ict',      label: '💻 ICT' },
  { to: '/delima',   label: '🌺 DELIMA' },
]

export default function TopBar({ alertCount = 0 }) {
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? 'Dashboard'

  return (
    <>
      <header className="sticky top-0 z-40 px-4 lg:px-8 py-3.5 flex items-center justify-between"
        style={{ background: '#FFFFFF', borderBottom: '3px solid #111827' }}>
        <div className="flex items-center gap-3">
          <div style={{ border: '2px solid #111827', borderRadius: 12, overflow: 'hidden', boxShadow: '2px 2px 0 #111827', flexShrink: 0 }}
            className="lg:hidden">
            <img src="https://i.postimg.cc/pdhvk3Q2/images.jpg" alt="Logo SK Darau"
              className="w-9 h-9 object-cover block" />
          </div>
          <div>
            <div className="font-black leading-tight" style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 18, color: '#111827' }}>{title}</div>
            <div className="text-xs mt-0.5 italic font-semibold" style={{ color: '#64748B', fontFamily: "'Nunito', sans-serif" }}>
              SK Darau, Kota Kinabalu &nbsp;•&nbsp;{' '}
              {new Date().toLocaleDateString('ms-MY', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/" className="relative w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all"
            style={{ background: '#FFFFFF', border: '2px solid #111827', boxShadow: '3px 3px 0 #111827' }}>
            🔔
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center font-black text-white"
                style={{ border: '1.5px solid #111827' }}>
                {alertCount}
              </span>
            )}
          </Link>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white"
            style={{
              background: '#2563EB',
              border: '2px solid #111827',
              boxShadow: '3px 3px 0 #111827',
              fontFamily: "'Fredoka', sans-serif",
              fontSize: 13,
            }}>
            KA
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <div className="lg:hidden px-4 pt-3 pb-1">
        <div className="flex gap-1.5 rounded-2xl p-1.5 overflow-x-auto scrollbar-hide"
          style={{ background: '#FFFFFF', border: '2px solid #111827', boxShadow: '3px 3px 0 #111827' }}>
          {MOBILE_NAV.map(t => (
            <Link key={t.to} to={t.to}
              className="flex-shrink-0 px-4 py-2 rounded-xl font-bold transition-all"
              style={{
                fontFamily: "'Fredoka', sans-serif",
                fontSize: 13,
                background: pathname === t.to ? '#2563EB' : 'transparent',
                color: pathname === t.to ? '#fff' : '#64748B',
                border: pathname === t.to ? '1.5px solid #111827' : '1.5px solid transparent',
                boxShadow: pathname === t.to ? '2px 2px 0 #111827' : 'none',
              }}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
