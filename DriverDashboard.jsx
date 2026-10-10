import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ClipboardList, LogOut, MapPin, UserRound } from 'lucide-react'
import { apiRequest } from '../lib/api'
import StepTracker from '../components/ui/StepTracker'
import { ErrorState, EmptyState, LoadingState } from '../components/ui/States'

function getCurrentLocation() {
  if (!navigator.geolocation) return Promise.resolve({})
  return new Promise(resolve => navigator.geolocation.getCurrentPosition(
    position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
    () => resolve({}),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 },
  ))
}

function date(value) {
  if (!value) return 'Not provided'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

export default function DriverDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [trips, setTrips] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [report, setReport] = useState({ alertType: 'DELAY', severity: 'MEDIUM', message: '' })
  const [busy, setBusy] = useState(false)

  const loadDriverData = useCallback(async () => {
    setLoading(true)
    setError('')
    const results = await Promise.allSettled([
      apiRequest('/whoami'),
      apiRequest('/driver/trips'),
      apiRequest('/driver/history'),
    ])
    const [identityResult, tripsResult, historyResult] = results
    if (identityResult.status !== 'fulfilled' || identityResult.value.role !== 'DRIVER') {
      setError(identityResult.status === 'rejected'
        ? identityResult.reason.message
        : 'The authenticated account is not a driver.')
      setUser(null)
    } else {
      setUser(identityResult.value)
    }
    if (tripsResult.status === 'fulfilled') setTrips(tripsResult.value)
    else {
      setTrips([])
      setError(current => current || tripsResult.reason.message)
    }
    if (historyResult.status === 'fulfilled') setHistory(historyResult.value)
    else {
      setHistory([])
      setError(current => current || historyResult.reason.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadDriverData() }, [loadDriverData])

  function signOut() {
    window.localStorage.removeItem('fleetmind.token')
    window.localStorage.removeItem('fleetmind.role')
    window.localStorage.removeItem('fleetmind.email')
    navigate('/driver-login', { replace: true })
  }

  async function updateTrip(trip) {
    const status = trip.status === 'ASSIGNED' ? 'IN_PROGRESS' : 'DELIVERED'
    const confirmation = status === 'IN_PROGRESS'
      ? `Start ${trip.referenceNumber}? This will update its status for fleet operations.`
      : `Mark ${trip.referenceNumber} as delivered? This will complete the assignment.`
    if (!window.confirm(confirmation)) return
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      const location = await getCurrentLocation()
      await apiRequest(`/driver/trips/${trip.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, ...location, notes: status === 'DELIVERED' ? 'Driver marked delivery complete.' : 'Driver started trip.' }),
      })
      setNotice(`Trip ${trip.referenceNumber} updated to ${status.replaceAll('_', ' ')}.`)
      await loadDriverData()
    } catch (requestError) {
      setActionError(requestError.message || 'Trip status update failed.')
    } finally {
      setBusy(false)
    }
  }

  async function submitIssue(event) {
    event.preventDefault()
    if (!report.message.trim()) return
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      const location = await getCurrentLocation()
      await apiRequest('/driver/issues', {
        method: 'POST',
        body: JSON.stringify({ ...report, message: report.message.trim(), ...location }),
      })
      setNotice('Issue report submitted to fleet alerts.')
      setReport({ alertType: 'DELAY', severity: 'MEDIUM', message: '' })
      setReportOpen(false)
      await loadDriverData()
    } catch (requestError) {
      setActionError(requestError.message || 'Issue report failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="driver-shell">
      <header className="driver-topbar">
        <div className="driver-brand"><span className="brand-mark">FM</span> FleetMind AI</div>
        <div className="driver-user">
          <span>{user?.email || window.localStorage.getItem('fleetmind.email')}</span>
          <button className="top-icon-button" onClick={signOut} aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </header>
      <main className="driver-content">
        <div className="driver-welcome">
          <span className="eyebrow">Driver workspace</span>
          <h1>My dashboard</h1>
          <p>Only this authenticated driver's assigned trips and history are shown.</p>
        </div>
        {loading && <LoadingState label="Loading your fleet data" />}
        {!loading && error && <ErrorState message={`Driver data could not be fully loaded: ${error}`} onRetry={loadDriverData} />}
        {notice && <div className="success-message" role="status">{notice}</div>}
        {actionError && <ErrorState message={actionError} />}
        {!loading && user && (
          <>
            <section className="driver-identity-card reference-panel">
              <UserRound size={20} />
              <div><span className="mini-label">Signed in as</span><strong>{user.name || user.email}</strong></div>
              <span className="status-badge success">Driver account verified</span>
            </section>

            <div className="driver-section-title"><h2>My assigned trips</h2><button className="secondary-btn compact-btn" onClick={loadDriverData}>Refresh</button></div>
            {!error && trips.length === 0 && (
              <section className="reference-panel driver-empty-card">
                <ClipboardList size={22} />
                <EmptyState title="No active trip assigned" detail="Ask your manager to assign a trip to your driver account." />
              </section>
            )}
            {trips.map(trip => (
              <section className="reference-panel driver-trip-card" key={trip.id}>
                <div className="driver-trip-head">
                  <div><span className="mini-label">Trip reference</span><h2>{trip.referenceNumber}</h2></div>
                  <span className="status-badge info">{trip.status.replaceAll('_', ' ')}</span>
                </div>
                <StepTracker status={trip.status} />
                <div className="driver-trip-grid">
                  <div><span>Origin</span><strong>{trip.originName}</strong></div>
                  <div><span>Destination</span><strong>{trip.destinationName}</strong></div>
                  <div><span>Vehicle</span><strong>{trip.vehicleRegistration || 'Not assigned'}</strong></div>
                  <div><span>Cargo</span><strong>{trip.cargoWeightKg} kg · {trip.cargoVolume} m³</strong></div>
                  <div><span>Pickup</span><strong>{date(trip.requestedPickupTime)}</strong></div>
                  <div><span>Delivery deadline</span><strong>{date(trip.deliveryDeadline)}</strong></div>
                </div>
                {trip.events?.length > 0 && (
                  <div className="driver-event-list">
                    <strong>Trip events</strong>
                    {trip.events.map(item => <div key={item.id}><span>{item.eventType.replaceAll('_', ' ')}</span><time>{date(item.eventTimestamp)}</time><small>{item.notes}</small></div>)}
                  </div>
                )}
                <div className="driver-actions">
                  {trip.status === 'ASSIGNED' && <button className="primary-btn" disabled={busy} onClick={() => updateTrip(trip)}>Accept & start trip</button>}
                  {trip.status === 'IN_PROGRESS' && <button className="primary-btn" disabled={busy} onClick={() => updateTrip(trip)}>Mark delivered</button>}
                  <button className="secondary-btn" onClick={() => setReportOpen(value => !value)}><AlertTriangle size={14} /> Report delay or issue</button>
                </div>
              </section>
            ))}

            {reportOpen && (
              <form className="reference-panel trip-create-form driver-report-form" onSubmit={submitIssue}>
                <h3>Report delay or issue</h3>
                <div className="form-grid">
                  <label>Issue type<select value={report.alertType} onChange={event => setReport({ ...report, alertType: event.target.value })}>
                    <option value="DELAY">Delay</option><option value="VEHICLE_ISSUE">Vehicle issue</option><option value="SAFETY">Safety concern</option><option value="OTHER">Other</option>
                  </select></label>
                  <label>Severity<select value={report.severity} onChange={event => setReport({ ...report, severity: event.target.value })}>
                    <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
                  </select></label>
                  <label className="full-width-field">Details<textarea required rows="3" value={report.message} onChange={event => setReport({ ...report, message: event.target.value })} /></label>
                </div>
                <div className="form-actions"><button className="primary-btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</button><span className="form-hint"><MapPin size={12} /> Recorded location is attached if available.</span></div>
              </form>
            )}

            <section className="reference-panel driver-history-panel">
              <h2>My trip history</h2>
              {history.length === 0
                ? <EmptyState title="No completed trips yet" detail="Completed trips assigned to your account will appear here." />
                : history.map(trip => <div className="history-row" key={trip.id}><strong>{trip.referenceNumber}</strong><span>{trip.originName} → {trip.destinationName}</span><span>{date(trip.deliveryDeadline)}</span></div>)}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
