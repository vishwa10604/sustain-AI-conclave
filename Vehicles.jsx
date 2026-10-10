import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'
import { apiRequest } from '../lib/api'

function date(value) {
  if (!value) return 'Not recorded'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
}

const blankVehicle = {
  registrationNumber: '',
  vehicleType: '',
  capacityKg: '',
  capacityVolume: '',
  fuelType: '',
  fuelEfficiency: '',
  odometer: '',
  currentLocationLatitude: '',
  currentLocationLongitude: '',
  lastServiceDate: '',
  nextServiceDue: '',
  status: 'AVAILABLE',
}

export default function Vehicles({ mode = 'fleet' }) {
  const isRecommendations = mode === 'recommendations'
  const [vehicles, setVehicles] = useState(null)
  const [maintenance, setMaintenance] = useState(null)
  const [trips, setTrips] = useState(null)
  const [selectedTripId, setSelectedTripId] = useState('')
  const [recommendation, setRecommendation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recommendationError, setRecommendationError] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [vehicleForm, setVehicleForm] = useState(blankVehicle)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState({
    vehicleId: '', maintenanceType: '', description: '', serviceDate: '',
    nextServiceDate: '', severity: 'MEDIUM', status: 'OPEN', odometerAtService: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [data, maintenanceData] = await Promise.all([
        apiRequest('/vehicles'),
        apiRequest('/maintenance'),
      ])
      setVehicles(data)
      setMaintenance(maintenanceData)
      if (isRecommendations) {
        const tripData = await apiRequest('/trips')
        setTrips(tripData)
        const firstRequestedTrip = tripData.find(trip => trip.status === 'REQUESTED')
        setSelectedTripId(firstRequestedTrip ? String(firstRequestedTrip.id) : '')
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to load vehicle data.')
      setVehicles(null)
    } finally {
      setLoading(false)
    }
  }, [isRecommendations])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const applyGlobalSearch = event => setQuery(event.detail || '')
    window.addEventListener('fleetmind-search', applyGlobalSearch)
    return () => window.removeEventListener('fleetmind-search', applyGlobalSearch)
  }, [])

  const filteredVehicles = useMemo(() => {
    if (!Array.isArray(vehicles)) return []
    const text = query.trim().toLowerCase()
    return vehicles.filter(vehicle => [
      vehicle.registrationNumber, vehicle.vehicleType, vehicle.fuelType, vehicle.status,
    ].some(value => String(value || '').toLowerCase().includes(text)))
  }, [vehicles, query])

  const requestedTrips = (trips || []).filter(trip => trip.status === 'REQUESTED')

  async function requestRecommendation() {
    setRecommendationError('')
    setRecommendation(null)
    if (!selectedTripId) {
      setRecommendationError('Select a requested trip before requesting vehicle candidates.')
      return
    }
    setRequesting(true)
    try {
      const response = await apiRequest(`/trips/${selectedTripId}/recommend`, { method: 'POST' })
      setRecommendation(response)
    } catch (requestError) {
      setRecommendationError(requestError.message || 'The recommendation request failed.')
    } finally {
      setRequesting(false)
    }
  }

  async function createVehicle(event) {
    event.preventDefault()
    setCreating(true)
    setCreateError('')
    const payload = {
      ...vehicleForm,
      capacityKg: Number(vehicleForm.capacityKg),
      capacityVolume: Number(vehicleForm.capacityVolume),
      fuelEfficiency: Number(vehicleForm.fuelEfficiency),
      odometer: Number(vehicleForm.odometer),
      currentLocationLatitude: vehicleForm.currentLocationLatitude === '' ? null : Number(vehicleForm.currentLocationLatitude),
      currentLocationLongitude: vehicleForm.currentLocationLongitude === '' ? null : Number(vehicleForm.currentLocationLongitude),
      lastServiceDate: vehicleForm.lastServiceDate || null,
      nextServiceDue: vehicleForm.nextServiceDue || null,
    }
    try {
      await apiRequest('/vehicles', { method: 'POST', body: JSON.stringify(payload) })
      setVehicleForm(blankVehicle)
      setShowCreate(false)
      await load()
    } catch (requestError) {
      setCreateError(requestError.message || 'Vehicle could not be added.')
    } finally {
      setCreating(false)
    }
  }

  async function createMaintenance(event) {
    event.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      const payload = {
        ...maintenanceForm,
        vehicleId: Number(maintenanceForm.vehicleId),
        nextServiceDate: maintenanceForm.nextServiceDate || null,
        odometerAtService: maintenanceForm.odometerAtService ? Number(maintenanceForm.odometerAtService) : null,
      }
      await apiRequest('/maintenance', { method: 'POST', body: JSON.stringify(payload) })
      setShowMaintenanceForm(false)
      setMaintenanceForm({ vehicleId: '', maintenanceType: '', description: '', serviceDate: '', nextServiceDate: '', severity: 'MEDIUM', status: 'OPEN', odometerAtService: '' })
      await load()
    } catch (requestError) {
      setCreateError(requestError.message || 'Maintenance record could not be saved.')
    } finally {
      setCreating(false)
    }
  }

  async function completeMaintenance(recordId) {
    setCreateError('')
    try {
      await apiRequest(`/maintenance/${recordId}/complete`, { method: 'POST' })
      await load()
    } catch (requestError) {
      setCreateError(requestError.message || 'Maintenance record could not be completed.')
    }
  }

  const recommendedVehicles = recommendation?.eligibleVehicles
  const title = isRecommendations ? 'Vehicle recommendation' : 'Vehicle availability & maintenance'

  return (
    <Layout title={title}>
      {isRecommendations && (
        <section className="reference-panel table-panel recommendation-panel">
          <div className="section-header">
            <div><h2>Vehicle recommendation</h2><p className="panel-description">Request candidate vehicles for a trip using the fleet service.</p></div>
          </div>
          {error ? <ErrorState message={`Trips unavailable: ${error}`} onRetry={load} /> : (
            <div className="recommend-controls">
              <label>
                Requested trip
                <select value={selectedTripId} onChange={event => setSelectedTripId(event.target.value)}>
                  <option value="">Select a requested trip</option>
                  {requestedTrips.map(trip =>
                    <option key={trip.id} value={trip.id}>{trip.referenceNumber} · {trip.originName} → {trip.destinationName}</option>
                  )}
                </select>
              </label>
              <button className="primary-btn" type="button" onClick={requestRecommendation} disabled={requesting || !selectedTripId}>
                {requesting ? 'Requesting…' : 'Find candidate vehicles'}
              </button>
            </div>
          )}
          {!error && isRecommendations && !requestedTrips.length && !recommendation
            && <EmptyState title="No requested trips available" detail="Create a requested trip before requesting vehicle candidates." />}
          {recommendationError && <ErrorState message={recommendationError} />}
          {recommendation && (
            <div className="recommendation-results">
              <div className="success-message" role="status">{recommendation.message || `Recommendation status: ${recommendation.status}`}</div>
              <p className="panel-description">The current endpoint returns eligible vehicles only; ranked scores, drivers, cost and risk breakdown are not provided.</p>
              {Array.isArray(recommendedVehicles) && recommendedVehicles.length > 0 ? (
                <div className="vehicle-candidate-list">
                  {recommendedVehicles.map(vehicle => (
                    <article className="vehicle-candidate" key={vehicle.id}>
                      <strong>{vehicle.registrationNumber}</strong>
                      <span>{vehicle.vehicleType} · {vehicle.capacityKg} kg · {vehicle.capacityVolume} m³</span>
                      <span>Vehicle status · {(vehicle.status || 'UNKNOWN').replaceAll('_', ' ')}</span>
                    </article>
                  ))}
                </div>
              ) : <EmptyState title="No eligible vehicles returned" detail="The service did not return a candidate list for this trip." />}
            </div>
          )}
        </section>
      )}

      <section className="reference-panel table-panel">
        <div className="section-header">
          <div>
            <h2>{isRecommendations ? 'Fleet candidates' : 'Vehicle availability & maintenance'}</h2>
            <p className="panel-description">Registry, availability and maintenance dates returned by the fleet service.</p>
          </div>
          <div className="table-action-group">
            {!isRecommendations && <>
              <button className="primary-btn compact-btn" type="button" onClick={() => setShowMaintenanceForm(value => !value)}>
                {showMaintenanceForm ? 'Close service form' : 'Log maintenance'}
              </button>
              <button className="secondary-btn compact-btn" type="button" onClick={() => setShowCreate(value => !value)}>
                {showCreate ? 'Close form' : 'Add vehicle'}
              </button>
            </>}
            <button className="secondary-btn compact-btn" type="button" onClick={load}>Refresh</button>
          </div>
          {showMaintenanceForm && (
            <form className="trip-create-form" onSubmit={createMaintenance}>
              <h3>Log vehicle maintenance</h3>
              <div className="form-grid">
                <label>Vehicle<select required value={maintenanceForm.vehicleId} onChange={event => setMaintenanceForm({ ...maintenanceForm, vehicleId: event.target.value })}>
                  <option value="">Select vehicle</option>{(vehicles || []).map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber}</option>)}
                </select></label>
                <label>Service type<input required value={maintenanceForm.maintenanceType} onChange={event => setMaintenanceForm({ ...maintenanceForm, maintenanceType: event.target.value })} /></label>
                <label>Description<input required value={maintenanceForm.description} onChange={event => setMaintenanceForm({ ...maintenanceForm, description: event.target.value })} /></label>
                <label>Service date<input required type="date" value={maintenanceForm.serviceDate} onChange={event => setMaintenanceForm({ ...maintenanceForm, serviceDate: event.target.value })} /></label>
                <label>Next service due<input type="date" value={maintenanceForm.nextServiceDate} onChange={event => setMaintenanceForm({ ...maintenanceForm, nextServiceDate: event.target.value })} /></label>
                <label>Odometer<input type="number" min="0" value={maintenanceForm.odometerAtService} onChange={event => setMaintenanceForm({ ...maintenanceForm, odometerAtService: event.target.value })} /></label>
                <label>Severity<select value={maintenanceForm.severity} onChange={event => setMaintenanceForm({ ...maintenanceForm, severity: event.target.value })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
              </div>
              {createError && <ErrorState message={createError} />}
              <div className="form-actions"><button className="primary-btn" disabled={creating}>{creating ? 'Saving…' : 'Save maintenance'}</button></div>
            </form>
          )}
        </div>
        {showCreate && (
          <form className="trip-create-form" onSubmit={createVehicle}>
            <h3>Add vehicle to fleet</h3>
            <div className="form-grid">
              <label>Registration number<input value={vehicleForm.registrationNumber} onChange={event => setVehicleForm({ ...vehicleForm, registrationNumber: event.target.value })} required /></label>
              <label>Vehicle type<input value={vehicleForm.vehicleType} onChange={event => setVehicleForm({ ...vehicleForm, vehicleType: event.target.value })} required /></label>
              <label>Capacity (kg)<input type="number" min="0.01" step="any" value={vehicleForm.capacityKg} onChange={event => setVehicleForm({ ...vehicleForm, capacityKg: event.target.value })} required /></label>
              <label>Capacity (m³)<input type="number" min="0.01" step="any" value={vehicleForm.capacityVolume} onChange={event => setVehicleForm({ ...vehicleForm, capacityVolume: event.target.value })} required /></label>
              <label>Fuel type<input value={vehicleForm.fuelType} onChange={event => setVehicleForm({ ...vehicleForm, fuelType: event.target.value })} required /></label>
              <label>Fuel efficiency<input type="number" min="0.01" step="any" value={vehicleForm.fuelEfficiency} onChange={event => setVehicleForm({ ...vehicleForm, fuelEfficiency: event.target.value })} required /></label>
              <label>Odometer<input type="number" min="0" step="any" value={vehicleForm.odometer} onChange={event => setVehicleForm({ ...vehicleForm, odometer: event.target.value })} required /></label>
              <label>Availability<select value={vehicleForm.status} onChange={event => setVehicleForm({ ...vehicleForm, status: event.target.value })}><option>AVAILABLE</option><option>ON_TRIP</option><option>UNAVAILABLE</option><option>MAINTENANCE</option><option>OUT_OF_SERVICE</option></select></label>
              <label>Recorded latitude (optional)<input type="number" min="-90" max="90" step="any" value={vehicleForm.currentLocationLatitude} onChange={event => setVehicleForm({ ...vehicleForm, currentLocationLatitude: event.target.value })} /></label>
              <label>Recorded longitude (optional)<input type="number" min="-180" max="180" step="any" value={vehicleForm.currentLocationLongitude} onChange={event => setVehicleForm({ ...vehicleForm, currentLocationLongitude: event.target.value })} /></label>
              <label>Last service date<input type="date" value={vehicleForm.lastServiceDate} onChange={event => setVehicleForm({ ...vehicleForm, lastServiceDate: event.target.value })} /></label>
              <label>Next service due<input type="date" value={vehicleForm.nextServiceDue} onChange={event => setVehicleForm({ ...vehicleForm, nextServiceDue: event.target.value })} /></label>
            </div>
            {createError && <ErrorState message={`Vehicle could not be added: ${createError}`} />}
            <div className="form-actions">
              <button className="primary-btn" type="submit" disabled={creating}>{creating ? 'Saving…' : 'Save vehicle'}</button>
              <button className="text-button" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        )}
        <div className="table-controls">
          <label className="search-row"><span aria-hidden="true">⌕</span><input value={query}
            onChange={event => setQuery(event.target.value)} placeholder="Search vehicles" /></label>
        </div>
        {loading && <LoadingState label="Loading vehicles" />}
        {!loading && error && <ErrorState message={`Vehicles could not be loaded: ${error}`} onRetry={load} />}
        {!loading && !error && Array.isArray(vehicles) && !vehicles.length
          && <EmptyState title="No vehicle records" detail="The fleet API returned an empty vehicle registry." />}
        {!error && Array.isArray(vehicles) && vehicles.length > 0 && filteredVehicles.length === 0
          && <EmptyState title="No matching vehicles" detail="Try a different search." />}
        {!error && Array.isArray(vehicles) && filteredVehicles.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Registration</th><th>Type</th><th>Capacity</th><th>Fuel</th><th>Status</th><th>Next service</th></tr></thead>
              <tbody>
                {filteredVehicles.map(vehicle => (
                  <tr key={vehicle.id}>
                    <td>{vehicle.registrationNumber}</td>
                    <td>{vehicle.vehicleType}</td>
                    <td>{vehicle.capacityKg} kg · {vehicle.capacityVolume} m³</td>
                    <td>{vehicle.fuelType || 'Not recorded'}</td>
                    <td><span className="status-badge info">{(vehicle.status || 'UNKNOWN').replaceAll('_', ' ')}</span></td>
                    <td>{date(vehicle.nextServiceDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {!isRecommendations && (
        <section className="reference-panel table-panel">
          <div className="section-header"><div><h2>Maintenance history</h2><p className="panel-description">Service records from the fleet database.</p></div></div>
          {createError && <ErrorState message={createError} />}
          {Array.isArray(maintenance) && maintenance.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Vehicle</th><th>Service</th><th>Description</th><th>Date</th><th>Next due</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{maintenance.map(record => <tr key={record.id}>
                  <td>{record.registrationNumber}</td><td>{record.maintenanceType}</td><td>{record.description}</td>
                  <td>{date(record.serviceDate)}</td><td>{date(record.nextServiceDate)}</td><td>{record.status}</td>
                  <td>{record.status !== 'COMPLETED' && <button className="text-button" onClick={() => completeMaintenance(record.id)}>Mark complete</button>}</td>
                </tr>)}</tbody>
              </table>
            </div>
          ) : <EmptyState title="No maintenance history" detail="Logged service records will appear here." />}
        </section>
      )}
    </Layout>
  )
}
