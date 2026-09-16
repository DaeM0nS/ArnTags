import { Outlet } from 'react-router-dom'

import AppTabBar from '../components/AppTabBar'

export default function AppLayout() {
  return (
    <div className="app-shell">
        <Outlet />
      <AppTabBar />
    </div>
  )
}