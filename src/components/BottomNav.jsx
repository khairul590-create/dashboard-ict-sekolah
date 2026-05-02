import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/',         icon: '🏠', label: 'Utama' },
  { to: '/tempahan', icon: '🏫', label: 'Bilik' },
  { to: '/ict',      icon: '💻', label: 'ICT' },
  { to: '/delima',   icon: '🌺', label: 'DELIMA' },
]

export default function BottomNav({ badgeCounts = {} }) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{ background: '#FFFFFF', borderTop: '3px solid #111827' }}>
      <div className="flex" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {NAV.map((item, i) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative"
            style={({ isActive }) => ({
              background: isActive ? '#EEF3FF' : 'transparent',
              borderRight: i < NAV.length - 1 ? '2px solid #E5E7EB' : 'none',
            })}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <div style={{
                    position: 'absolute', top: 0, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 36, height: 3,
                    background: '#2563EB',
                    borderRadius: '0 0 4px 4px',
                  }} />
                )}
                <span className="text-[20px] leading-none relative">
                  {item.icon}
                  {badgeCounts[item.to] > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full flex items-center justify-center font-black"
                      style={{ fontSize: 8, border: '1.5px solid #111827' }}>
                      {badgeCounts[item.to]}
                    </span>
                  )}
                </span>
                <span style={{
                  fontFamily: "'Fredoka', sans-serif",
                  fontSize: 10,
                  fontWeight: 700,
                  color: isActive ? '#2563EB' : '#94A3B8',
                }}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
