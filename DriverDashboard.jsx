import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, ClipboardList, Clock3, Fuel, Gauge, History,
  LogOut, MapPin, Route, ShieldCheck, Truck, UserRound,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import StepTracker from '../components/ui/StepTracker'
import Brand from '../components/Brand'
import { ErrorState, EmptyState, LoadingState } from '../components/ui/States'

const driverNav = [
  { label: 'Trip requests', path: 'requests', icon: ClipboardList },
  { label: 'My assigned trips', path: 'assigned', icon: Truck },
  { label: 'Assigned routes', path: 'routes', icon: Route },
  { label: 'Trip history', path: 'history', icon: History },
  { label: 'Drive score', path: 'score', icon: Gauge },
  { label: 'My profile', path: 'profile', icon: UserRound },
]

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

function ageFrom(dateOfBirth) {
  if (!dateOfBirth) return 'Not recorded'
  const birth = new Date(`${dateOfBirth}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return 'Not recorded'
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1
  return age >= 0 ? `${age} years` : 'Not recorded'
}

function accepted(trip) {
  return Array.isArray(trip.events) && trip.events.some(event => event.eventType === 'ACCEPTED')
}

function deliveredAt(trip) {
  const events = Array.isArray(trip.events) ? trip.events : []
  const event = events
    .filter(item => item.eventType === 'DELIVERED' && Number.isFinite(new Date(item.eventTimestamp).getTime()))
    .sort((a, b) => new Date(b.eventTimestamp) - new Date(a.eventTimestamp))[0]
  return event?.eventTimestamp || null
}

export default function DriverDashboard({ section = 'assigned' }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [trips, setTrips] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [requestRefreshError, setRequestRefreshError] = useState('')
  const [notice, setNotice] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [report, setReport] = useState({ alertType: 'DELAY', severity: 'MEDIUM', message: '' })
  const [busy, setBusy] = useState(false)
  const [refreshingRequest, setRefreshingRequest] = useState(false)

  const loadDriverData = useCallback(async () => {
    setLoading(true)
    setError('')
    const results = await Promise.allSettled([
      apiRequest('/whoami'),
      apiRequest('/driver/profile'),
      apiRequest('/driver/trips'),
      apiRequest('/driver/history'),
    ])
    const [identityResult, profileResult, tripsResult, historyResult] = results
    if (identityResult.status !== 'fulfilled' || identityResult.value.role !== 'DRIVER') {
      setError(identityResult.status === 'rejected'
        ? identityResult.reason.message
        : 'The authenticated account is not a driver.')
      setUser(null)
    } else {
      setUser(identityResult.value)
    }
    if (profileResult.status === 'fulfilled') setProfile(profileResult.value)
    else {
      setProfile(null)
      setError(current => current || profileResult.reason.message)
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

  const pendingRequests = useMemo(() => trips.filter(trip =>
    trip.status === 'ASSIGNED' && !accepted(trip)), [trips])
  const assignedTrips = useMemo(() => trips.filter(trip =>
    trip.status === 'IN_PROGRESS' || (trip.status === 'ASSIGNED' && accepted(trip))), [trips])
  const selectedRouteTrip = assignedTrips.find(trip => String(trip.id) === searchParams.get('trip'))
    || assignedTrips[0] || null
  const scoreMetrics = useMemo(() => {
    const measurable = history.map(trip => {
      const completedAt = deliveredAt(trip)
      const deadline = new Date(trip.deliveryDeadline).getTime()
      if (!completedAt || !Number.isFinite(deadline)) return null
      return new Date(completedAt).getTime() <= deadline
    }).filter(value => value !== null)
    const onTime = measurable.filter(Boolean).length
    return {
      completed: history.length,
      measured: measurable.length,
      onTime,
      score: measurable.length ? Math.round((onTime / measurable.length) * 100) : null,
    }
  }, [history])

  function signOut() {
    window.localStorage.removeItem('fleetmind.token')
    window.localStorage.removeItem('fleetmind.role')
    window.localStorage.removeItem('fleetmind.email')
    navigate('/driver-login', { replace: true })
  }

  async function acceptTrip(trip) {
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      await apiRequest(`/driver/trips/${trip.id}/accept`, { method: 'POST' })
      setNotice(`${trip.referenceNumber} accepted. It is now in My assigned trips.`)
      await loadDriverData()
      navigate('/driver-dashboard/assigned')
    } catch (requestError) {
      setActionError(requestError.message || 'Unable to accept this trip.')
    } finally {
      setBusy(false)
    }
  }

  async function regenerateRequest() {
    setRefreshingRequest(true)
    setRequestRefreshError('')
    setActionError('')
    setNotice('')
    try {
      const trip = await apiRequest('/driver/requests/refresh', { method: 'POST' })
      await loadDriverData()
      setNotice(`A new synthetic request was generated: ${trip.referenceNumber}.`)
    } catch (requestError) {
      setRequestRefreshError(requestError.message || 'Unable to regenerate the synthetic request.')
    } finally {
      setRefreshingRequest(false)
    }
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

  const googleDirections = selectedRouteTrip
    && selectedRouteTrip.originLatitude != null && selectedRouteTrip.originLongitude != null
    && selectedRouteTrip.destinationLatitude != null && selectedRouteTrip.destinationLongitude != null
    ? `https://www.google.com/maps/dir/?api=1&origin=${selectedRouteTrip.originLatitude},${selectedRouteTrip.originLongitude}&destination=${selectedRouteTrip.destinationLatitude},${selectedRouteTrip.destinationLongitude}&travelmode=driving`
    : null

  return (
    <div className="driver-shell">
      <header className="driver-topbar">
        <Brand compact />
        <div className="driver-user">
          <span>{user?.email || window.localStorage.getItem('fleetmind.email')}</span>
          <button className="top-icon-button" onClick={signOut} aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </header>
      <div className="driver-workspace">
        <aside className="driver-sidebar">
          <span className="driver-sidebar-label">DRIVER WORKSPACE</span>
          <nav aria-label="Driver navigation">
            {driverNav.map(({ label, path, icon: Icon }) => (
              <NavLink key={path} to={`/driver-dashboard/${path}`}
                className={({ isActive }) => `driver-nav-link ${isActive ? 'active' : ''}`}>
                <Icon size={17} aria-hidden="true" /><span>{label}</span>
                {path === 'requests' && pendingRequests.length > 0 && <small>{pendingRequests.length}</small>}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="driver-content">
          <div className="driver-welcome">
            <span className="eyebrow">Driver workspace</span>
            <h1>{driverNav.find(item => item.path === section)?.label || 'My assigned trips'}</h1>
            <p>Trips and driver details for your authenticated account.</p>
          </div>
          {loading && <LoadingState label="Loading your fleet data" />}
          {!loading && error && <ErrorState message={`Driver data could not be fully loaded: ${error}`} onRetry={loadDriverData} />}
          {notice && <div className="success-message" role="status">{notice}</div>}
          {actionError && <ErrorState message={actionError} />}
          {requestRefreshError && <ErrorState message={`Request could not be regenerated: ${requestRefreshError}`} />}
          {!loading && user && (
            <>
              {section === 'profile' && (
                <section className="reference-panel driver-profile-card">
                  <div className="driver-profile-heading"><UserRound size={21} /><div><span className="mini-label">Driver profile</span><h2>{profile?.name || user.name || user.email}</h2></div></div>
                  <div className="driver-profile-grid">
                    <div><span>Email</span><strong>{profile?.email || user.email || 'Not recorded'}</strong></div>
                    <div><span>Age</span><strong>{ageFrom(profile?.dateOfBirth)}</strong></div>
                    <div><span>Date of birth</span><strong>{profile?.dateOfBirth || 'Not recorded'}</strong></div>
                    <div><span>License number</span><strong>{profile?.licenseNumber || 'Not recorded'}</strong></div>
                    <div><span>License expiry</span><strong>{date(profile?.licenseExpiry)}</strong></div>
                    <div><span>Availability</span><strong>{(profile?.availabilityStatus || 'UNKNOWN').replaceAll('_', ' ')}</strong></div>
                    <div><span>Last recorded latitude</span><strong>{profile?.currentLocationLatitude ?? 'Not recorded'}</strong></div>
                    <div><span>Last recorded longitude</span><strong>{profile?.currentLocationLongitude ?? 'Not recorded'}</strong></div>
                    <div><span>Assigned vehicle</span><strong>{assignedTrips[0]?.vehicleRegistration || 'No active vehicle'}</strong></div>
                  </div>
                  <p className="form-hint">Age is calculated from the date of birth recorded in your driver profile.</p>
                </section>
              )}

              {section === 'requests' && (
                <section>
                  <div className="driver-section-title"><h2>Trip requests</h2>
                    <button className="secondary-btn compact-btn" onClick={regenerateRequest} disabled={refreshingRequest}>
                      {refreshingRequest ? 'Refreshing…' : 'Refresh'}
                    </button>
                  </div>
                  {pendingRequests.length === 0
                    ? <section className="reference-panel driver-empty-card"><ClipboardList size={22} /><EmptyState title="No trip requests" detail="New trips assigned to you will appear here for acceptance." /></section>
                    : pendingRequests.map(trip => (
                      <section className="reference-panel driver-trip-card" key={trip.id}>
                        <div className="driver-trip-head"><div><span className="mini-label">Trip reference</span><h2>{trip.referenceNumber}</h2></div><span className="status-badge info">AWAITING RESPONSE</span></div>
                        <div className="driver-trip-grid">
                          <div><span>Route</span><strong>{trip.originName} → {trip.destinationName}</strong></div>
                          <div><span>Vehicle</span><strong>{trip.vehicleRegistration || 'Not assigned'}</strong></div>
                          <div><span>Load</span><strong>{trip.cargoWeightKg} kg · {trip.cargoVolume} m³</strong></div>
                          <div><span>Deadline</span><strong>{date(trip.deliveryDeadline)}</strong></div>
                        </div>
                        <div className="driver-actions"><button className="primary-btn" disabled={busy} onClick={() => acceptTrip(trip)}>{busy ? 'Accepting…' : 'Accept trip'}</button></div>
                      </section>
                    ))}
                </section>
              )}

              {section === 'assigned' && (
                <section>
                  <div className="driver-section-title"><h2>My assigned trips</h2><button className="secondary-btn compact-btn" onClick={loadDriverData}>Refresh</button></div>
                  {assignedTrips.length === 0
                    ? <section className="reference-panel driver-empty-card"><ClipboardList size={22} /><EmptyState title="No accepted trips" detail="Accept a trip request to see it here." /></section>
                    : assignedTrips.map(trip => (
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
                        {trip.events?.length > 0 && <div className="driver-event-list"><strong>Trip events</strong>{trip.events.map(item => <div key={item.id}><span>{item.eventType.replaceAll('_', ' ')}</span><time>{date(item.eventTimestamp)}</time><small>{item.notes}</small></div>)}</div>}
                        <div className="driver-actions">
                          <button className="secondary-btn" aria-label={`View assigned route for ${trip.referenceNumber}`}
                            onClick={() => navigate(`/driver-dashboard/routes?trip=${trip.id}`)}><Route size={15} /> View assigned route</button>
                          {trip.status === 'ASSIGNED' && <button className="primary-btn" disabled={busy} onClick={() => updateTrip(trip)}>Start trip</button>}
                          {trip.status === 'IN_PROGRESS' && <button className="primary-btn" disabled={busy} onClick={() => updateTrip(trip)}>Mark delivered</button>}
                          <button className="secondary-btn" onClick={() => setReportOpen(value => !value)}><AlertTriangle size={14} /> Report delay or issue</button>
                        </div>
                      </section>
                    ))}
                  {reportOpen && <form className="reference-panel trip-create-form driver-report-form" onSubmit={submitIssue}>
                    <h3>Report delay or issue</h3>
                    <div className="form-grid">
                      <label>Issue type<select value={report.alertType} onChange={event => setReport({ ...report, alertType: event.target.value })}><option value="DELAY">Delay</option><option value="VEHICLE_ISSUE">Vehicle issue</option><option value="SAFETY">Safety concern</option><option value="OTHER">Other</option></select></label>
                      <label>Severity<select value={report.severity} onChange={event => setReport({ ...report, severity: event.target.value })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
                      <label className="full-width-field">Details<textarea required rows="3" value={report.message} onChange={event => setReport({ ...report, message: event.target.value })} /></label>
                    </div>
                    <div className="form-actions"><button className="primary-btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</button><span className="form-hint"><MapPin size={12} /> Recorded location is attached if available.</span></div>
                  </form>}
                </section>
              )}

              {section === 'routes' && (
                <section>
                  <div className="driver-section-title"><h2>Assigned route</h2><select className="driver-trip-select" aria-label="Choose assigned trip"
                    value={selectedRouteTrip?.id || ''} onChange={event => navigate(`/driver-dashboard/routes?trip=${event.target.value}`)}>
                    {assignedTrips.map(trip => <option key={trip.id} value={trip.id}>{trip.referenceNumber} · {trip.originName} → {trip.destinationName}</option>)}
                  </select></div>
                  {!selectedRouteTrip
                    ? <section className="reference-panel"><EmptyState title="No assigned route" detail="Accept a trip request to view its assigned route." /></section>
                    : <section className="reference-panel driver-route-card">
                      <span className="mini-label">{selectedRouteTrip.referenceNumber}</span>
                      <h2>{selectedRouteTrip.originName} → {selectedRouteTrip.destinationName}</h2>
                      <div className="driver-route-points"><div><MapPin size={17} /><span>Origin<strong>{selectedRouteTrip.originName}</strong></span></div><div><MapPin size={17} /><span>Destination<strong>{selectedRouteTrip.destinationName}</strong></span></div></div>
                      {googleDirections
                        ? <a className="primary-btn driver-directions-link" href={googleDirections} target="_blank" rel="noreferrer">Open driving directions <Route size={15} /></a>
                        : <p className="form-hint">Route directions are unavailable because trip coordinates are missing.</p>}
                      <p className="form-hint">Directions open in Google Maps using the trip’s recorded origin and destination coordinates.</p>
                    </section>}
                </section>
              )}

              {section === 'history' && (
                <section className="reference-panel driver-history-panel">
                  <h2>My trip history</h2>
                  {history.length === 0
                    ? <EmptyState title="No completed trips yet" detail="Completed trips assigned to your account will appear here." />
                    : history.map(trip => <div className="history-row" key={trip.id}><strong>{trip.referenceNumber}</strong><span>{trip.originName} → {trip.destinationName}</span><span>{date(trip.deliveryDeadline)}</span><span>{trip.status.replaceAll('_', ' ')}</span></div>)}
                </section>
              )}

              {section === 'score' && (
                <section className="reference-panel driver-score-card">
                  <div className="driver-score-heading"><Gauge size={22} /><div><span className="mini-label">Drive score</span><h2>{scoreMetrics.score === null ? 'Insufficient data' : `${scoreMetrics.score} / 100`}</h2></div></div>
                  <p>Calculated from recorded completed trips with both a delivery timestamp and deadline. Score reflects on-time delivery rate; trips without both values are excluded.</p>
                  <div className="driver-score-metrics">
                    <div><Clock3 size={17} /><span>On-time deliveries<strong>{scoreMetrics.measured ? `${scoreMetrics.onTime} / ${scoreMetrics.measured}` : 'Insufficient data'}</strong></span></div>
                    <div><CheckCircle2 size={17} /><span>Completed trips<strong>{scoreMetrics.completed}</strong></span></div>
                    <div><Fuel size={17} /><span>Fuel efficiency<strong>Insufficient data</strong></span></div>
                    <div><ShieldCheck size={17} /><span>Safety metrics<strong>Insufficient data</strong></span></div>
                  </div>
                  <p className="form-hint">Trip-level fuel consumption and safety telemetry are not currently recorded, so they do not affect this score.</p>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
