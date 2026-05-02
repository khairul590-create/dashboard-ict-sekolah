import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'

export default function Layout({ children, badgeCounts = {}, alertCount = 0 }) {
  const bottomBadges = {
    '/tempahan': badgeCounts.tempahan ?? 0,
    '/ict':      badgeCounts.ict ?? 0,
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar badgeCounts={badgeCounts} />
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <TopBar alertCount={alertCount} />
        <main className="flex-1 px-4 lg:px-8 py-5 pb-24 lg:pb-6 space-y-4 lg:space-y-5 max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>
      <BottomNav badgeCounts={bottomBadges} />
    </div>
  )
}
