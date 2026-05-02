import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/',        icon: '🏠', label: 'Gambaran Keseluruhan', badge: null },
  { to: '/tempahan',icon: '🏫', label: 'Tempahan Bilik',       badge: 'tempahan' },
  { to: '/ict',     icon: '💻', label: 'Peminjaman ICT',       badge: 'ict' },
  { to: '/delima',  icon: '🌺', label: 'DELIMA',               badge: null },
]

export default function Sidebar({ badgeCounts = {} }) {
  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col z-50"
      style={{ background: '#FFFFFF', borderRight: '3px solid #111827', overflow: 'hidden' }}>

      {/* Decorative top strip */}
      <div style={{ height: 6, background: 'linear-gradient(90deg, #2563EB 0%, #60A5FA 50%, #FFD166 100%)' }} />

      {/* Logo */}
      <div className="p-5" style={{ borderBottom: '3px solid #111827' }}>
        <div className="flex items-center gap-3">
          <div style={{ border: '3px solid #111827', borderRadius: 16, overflow: 'hidden', boxShadow: '3px 3px 0 #111827', flexShrink: 0 }}>
            <img src="/logo-sekolah.jpg" alt="Logo SK Darau"
              className="w-11 h-11 object-cover block" />
          </div>
          <div className="min-w-0">
            <div className="font-black leading-tight tracking-wide" style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 15, color: '#111827' }}>SK DARAU</div>
            <div className="text-xs leading-snug mt-0.5 font-semibold" style={{ color: '#64748B' }}>Kota Kinabalu</div>
            <div className="text-xs mt-0.5 font-semibold italic" style={{ color: '#94A3B8' }}>Dashboard ICT</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1.5 pt-4 overflow-y-auto">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition-all"
            style={({ isActive }) => ({
              background: isActive ? '#2563EB' : 'transparent',
              color: isActive ? '#FFFFFF' : '#374151',
              fontFamily: "'Fredoka', sans-serif",
              fontWeight: isActive ? 600 : 500,
              fontSize: 14,
              border: isActive ? '2px solid #111827' : '2px solid transparent',
              boxShadow: isActive ? '3px 3px 0 #111827' : 'none',
            })}
          >
            <span className="text-base">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge && badgeCounts[item.badge] > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{
                  background: item.badge === 'ict' ? '#DC2626' : '#FFD166',
                  color: item.badge === 'ict' ? '#fff' : '#111827',
                  border: '1.5px solid #111827',
                }}>
                {badgeCounts[item.badge]}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-4" style={{ borderTop: '3px solid #111827' }}>
        <div className="px-3 py-3 rounded-2xl"
          style={{ background: '#EEF3FF', border: '2px solid #111827', boxShadow: '3px 3px 0 #111827' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
              style={{
                background: '#2563EB',
                border: '2px solid #111827',
                boxShadow: '2px 2px 0 #111827',
                fontFamily: "'Fredoka', sans-serif",
                fontSize: 13,
              }}>
              KA
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black leading-tight" style={{ color: '#111827', fontFamily: "'Fredoka', sans-serif", fontSize: 13 }}>En. Khairul Azwani</div>
              <div className="text-xs italic font-semibold" style={{ color: '#64748B' }}>Guru ICT SK Darau</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
