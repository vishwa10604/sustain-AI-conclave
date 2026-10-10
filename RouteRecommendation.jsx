import { useCallback, useEffect, useState } from 'react'
import { MapPinned, CloudSun, TrafficCone, Navigation } from 'lucide-react'
import { apiRequest } from '../lib/api'
import Layout from '../components/Layout'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'
import GoogleFleetMap from '../components/GoogleFleetMap'

export default function RouteRecommendation() {
  const [trips, setTrips] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(true)
  const [routeLoading, setRouteLoading] = useState(false)
  const [error, setError] = useState('')
  const [routeError, setRouteError] = useState('')
  const [showRoute, setShowRoute] = useState(true)

  const loadTrips = useCallback(async () => {
    setLoading(true)
    setError('')
    const [tripsResult, vehiclesResult] = await Promise.allSettled([
      apiRequest('/trips'),
      apiRequest('/vehicles'),
    ])
    if (tripsResult.status === 'fulfilled') {
      setTrips(tripsResult.value)
      setSelectedId(current => current || String(tripsResult.value[0]?.id || ''))
    } else {
      setError(tripsResult.reason.message || 'Trip records are unavailable.')
      setTrips([])
    }
    setVehicles(vehiclesResult.status === 'fulfilled' ? vehiclesResult.value : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadTrips() }, [loadTrips])
  const trip = trips.find(item => String(item.id) === selectedId)

  const handleRouteChange = useCallback(routeResult => {
    setRoute(routeResult)
  }, [])
  const handleRouteState = useCallback((state, message) => {
    setRouteLoading(state === 'loading')
    setRouteError(message || '')
  }, [])

  return (
    <Layout title="Route recommendation">
      <section className="reference-panel route-workspace">
        <div className="route-workspace-header">
          <div><h2>Route recommendation</h2><p className="panel-description">Google Maps driving route and baseline ETA displayed on satellite imagery.</p></div>
          <label>Select trip
            <select aria-label="Select a trip for route estimate" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
              <option value="">Choose trip</option>
              {trips.map(item => <option key={item.id} value={item.id}>{item.referenceNumber} · {item.originName} → {item.destinationName}</option>)}
            </select>
          </label>
        </div>
        {loading && <LoadingState label="Loading trips" />}
        {!loading && error && <ErrorState message={`Route input unavailable: ${error}`} onRetry={loadTrips} />}
        {!loading && !error && !trips.length && <EmptyState title="No trips available" detail="Create a trip with origin and destination coordinates before requesting a route." />}
        {trip && (
          <>
            <div className="route-summary-banner">
              <div><span>Origin</span><strong>{trip.originName}</strong></div>
              <Navigation size={17} aria-hidden="true" />
              <div><span>Destination</span><strong>{trip.destinationName}</strong></div>
              <div className="route-result">
                {routeLoading ? 'Calculating…' : route
                  ? `${route.distanceKm.toFixed(1)} km · ${Math.round(route.durationMinutes)} min`
                  : 'Google road route unavailable'}
              </div>
            </div>
            {routeError && <div className="route-fallback-note">Google Maps route unavailable: {routeError}</div>}
            <div className="route-map-frame">
              <GoogleFleetMap trip={trip} vehicles={vehicles} showRoute={showRoute}
                onRouteChange={handleRouteChange} onRouteStateChange={handleRouteState} />
              <div className="map-tools">
                <button type="button" onClick={() => setShowRoute(value => !value)}>
                  {showRoute ? 'Hide route' : 'Show route'}
                </button>
              </div>
            </div>
            <div className="route-quality-note">
              {route ? 'Route geometry and duration are provided by Google Maps. Duration is a baseline estimate, not live traffic.' : 'A Google Maps road route has not been returned.'}
              {' '}No weather service is connected. Active-trip mini-truck movement is simulated, not live GPS.
            </div>
          </>
        )}
      </section>
      <div className="route-unavailable-grid">
        <section className="reference-panel route-unavailable-card">
          <TrafficCone size={21} aria-hidden="true" />
          <EmptyState title="Live traffic unavailable" detail="Google Maps returns a baseline duration in this integration; real-time traffic data has not been requested." />
        </section>
        <section className="reference-panel route-unavailable-card">
          <CloudSun size={21} aria-hidden="true" />
          <EmptyState title="Weather unavailable" detail="No weather API is configured, so no conditions are inferred." />
        </section>
        <section className="reference-panel route-unavailable-card">
          <MapPinned size={21} aria-hidden="true" />
          <EmptyState title="Route inputs" detail="Directions use the origin and destination coordinates recorded with the manager-created trip." />
        </section>
      </div>
    </Layout>
  )
}
