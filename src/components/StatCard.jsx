export default function StatCard({ num, label, icon, bg = '#2563EB' }) {
  return (
    <div className="neo-card p-5 animate-bounce-in"
      style={{ background: bg }}>
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl mb-3"
        style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)' }}>
        {icon}
      </div>
      <div className="text-3xl font-black text-white"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}>{num ?? '—'}</div>
      <div className="text-xs font-semibold mt-1.5 italic" style={{ color: 'rgba(255,255,255,0.72)' }}>{label}</div>
    </div>
  )
}
