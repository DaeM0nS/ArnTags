import { NavLink } from 'react-router-dom'

type TabItem = {
  to: string
  label: string
  icon: string
  end?: boolean
}

const tabs: TabItem[] = [
  { to: '/tags', label: 'Coffre', icon: '▣' },
  { to: '/scanner', label: 'Scanner', icon: '⌁' },
  { to: '/profile', label: 'Profil', icon: '✦' },
]

export default function AppTabBar() {
  return (
    <nav className="app-tab-bar" aria-label="Navigation principale">
      <div className="app-tab-bar__inner">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `app-tab-bar__item${isActive ? ' app-tab-bar__item--active' : ''}`}
          >
            <span className="app-tab-bar__icon" aria-hidden="true">{tab.icon}</span>
            <span className="app-tab-bar__label">{tab.label}</span>
            <span className="app-tab-bar__indicator" aria-hidden="true" />
          </NavLink>
        ))}
      </div>
    </nav>
  )
}