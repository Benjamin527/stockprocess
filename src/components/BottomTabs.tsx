type ViewTab = 'dashboard' | 'goals'

type BottomTabsProps = {
  activeTab: ViewTab
  onChange: (tab: ViewTab) => void
}

export function BottomTabs({ activeTab, onChange }: BottomTabsProps) {
  return (
    <nav className="bottom-tabs" aria-label="Primary">
      <button
        type="button"
        className={`bottom-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onChange('dashboard')}
      >
        Dashboard
      </button>
      <button
        type="button"
        className={`bottom-tab ${activeTab === 'goals' ? 'active' : ''}`}
        onClick={() => onChange('goals')}
      >
        Goals
      </button>
    </nav>
  )
}
