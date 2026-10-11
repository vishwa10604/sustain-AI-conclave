import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'
import { apiRequest } from '../lib/api'
import { MapPin, WandSparkles } from 'lucide-react'

const initialForm = {
  originName: '',
  originLatitude: '',
  originLongitude: '',
  destinationName: '',
  destinationLatitude: '',
  destinationLongitude: '',
  cargoWeightKg: '',
  cargoVolume: '',
  priority: 'MEDIUM',
  requestedPickupTime: '',
  deliveryDeadline: '',
}

function asIsoDateTime(value) {
  return new Date(value).toISOString()
}

function readable(value) {
  if (!value) return 'Not provided'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function Trips() {
  const [trips, setTrips] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [createAssignment, setCreateAssignment] = useState({ driverId: '', vehicleId: '' })
  const [saving, setSaving] = useState(false)
  const [drivers, setDrivers] = useState([])
  const [driversLoading, setDriversLoading] = useState(true)
  const [driversError, setDriversError] = useState('')
  const [vehicles, setVehicles] = useState([])
  const [assignmentTarget, setAssignmentTarget] = useState(null)
  const [assignment, setAssignment] = useState({ vehicleId: '', driverId: '' })
  const [assignmentError, setAssignmentError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [geocodingField, setGeocodingField] = useState('')

  const loadTrips = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/trips')
      setTrips(data)
    } catch (requestError) {
      setError(requestError.message || 'Unable to load trips.')
      setTrips(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTrips() }, [loadTrips])
  const loadResources = useCallback(async () => {
    setDriversLoading(true)
    try {
      const [driversResult, vehiclesResult] = await Promise.allSettled([
        apiRequest('/drivers'),
        apiRequest('/vehicles'),
      ])
      setDrivers(driversResult.status === 'fulfilled' ? driversResult.value : [])
      setVehicles(vehiclesResult.status === 'fulfilled' ? vehiclesResult.value : [])
      setDriversError(driversResult.status === 'rejected'
        ? driversResult.reason.message || 'Unable to load available drivers.'
        : '')
    } finally {
      setDriversLoading(false)
    }
  }, [])
  useEffect(() => { loadResources() }, [loadResources])
  useEffect(() => {
    const applyGlobalSearch = event => setQuery(event.detail || '')
    window.addEventListener('fleetmind-search', applyGlobalSearch)
    return () => window.removeEventListener('fleetmind-search', applyGlobalSearch)
  }, [])

  const filteredTrips = useMemo(() => {
    if (!Array.isArray(trips)) return []
    const text = query.trim().toLowerCase()
    return trips.filter(trip => [trip.referenceNumber, trip.originName, trip.destinationName, trip.status]
      .some(value => String(value || '').toLowerCase().includes(text)))
  }, [trips, query])

  const availableDrivers = useMemo(() => drivers
    .filter(driver => driver.availabilityStatus === 'AVAILABLE'), [drivers])

  const latestTripByDriver = useMemo(() => {
    const latestTrips = new Map()
    if (!Array.isArray(trips)) return latestTrips
    trips.forEach(trip => {
      if (trip.driverId == null) return
      const latestEventAt = Array.isArray(trip.events)
        ? trip.events.reduce((latest, event) => {
          const timestamp = new Date(event.eventTimestamp).getTime()
          return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest
        }, 0)
        : 0
      const activityAt = latestEventAt || new Date(trip.requestedPickupTime).getTime() || 0
      const current = latestTrips.get(String(trip.driverId))
      if (!current || activityAt > current.activityAt) {
        latestTrips.set(String(trip.driverId), { trip, activityAt })
      }
    })
    return new Map([...latestTrips].map(([driverId, value]) => [driverId, value.trip]))
  }, [trips])

  const availableVehiclesForForm = useMemo(() => vehicles.filter(vehicle =>
    vehicle.status === 'AVAILABLE'
    && (!form.cargoWeightKg || Number(vehicle.capacityKg) >= Number(form.cargoWeightKg))
    && (!form.cargoVolume || Number(vehicle.capacityVolume) >= Number(form.cargoVolume))),
  [vehicles, form.cargoWeightKg, form.cargoVolume])

  function updateField(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function findCoordinates(field) {
    const locationName = form[`${field}Name`].trim()
    if (!locationName) {
      setSubmitError(`Enter the ${field} name before looking up its coordinates.`)
      return
    }
    setGeocodingField(field)
    setSubmitError('')
    try {
      const query = new URLSearchParams({ format: 'jsonv2', limit: '1', q: locationName })
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`)
      if (!response.ok) throw new Error(`Location lookup failed (${response.status}).`)
      const results = await response.json()
      if (!results.length) throw new Error(`No coordinates found for "${locationName}". Add latitude and longitude manually.`)
      setForm(current => ({
        ...current,
        [`${field}Latitude`]: results[0].lat,
        [`${field}Longitude`]: results[0].lon,
      }))
    } catch (lookupError) {
      setSubmitError(lookupError.message || 'Location lookup failed. Enter the coordinates manually.')
    } finally {
      setGeocodingField('')
    }
  }

  async function createTrip(event) {
    event.preventDefault()
    setSubmitError('')
    setNotice('')
    if (!createAssignment.driverId) {
      setSubmitError('Select an available driver before creating the trip.')
      return
    }
    if (!createAssignment.vehicleId) {
      setSubmitError('Select an available vehicle that can carry this load before creating the trip.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        referenceNumber: `FM-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
        originLatitude: Number(form.originLatitude),
        originLongitude: Number(form.originLongitude),
        destinationLatitude: Number(form.destinationLatitude),
        destinationLongitude: Number(form.destinationLongitude),
        cargoWeightKg: Number(form.cargoWeightKg),
        cargoVolume: Number(form.cargoVolume),
        requestedPickupTime: asIsoDateTime(form.requestedPickupTime),
        deliveryDeadline: asIsoDateTime(form.deliveryDeadline),
      }
      const createdTrip = await apiRequest('/trips', { method: 'POST', body: JSON.stringify(payload) })
      let successMessage = 'Trip created successfully.'
      try {
        await apiRequest(`/trips/${createdTrip.id}/assign`, {
          method: 'POST',
          body: JSON.stringify({
            vehicleId: Number(createAssignment.vehicleId),
            driverId: Number(createAssignment.driverId),
          }),
        })
        const selectedDriver = availableDrivers.find(driver => String(driver.id) === createAssignment.driverId)
        successMessage = `Trip created and assigned to ${selectedDriver?.name || 'the selected driver'}.`
      } catch (assignmentRequestError) {
        successMessage = `Trip created, but driver assignment failed: ${assignmentRequestError.message || 'Please assign it from the trip list.'}`
      }
      setNotice(successMessage)
      setForm(initialForm)
      setCreateAssignment({ driverId: '', vehicleId: '' })
      setShowForm(false)
      await Promise.all([loadTrips(), loadResources()])
    } catch (requestError) {
      setSubmitError(requestError.message || 'Trip creation failed.')
    } finally {
      setSaving(false)
    }
  }

  async function requestRecommendation(trip) {
    setAssignmentError('')
    setCandidates([])
    setAssignmentTarget(trip.id)
    setActionBusy(true)
    try {
      const result = await apiRequest(`/trips/${trip.id}/recommend`, { method: 'POST' })
      const availableCandidates = result.candidates || result.eligibleVehicles || []
      setCandidates(availableCandidates)
      if (availableCandidates.length) {
        setAssignment({
          vehicleId: String(availableCandidates[0].vehicleId ?? ''),
          driverId: String(availableCandidates[0].driverId ?? ''),
        })
      }
      setNotice(result.message || 'Candidates loaded. Select a driver and vehicle to assign manually.')
      await loadTrips()
    } catch (requestError) {
      setAssignmentError(requestError.message || 'Recommendation request failed.')
    } finally {
      setActionBusy(false)
    }
  }

  async function assignTrip(tripId) {
    setAssignmentError('')
    setActionBusy(true)
    try {
      await apiRequest(`/trips/${tripId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ vehicleId: Number(assignment.vehicleId), driverId: Number(assignment.driverId) }),
      })
      setNotice('Trip assigned. The driver and vehicle are now reserved for this trip.')
      setAssignmentTarget(null)
      setCandidates([])
      await Promise.all([loadTrips(), loadResources()])
    } catch (requestError) {
      setAssignmentError(requestError.message || 'Assignment failed.')
      await Promise.all([loadTrips(), loadResources()])
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <Layout title="Trip assignment">
      <section className="reference-panel table-panel">
        <div className="section-header">
          <div>
            <h2>Trip assignment</h2>
            <p className="panel-description">Trips are loaded from the fleet service.</p>
          </div>
          <div className="table-action-group">
            <button className="primary-btn compact-btn" type="button" onClick={() => setShowForm(value => !value)}>
              {showForm ? 'Close form' : 'Create trip'}
            </button>
          </div>
        </div>

        {notice && <div className="success-message" role="status">{notice}</div>}
        {showForm && (
          <form className="trip-create-form" onSubmit={createTrip}>
            <h3><WandSparkles size={15} /> Create trip from manager input</h3>
            <div className="form-grid">
              <label className="location-name-field">Origin<input name="originName" value={form.originName} onChange={updateField} required />
                <button type="button" className="text-button" onClick={() => findCoordinates('origin')} disabled={Boolean(geocodingField)}>
                  <MapPin size={13} /> {geocodingField === 'origin' ? 'Finding coordinates…' : 'Find on map'}
                </button>
              </label>
              <label>Origin latitude<input name="originLatitude" type="number" step="any" min="-90" max="90" value={form.originLatitude} onChange={updateField} required /></label>
              <label>Origin longitude<input name="originLongitude" type="number" step="any" min="-180" max="180" value={form.originLongitude} onChange={updateField} required /></label>
              <label className="location-name-field">Destination<input name="destinationName" value={form.destinationName} onChange={updateField} required />
                <button type="button" className="text-button" onClick={() => findCoordinates('destination')} disabled={Boolean(geocodingField)}>
                  <MapPin size={13} /> {geocodingField === 'destination' ? 'Finding coordinates…' : 'Find on map'}
                </button>
              </label>
              <label>Destination latitude<input name="destinationLatitude" type="number" step="any" min="-90" max="90" value={form.destinationLatitude} onChange={updateField} required /></label>
              <label>Destination longitude<input name="destinationLongitude" type="number" step="any" min="-180" max="180" value={form.destinationLongitude} onChange={updateField} required /></label>
              <label>Cargo weight (kg)<input name="cargoWeightKg" type="number" min="0.01" step="any" value={form.cargoWeightKg} onChange={updateField} required /></label>
              <label>Cargo volume (m³)<input name="cargoVolume" type="number" min="0.01" step="any" value={form.cargoVolume} onChange={updateField} required /></label>
              <label>Pickup time<input name="requestedPickupTime" type="datetime-local" value={form.requestedPickupTime} onChange={updateField} required /></label>
              <label>Delivery deadline<input name="deliveryDeadline" type="datetime-local" value={form.deliveryDeadline} onChange={updateField} required /></label>
              <label>Priority<select name="priority" value={form.priority} onChange={updateField}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label>
              <label>Available driver
                <select required value={createAssignment.driverId} disabled={driversLoading || Boolean(driversError) || availableDrivers.length === 0}
                  onChange={event => setCreateAssignment({ driverId: event.target.value, vehicleId: '' })}>
                  <option value="">Select an available driver</option>
                  {availableDrivers.map(driver => {
                    const latestTrip = latestTripByDriver.get(String(driver.id))
                    return <option key={driver.id} value={driver.id}>
                      {driver.name} · {latestTrip ? `Latest: ${latestTrip.referenceNumber}` : 'No previous trip'}
                    </option>
                  })}
                </select>
                {driversLoading && <span className="form-hint">Loading available drivers…</span>}
                {driversError && <span className="form-hint">Drivers unavailable: {driversError}</span>}
              </label>
              {createAssignment.driverId && (
                <label>Available vehicle
                  <select required value={createAssignment.vehicleId}
                    onChange={event => setCreateAssignment(current => ({ ...current, vehicleId: event.target.value }))}>
                    <option value="">Select a vehicle for this load</option>
                    {availableVehiclesForForm.map(vehicle => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.registrationNumber} · {vehicle.vehicleType} · {vehicle.capacityKg} kg / {vehicle.capacityVolume} m³
                      </option>
                    ))}
                  </select>
                  {availableVehiclesForForm.length === 0 && (
                    <span className="form-hint">No available vehicle meets this load’s capacity. Adjust the cargo or make a suitable vehicle available.</span>
                  )}
                </label>
              )}
            </div>
            {submitError && <ErrorState message={`Trip creation failed: ${submitError}`} />}
            <div className="form-actions">
              <button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create trip'}</button>
              <button className="text-button" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        )}

        <div className="table-controls">
          <label className="search-row">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search reference, origin, destination" />
          </label>
          <button className="secondary-btn compact-btn" type="button" onClick={loadTrips}>Refresh</button>
        </div>
        {loading && <LoadingState label="Loading trips" />}
        {!loading && error && <ErrorState message={`Trips could not be loaded: ${error}`} onRetry={loadTrips} />}
        {!loading && !error && Array.isArray(trips) && !filteredTrips.length
          && <EmptyState title="No trips found" detail={trips.length ? 'Try another search.' : 'Create a trip to add the first trip record.'} />}
        {!error && Array.isArray(trips) && filteredTrips.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Reference</th><th>Route</th><th>Load</th><th>Pickup</th><th>Deadline</th><th>Status</th><th>Assignment</th></tr></thead>
              <tbody>
                {filteredTrips.map(trip => (
                  <Fragment key={trip.id}>
                  <tr>
                    <td>{trip.referenceNumber}</td>
                    <td>{trip.originName} → {trip.destinationName}</td>
                    <td>{trip.cargoWeightKg} kg · {trip.cargoVolume} m³</td>
                    <td>{readable(trip.requestedPickupTime)}</td>
                    <td>{readable(trip.deliveryDeadline)}</td>
                    <td><span className="status-badge info">{(trip.status || 'UNKNOWN').replaceAll('_', ' ')}</span></td>
                    <td>
                      {['REQUESTED', 'RECOMMENDED'].includes(trip.status) ? (
                        <button type="button" className="text-button" onClick={() => {
                          setAssignmentTarget(trip.id)
                          setCandidates([])
                          setAssignment({ vehicleId: '', driverId: '' })
                          setAssignmentError('')
                        }}>Assign manually</button>
                      ) : <span>{trip.driverName || 'Driver pending'} · {trip.vehicleRegistration || 'Vehicle pending'}</span>}
                    </td>
                  </tr>
                  {assignmentTarget === trip.id && (
                    <tr key={`${trip.id}-assignment`}>
                      <td colSpan="7">
                        <div className="inline-assignment-panel">
                          <div className="assignment-heading">
                            <strong>Manual assignment · {trip.referenceNumber}</strong>
                            <button className="text-button" type="button" onClick={() => setAssignmentTarget(null)}>Close</button>
                          </div>
                          <div className="assignment-selectors">
                            <label>Available vehicle
                              <select value={assignment.vehicleId} onChange={event => setAssignment(current => ({ ...current, vehicleId: event.target.value }))}>
                                <option value="">Select vehicle</option>
                                {vehicles.filter(vehicle => vehicle.status === 'AVAILABLE'
                                  && Number(vehicle.capacityKg) >= Number(trip.cargoWeightKg)
                                  && Number(vehicle.capacityVolume) >= Number(trip.cargoVolume)).map(vehicle =>
                                  <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber} · {vehicle.vehicleType} · {vehicle.capacityKg} kg</option>
                                )}
                              </select>
                            </label>
                            <label>Available driver
                              <select value={assignment.driverId} onChange={event => setAssignment(current => ({ ...current, driverId: event.target.value }))}>
                                <option value="">Select driver</option>
                                {drivers.filter(driver => driver.availabilityStatus === 'AVAILABLE').map(driver =>
                                  <option key={driver.id} value={driver.id}>{driver.name} · license {driver.licenseNumber}</option>
                                )}
                              </select>
                            </label>
                          </div>
                          <div className="form-actions">
                            <button type="button" className="primary-btn" disabled={actionBusy || !assignment.vehicleId || !assignment.driverId}
                              onClick={() => assignTrip(trip.id)}>{actionBusy ? 'Assigning…' : 'Confirm assignment'}</button>
                            <button type="button" className="secondary-btn compact-btn" disabled={actionBusy}
                              onClick={() => requestRecommendation(trip)}>
                              {actionBusy ? 'Checking…' : 'Show capacity-fit candidates'}
                            </button>
                          </div>
                          {assignmentError && <ErrorState message={assignmentError} />}
                          {candidates.length > 0 && (
                            <div className="candidate-hints">
                              {candidates.map(candidate => (
                                <button type="button" key={`${candidate.vehicleId}-${candidate.driverId}`}
                                  className="candidate-hint" onClick={() => setAssignment({ vehicleId: String(candidate.vehicleId), driverId: String(candidate.driverId) })}>
                                  <strong>{candidate.vehicleRegistration} + {candidate.driverName}</strong>
                                  <span>{candidate.reason} Score {candidate.score}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {!vehicles.some(vehicle => vehicle.status === 'AVAILABLE' && Number(vehicle.capacityKg) >= Number(trip.cargoWeightKg)
                            && Number(vehicle.capacityVolume) >= Number(trip.cargoVolume)) && (
                            <div className="form-hint">No available vehicle currently meets both load limits. Add a vehicle or adjust the trip details.</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Layout>
  )
}
