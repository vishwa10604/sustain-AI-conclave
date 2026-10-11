import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import Brand from '../components/Brand'

function SteeringWheelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M3.5 9.5c2.2 1.5 5.3 2.2 8.5 2.2s6.3-.7 8.5-2.2M12 14.2v6.6M8.5 12.8l-4.8 4.8m11.8-4.8 4.8 4.8" />
    </svg>
  )
}

export default function RoleSelection() {
  return (
    <div className="role-selection-page dark-shell">
      <div className="role-selection-shell dark-panel-shell">
        <div className="brand-block">
          <Brand />
          <h1>Fleet Management &amp; Operations</h1>
          <p>AI-assisted fleet planning, trip assignment, and driver execution.</p>
        </div>

        <div className="role-grid">
          <Link to="/manager-login" className="role-card manager-role">
            <Building2 className="role-icon" size={34} strokeWidth={1.8} aria-hidden="true" />
            <div className="role-title">Manager</div>
          </Link>

          <Link to="/driver-login" className="role-card driver-role">
            <SteeringWheelIcon />
            <div className="role-title">Driver</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
