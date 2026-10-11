import { useCallback, useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Activity, Bell, Boxes, ChevronLeft, ChevronRight, ClipboardList, X,
  Gauge, Route, Settings, Users, Wrench, LogOut, Search,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { EmptyState, ErrorState, LoadingState } from './ui/States'
import Brand from './Brand'

const navItems = [
  { label: 'Assigned Trips', to: '/', icon: Gauge },
  { label: 'Trip assignment', to: '/trip-assignment', icon: ClipboardList },
  { label: 'Vehicle recommendation', to: '/vehicle-recommendation', icon: Boxes },
  { label: 'Route recommendation', to: '/route-recommendation', icon: Route },
  { label: 'Vehicle availability & maintenance', to: '/vehicle-maintenance', icon: Wrench },
  { label: 'Predictive Maintenance', to: '/predictive-maintenance', icon: Activity },
  { label: 'Driver details', to: '/driver-details', icon: Users },
]

function formatDate(value) {
  if (!value) return 'Not provided'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function timeAgo(value) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 'Time unavailable'
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function Layout({ children, title, showGlobalSearch = true }) {
  const [collapsed, setCollapsed] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [showAlerts, setShowAlerts] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertsError, setAlertsError] = useState('')
  const navigate = useNavigate()
  const email = window.localStorage.getItem('fleetmind.email') || 'Manager'
  
  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true)
    setAlertsError('')
    try {
      const data = await apiRequest('/alerts')
      setAlerts(Array.isArray(data) ? data : [])
    } catch (err) {
      setAlertsError(err.message || 'Failed to load alerts')
    } finally {
      setAlertsLoading(false)
    }
  }, [])
  
  const acknowledgeAlert = useCallback(async (alertId) => {
    try {
      await apiRequest(`/alerts/${alertId}/acknowledge`, { method: 'POST' })
      await loadAlerts()
    } catch (err) {
      setAlertsError(err.message || 'Unable to acknowledge alert')
    }
  }, [loadAlerts])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  useEffect(() => {
    if (showAlerts) loadAlerts()
  }, [showAlerts, loadAlerts])

  useEffect(() => {
    if (!showAlerts) return undefined
    const handleKeyDown = event => {
      if (event.key === 'Escape') setShowAlerts(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAlerts])

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
          <Brand compact={collapsed} />
        </div>
        <nav className="nav-links" aria-label="Manager navigation">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} title={collapsed ? label : undefined}
              end={to === '/'}
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
            {showGlobalSearch && (
              <label className="global-search">
                <Search size={15} aria-hidden="true" />
                <input aria-label="Search current page" placeholder="Search current page" value={globalSearch}
                  onChange={event => {
                    setGlobalSearch(event.target.value)
                    window.dispatchEvent(new CustomEvent('fleetmind-search', { detail: event.target.value }))
                  }} />
              </label>
            )}
            <div className="notification-control">
              <button type="button" className="top-icon-button notification-button"
                aria-label="View fleet alerts" aria-expanded={showAlerts}
                aria-controls="fleet-alerts-popover" title="View and acknowledge fleet alerts"
                onClick={() => setShowAlerts(value => !value)}>
                <Bell size={17} />
              </button>
              {showAlerts && (
                <div className="notification-backdrop" onClick={() => setShowAlerts(false)}>
                  <section id="fleet-alerts-popover" className="notification-popover"
                    role="dialog" aria-modal="true" aria-labelledby="fleet-alerts-title"
                    onClick={event => event.stopPropagation()}>
                    <header className="notification-header">
                      <div>
                        <h2 id="fleet-alerts-title">Fleet alerts</h2>
                        <p>Recent operational updates</p>
                      </div>
                      <button type="button" className="top-icon-button" aria-label="Close alerts"
                        onClick={() => setShowAlerts(false)}><X size={16} /></button>
                    </header>
                    <div className="notification-content">
                      {alertsLoading && alerts.length === 0
                        ? <LoadingState label="Loading alerts" />
                        : alertsError
                          ? <ErrorState message={`Alerts unavailable: ${alertsError}`} onRetry={loadAlerts} />
                          : alerts.length === 0
                            ? <EmptyState title="No alerts" detail="No operational alerts have been recorded." />
                            : [...alerts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(alert => (
                              <article className="notification-alert" key={alert.id}>
                                <span className={`severity-dot ${String(alert.severity || '').toLowerCase()}`} />
                                <div className="notification-alert-details">
                                  <div className="notification-alert-heading">
                                    <strong>{alert.alertType || 'Fleet alert'}</strong>
                                    <span className={`alert-severity ${String(alert.severity || '').toLowerCase()}`}>
                                      {alert.severity || 'UNKNOWN'}
                                    </span>
                                  </div>
                                  <p>{alert.message || 'No additional details provided.'}</p>
                                  <time dateTime={alert.createdAt || undefined} title={formatDate(alert.createdAt)}>
                                    {timeAgo(alert.createdAt)}
                                  </time>
                                  {alert.status === 'ACKNOWLEDGED'
                                    ? <span className="status-badge success">Acknowledged</span>
                                    : <button type="button" className="text-button"
                                      onClick={() => acknowledgeAlert(alert.id)}>Acknowledge</button>}
                                </div>
                              </article>
                            ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
            <div className="user-menu">
              <span className="avatar">{email.slice(0, 1).toUpperCase()}</span>
              <span className="user-email">{email}</span>
              <button className="top-icon-button" onClick={signOut} aria-label="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}
