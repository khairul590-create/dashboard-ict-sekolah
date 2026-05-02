export default function SectionHeader({ icon, title, color = '#2563EB', onMore }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-base">{icon}</span>
        <span className="font-black text-sm" style={{ fontFamily: "'Fredoka', sans-serif", color: '#111827', fontSize: 15 }}>{title}</span>
      </div>
      {onMore && (
        <button onClick={onMore}
          className="text-xs font-bold neo-btn px-3 py-1 rounded-lg"
          style={{ background: '#EEF3FF', color: '#2563EB' }}>
          Lihat semua →
        </button>
      )}
    </div>
  )
}
