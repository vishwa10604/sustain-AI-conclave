import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Activity, Bell, Boxes, ChevronLeft, ChevronRight, ClipboardList,
  Gauge, Route, Settings, Users, Wrench, LogOut, Search,
} from 'lucide-react'

const navItems = [
  { label: 'Overview', to: '/dashboard', icon: Gauge },
  { label: 'Trip assignment', to: '/trip-assignment', icon: ClipboardList },
  { label: 'Vehicle recommendation', to: '/vehicle-recommendation', icon: Boxes },
  { label: 'Route recommendation', to: '/route-recommendation', icon: Route },
  { label: 'Vehicle availability & maintenance', to: '/vehicle-maintenance', icon: Wrench },
  { label: 'Driver details', to: '/driver-details', icon: Users },
]

export default function Layout({ children, title }) {
  const [collapsed, setCollapsed] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const navigate = useNavigate()
  const email = window.localStorage.getItem('fleetmind.email') || 'Manager'

  function signOut() {
    window.localStorage.removeItem('fleetmind.token')
    window.localStorage.removeItem('fleetmind.role')
    window.localStorage.removeItem('fleetmind.email')
    navigate('/manager-login', { replace: true })
  }

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand-block-side">
          <div className="brand-mark">FM</div>
          {!collapsed && <div><div className="brand">FleetMind AI</div><div className="brand-subtitle">Fleet operations</div></div>}
        </div>
        <nav className="nav-links" aria-label="Manager navigation">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} title={collapsed ? label : undefined}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} aria-hidden="true" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
        <button className="collapse-button" onClick={() => setCollapsed(value => !value)}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          {!collapsed && 'Collapse'}
        </button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <div className="crumbs">Operations / Fleet control</div>
            <h1 className="page-title">{title}</h1>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <Search size={15} aria-hidden="true" />
              <input aria-label="Search current page" placeholder="Search current page" value={globalSearch}
                onChange={event => {
                  setGlobalSearch(event.target.value)
                  window.dispatchEvent(new CustomEvent('fleetmind-search', { detail: event.target.value }))
                }} />
            </label>
            <button type="button" className="top-icon-button" aria-label="View fleet alerts"
              title="View and acknowledge fleet alerts" onClick={() => navigate('/dashboard#alerts')}>
              <Bell size={17} />
            </button>
            <div className="user-menu">
              <span className="avatar">{email.slice(0, 1).toUpperCase()}</span>
              <span className="user-email">{email}</span>
              <button className="top-icon-button" onClick={signOut} aria-label="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>
        <div className="toolbar" aria-label="Fleet operations sections">
          {navItems.map(({ label, to }) => (
            <NavLink key={`toolbar-${to}`} to={to}
              className={({ isActive }) => `toolbar-item ${isActive ? 'active' : ''}`}>
              {label}
            </NavLink>
          ))}
        </div>
        {children}
      </main>
    </div>
  )
}
