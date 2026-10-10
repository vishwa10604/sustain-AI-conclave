import { Link } from 'react-router-dom'

export default function RoleSelection() {
  return (
    <div className="role-selection-page dark-shell">
      <div className="role-selection-shell dark-panel-shell">
        <div className="brand-block">
          <div className="brand-badge">FleetMind AI</div>
          <h1>Smart Fleet Operations</h1>
          <p>AI-assisted fleet planning, trip assignment, and driver execution.</p>
        </div>

        <div className="role-grid">
          <Link to="/manager-login" className="role-card manager-role">
            <div className="role-title">Manager</div>
            <div className="role-desc">Fleet oversight, trip planning, assignment approval, and reporting.</div>
          </Link>

          <Link to="/driver-login" className="role-card driver-role">
            <div className="role-title">Driver</div>
            <div className="role-desc">Trip status updates, route access, and delivery confirmations.</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
