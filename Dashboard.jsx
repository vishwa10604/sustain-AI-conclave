import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Boxes, CheckCircle2, Clock3, Navigation, PackageCheck, ShieldAlert,
  TriangleAlert, Truck, Wrench,
} from 'lucide-react'
import Layout from '../components/Layout'
import StepTracker from '../components/ui/StepTracker'
import { apiRequest } from '../lib/api'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'
import GoogleFleetMap from '../components/GoogleFleetMap'

function asNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function tripPoint(trip, prefix) {
  if (!trip) return null
  const latitude = asNumber(trip[`${prefix}Latitude`])
  const longitude = asNumber(trip[`${prefix}Longitude`])
  return latitude === null || longitude === null ? null : [latitude, longitude]
}

function MapView({ trip, vehicles, setRoadRoute, setRouteState, routeVisible, setRouteVisible, setRouteError }) {
  const handleRouteChange = useCallback(route => setRoadRoute(route), [setRoadRoute])
  const handleRouteState = useCallback((state, message) => {
    setRouteState(state)
    setRouteError(message || '')
  }, [setRouteError, setRouteState])

  return (
    <>
      <GoogleFleetMap trip={trip} vehicles={vehicles} showRoute={routeVisible} className="fleet-map"
        onRouteChange={handleRouteChange} onRouteStateChange={handleRouteState} />
      <div className="map-tools">
        <button type="button" disabled={!tripPoint(trip, 'origin') || !tripPoint(trip, 'destination')}
          onClick={() => setRouteVisible(value => !value)}>
          {routeVisible ? 'Hide route' : 'Show route'}
        </button>
      </div>
    </>
  )
}

function formatDate(value) {
  if (!value) return 'Not provided'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function StatusBadge({ status }) {
  const style = ['DELIVERED', 'AVAILABLE'].includes(status) ? 'success'
    : ['REQUESTED', 'ANALYZING', 'MAINTENANCE'].includes(status) ? 'warning'
      : ['UNAVAILABLE', 'RESTRICTED'].includes(status) ? 'danger' : 'info'
  return <span className={`status-badge ${style}`}>{(status || 'UNKNOWN').replaceAll('_', ' ')}</span>
}

function Metric({ label, value, description, icon: Icon, tone, featured = false }) {
  return (
    <article className={`metric-card metric-${tone}${featured ? ' metric-card-featured' : ''}`}>
      <div className="metric-card-heading">
        <div className="metric-label">{label}</div>
        <span className="metric-icon"><Icon size={18} strokeWidth={2} aria-hidden="true" /></span>
      </div>
      <div className="metric-value">{value ?? 'Insufficient data'}</div>
      <div className="metric-hint">{description}</div>
    </article>
  )
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null)
  const [trips, setTrips] = useState(null)
  const [vehicles, setVehicles] = useState(null)
  const [drivers, setDrivers] = useState(null)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedId, setSelectedId] = useState(null)
  const [showTripList, setShowTripList] = useState(true)
  const [showMap, setShowMap] = useState(true)
  const [roadRoute, setRoadRoute] = useState(null)
  const [routeState, setRouteState] = useState('idle')
  const [routeError, setRouteError] = useState('')
  const [routeVisible, setRouteVisible] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const requests = await Promise.allSettled([
      apiRequest('/dashboard'),
      apiRequest('/trips'),
      apiRequest('/vehicles'),
      apiRequest('/drivers'),
    ])
    const [metricsResult, tripsResult, vehiclesResult, driversResult] = requests
    setMetrics(metricsResult.status === 'fulfilled' ? metricsResult.value : null)
    setTrips(tripsResult.status === 'fulfilled' ? tripsResult.value : null)
    setVehicles(vehiclesResult.status === 'fulfilled' ? vehiclesResult.value : null)
    setDrivers(driversResult.status === 'fulfilled' ? driversResult.value : null)
    setErrors({
      metrics: metricsResult.status === 'rejected' ? metricsResult.reason.message : '',
      trips: tripsResult.status === 'rejected' ? tripsResult.reason.message : '',
      vehicles: vehiclesResult.status === 'rejected' ? vehiclesResult.reason.message : '',
      drivers: driversResult.status === 'rejected' ? driversResult.reason.message : '',
    })
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const applyGlobalSearch = event => setQuery(event.detail || '')
    window.addEventListener('fleetmind-search', applyGlobalSearch)
    return () => window.removeEventListener('fleetmind-search', applyGlobalSearch)
  }, [])

  const filteredTrips = useMemo(() => {
    if (!Array.isArray(trips)) return []
    const normalizedQuery = query.trim().toLowerCase()
    return trips.filter(trip => {
      const matchesQuery = !normalizedQuery || [
        trip.referenceNumber, trip.originName, trip.destinationName, trip.status,
      ].some(value => String(value || '').toLowerCase().includes(normalizedQuery))
      return matchesQuery && (statusFilter === 'ALL' || trip.status === statusFilter)
    })
  }, [trips, query, statusFilter])
  const selectedTrip = filteredTrips.find(trip => trip.id === selectedId) || filteredTrips[0] || null
  const selectedTripHasCoords = Boolean(selectedTrip && tripPoint(selectedTrip, 'origin') && tripPoint(selectedTrip, 'destination'))

  const availableVehicles = Array.isArray(vehicles) ? vehicles.filter(vehicle => vehicle.status === 'AVAILABLE').length : null
  const onTripVehicles = Array.isArray(vehicles) ? vehicles.filter(vehicle => vehicle.status === 'ON_TRIP').length : null
  const maintenanceVehicles = Array.isArray(vehicles) ? vehicles.filter(vehicle => vehicle.status === 'MAINTENANCE').length : null
  const restrictedVehicles = Array.isArray(vehicles)
    ? vehicles.filter(vehicle => ['RESTRICTED', 'UNAVAILABLE', 'OUT_OF_SERVICE'].includes(vehicle.status)).length : null
  const unavailableVehicles = maintenanceVehicles === null || restrictedVehicles === null
    ? null : maintenanceVehicles + restrictedVehicles
  const awaitingAssignment = Array.isArray(trips) ? trips.filter(trip => trip.status === 'REQUESTED').length : null
  const deliveredTrips = Array.isArray(trips) ? trips.filter(trip => trip.status === 'DELIVERED').length : null
  const delayedTrips = metrics?.delayedTrips ?? (Array.isArray(trips) ? trips.filter(trip => trip.status === 'DELAYED').length : null)
  const activeTrips = metrics?.activeTrips ?? (Array.isArray(trips) ? trips.filter(trip => ['ASSIGNED', 'IN_PROGRESS'].includes(trip.status)).length : null)
  const fleetUtilization = Array.isArray(vehicles) && vehicles.length
    ? `${Math.round((onTripVehicles / vehicles.length) * 100)}%` : null

  return (
    <Layout title="Assigned Trips" showGlobalSearch={false}>
      <section className="metric-section" aria-label="Fleet vehicle metrics">
        <div className="metric-section-heading">
          <div><Boxes size={16} /><h2>Fleet snapshot</h2></div>
          <span>Vehicle availability and readiness</span>
        </div>
        <div className="kpi-strip">
          <Metric label="Total vehicles" value={metrics?.totalVehicles ?? vehicles?.length} description="Registered fleet vehicles" icon={Boxes} tone="blue" featured />
          <Metric label="Available" value={metrics?.availableVehicles ?? availableVehicles} description="Ready for assignment" icon={CheckCircle2} tone="green" />
          <Metric label="On trip" value={metrics?.onTripVehicles ?? onTripVehicles} description="Currently assigned to trips" icon={Truck} tone="teal" />
          <Metric label="Maintenance" value={maintenanceVehicles} description="Currently in maintenance" icon={Wrench} tone="amber" />
          <Metric label="Restricted" value={restrictedVehicles} description="Unavailable or out of service" icon={ShieldAlert} tone="red" />
        </div>
      </section>
      <section className="metric-section metric-section-trips" aria-label="Trip metrics">
        <div className="metric-section-heading">
          <div><Navigation size={16} /><h2>Trip activity</h2></div>
          <span>Live status from recorded trip data</span>
        </div>
        <div className="kpi-strip kpi-strip-secondary">
          <Metric label="Active trips" value={activeTrips} description="Assigned or in progress" icon={Navigation} tone="blue" />
          <Metric label="Awaiting assignment" value={awaitingAssignment} description="Requested or recommended" icon={Clock3} tone="amber" />
          <Metric label="Delivered" value={metrics?.completedTrips ?? deliveredTrips} description="Marked as delivered" icon={PackageCheck} tone="green" />
          <Metric label="At-risk / delayed" value={delayedTrips} description="Trips marked delayed" icon={TriangleAlert} tone="red" />
        </div>
      </section>

      <div className="map-list-switch" role="group" aria-label="Map and trip list views">
        <button type="button" className={showTripList ? 'selected' : ''} onClick={() => setShowTripList(value => !value)}>
          {showTripList ? 'Hide trip list' : 'Show trip list'}
        </button>
        <button type="button" className={showMap ? 'selected' : ''} onClick={() => setShowMap(value => !value)}>
          {showMap ? 'Hide map' : 'Show map'}
        </button>
      </div>
      <div className={`control-room ${!showTripList ? 'map-only' : ''} ${!showMap ? 'list-only' : ''}`}>
        {showTripList && <section className="tracking-panel reference-panel">
          <div className="tracking-header-row">
            <div>
              <div className="tracking-title">Active trips</div>
              <div className="tracking-mini">Trip records from the fleet service</div>
            </div>
            <button className="refresh-button" onClick={loadData} type="button" aria-label="Refresh fleet data">↻</button>
          </div>

          <div className="trip-filter-controls">
            <label className="search-row">
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search reference or location" />
            </label>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter trips by status">
              <option value="ALL">All statuses</option>
              {['REQUESTED', 'ANALYZING', 'ASSIGNED', 'IN_PROGRESS', 'DELIVERED'].map(status =>
                <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
              )}
            </select>
          </div>

          {loading && !trips ? <LoadingState label="Loading trip records" /> : null}
          {!loading && errors.trips ? <ErrorState message={`Trips could not be loaded: ${errors.trips}`} onRetry={loadData} /> : null}
          {!errors.trips && Array.isArray(trips) && !filteredTrips.length
            ? <EmptyState title="No matching trips" detail={trips.length ? 'Change the search or status filter.' : 'Create a trip to begin planning operations.'} /> : null}

          <div className="trip-stack">
            {filteredTrips.map(trip => (
              <button type="button" key={trip.id}
                className={`trip-card trip-card-button ${trip.id === selectedTrip?.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(trip.id)}>
                <div className="trip-topline">
                  <span className="trip-id">{trip.referenceNumber}</span>
                  <StatusBadge status={trip.status} />
                </div>
                <div className="trip-geo">
                  <div><div className="geo-label">Origin</div><div className="geo-city">{trip.originName}</div></div>
                  <div><div className="geo-label">Destination</div><div className="geo-city">{trip.destinationName}</div></div>
                </div>
                <div className="trip-summary-line">
                  <span>{trip.cargoWeightKg} kg · {trip.cargoVolume} m³</span>
                  <span>Deadline {formatDate(trip.deliveryDeadline)}</span>
                </div>
                <StepTracker status={trip.status} />
              </button>
            ))}
          </div>
        </section>}

        {showMap && <section className="map-panel reference-panel" aria-label="Trip and fleet map">
          <div className="map-heading">
            <div>
              <div className="tracking-title">Fleet map</div>
              <div className="tracking-mini">
                {selectedTrip
                  ? `${selectedTrip.originName} → ${selectedTrip.destinationName} · OSRM route on Google Maps`
                  : 'Satellite fleet view · recorded fleet coordinates'}
              </div>
            </div>
            <div className="map-legend">
              <span><i /> Truck markers · active-trip preview is simulated</span>
              <span>{routeState === 'loading' ? 'Getting Google route…'
                : roadRoute ? `${roadRoute.distanceKm.toFixed(1)} km · ${Math.round(roadRoute.durationMinutes)} min (OSRM)`
                : selectedTripHasCoords ? 'OSRM road route unavailable' : 'Select a trip with coordinates'}</span>
            </div>
          </div>
          {errors.vehicles && <div className="map-inline-warning">Vehicle positions unavailable: {errors.vehicles}</div>}
          <MapView trip={selectedTrip} vehicles={vehicles || []}
            setRoadRoute={setRoadRoute} setRouteState={setRouteState} setRouteError={setRouteError}
            routeVisible={routeVisible} setRouteVisible={setRouteVisible} />
          {routeError && <div className="map-inline-warning">{routeError}</div>}
          {selectedTrip && (
            <div className="map-info-card">
              <div className="info-card-title"><Navigation size={14} /> Selected trip</div>
              <strong>{selectedTrip.referenceNumber}</strong>
              <span>{selectedTrip.originName} → {selectedTrip.destinationName}</span>
              <span>Status · {(selectedTrip.status || 'UNKNOWN').replaceAll('_', ' ')}</span>
              <small>{roadRoute
                ? `OSRM road route on Google Maps · ${roadRoute.distanceKm.toFixed(1)} km · ${Math.round(roadRoute.durationMinutes)} min.`
                : 'OSRM road route unavailable; no straight-line estimate is substituted.'}</small>
            </div>
          )}
        </section>}
      </div>

      <div className="data-footnote">
        <Truck size={14} /> Fleet utilization {fleetUtilization ?? 'Insufficient data'} · On-time rate {metrics?.onTimeRate ?? 'Insufficient data'}
      </div>
    </Layout>
  )
}
