import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, CloudSun, Fuel, MapPinned, Navigation, RefreshCw, TrafficCone } from 'lucide-react'
import { apiRequest, requestRouteAssistant } from '../lib/api'
import Layout from '../components/Layout'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'
import GoogleFleetMap from '../components/GoogleFleetMap'

const weatherDescriptions = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Heavy rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm with hail',
}

function validCoordinates(trip, prefix) {
  const latitude = Number(trip?.[`${prefix}Latitude`])
  const longitude = Number(trip?.[`${prefix}Longitude`])
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude } : null
}

async function loadForecast(trip, prefix, signal) {
  const point = validCoordinates(trip, prefix)
  if (!point) throw new Error(`Valid ${prefix} coordinates are required for a weather forecast.`)
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', point.latitude)
  url.searchParams.set('longitude', point.longitude)
  url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code')
  url.searchParams.set('forecast_days', '7')
  url.searchParams.set('timezone', 'UTC')
  if (trip.requestedPickupTime
    && new Date(trip.requestedPickupTime).getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) {
    throw new Error('Open-Meteo forecast is available up to 7 days ahead of the requested pickup.')
  }
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Weather provider returned HTTP ${response.status}.`)
  const data = await response.json()
  const times = data.hourly?.time || []
  if (!times.length) throw new Error('Weather provider returned no hourly forecast.')

  const target = trip.requestedPickupTime ? new Date(trip.requestedPickupTime).getTime() : Date.now()
  let index = 0
  let smallestDifference = Infinity
  times.forEach((time, candidateIndex) => {
    const difference = Math.abs(new Date(`${time}:00Z`).getTime() - target)
    if (difference < smallestDifference) {
      smallestDifference = difference
      index = candidateIndex
    }
  })
  const getValue = key => data.hourly[key]?.[index] ?? null
  return {
    temperatureC: getValue('temperature_2m'),
    precipitationProbability: getValue('precipitation_probability'),
    precipitationMm: getValue('precipitation'),
    windSpeedKmh: getValue('wind_speed_10m'),
    weatherCode: getValue('weather_code'),
    forecastTime: new Date(`${times[index]}:00Z`).toISOString(),
    description: weatherDescriptions[getValue('weather_code')] || 'Conditions unavailable',
  }
}

function displayNumber(value, digits = 1) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—'
}

function toIsoTimestamp(value) {
  return value ? new Date(value).toISOString() : value
}

export default function RouteRecommendation() {
  const [trips, setTrips] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState('auto')
  const [route, setRoute] = useState(null)
  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState('')
  const [assistant, setAssistant] = useState(null)
  const [assistantError, setAssistantError] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [routeLoading, setRouteLoading] = useState(false)
  const [error, setError] = useState('')
  const [routeError, setRouteError] = useState('')
  const [showRoute, setShowRoute] = useState(true)
  const trip = trips.find(item => String(item.id) === selectedId)

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
    if (vehiclesResult.status === 'fulfilled') setVehicles(vehiclesResult.value)
    else setError(current => current || `Vehicle records are unavailable: ${vehiclesResult.reason.message}`)
    setLoading(false)
  }, [])

  useEffect(() => { loadTrips() }, [loadTrips])

  const eligibleVehicles = useMemo(() => {
    if (!trip) return []
    return vehicles.filter(vehicle => vehicle.status === 'AVAILABLE'
      || (trip.vehicleId != null && String(vehicle.id) === String(trip.vehicleId)))
  }, [trip, vehicles])

  useEffect(() => {
    setRoute(null)
    setAssistant(null)
    setAssistantError('')
    setWeather(null)
    setWeatherError('')
    if (!trip) return undefined
    const controller = new AbortController()
    setWeatherLoading(true)
    Promise.all([
      loadForecast(trip, 'origin', controller.signal),
      loadForecast(trip, 'destination', controller.signal),
    ]).then(([origin, destination]) => setWeather({ origin, destination }))
      .catch(weatherRequestError => {
        if (!controller.signal.aborted) setWeatherError(weatherRequestError.message || 'Weather forecast is unavailable.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setWeatherLoading(false)
      })
    return () => controller.abort()
  }, [trip])

  const handleRouteChange = useCallback(routeResult => {
    setRoute(routeResult)
    setAssistant(null)
    setAssistantError('')
  }, [])
  const handleRouteState = useCallback((state, message) => {
    setRouteLoading(state === 'loading')
    setRouteError(message || '')
  }, [])

  async function analyzeRoute() {
    if (!trip || !route) {
      setAssistantError('Wait for an OSRM route before asking for a recommendation.')
      return
    }
    const chosenVehicles = selectedVehicleId === 'auto'
      ? eligibleVehicles
      : eligibleVehicles.filter(vehicle => String(vehicle.id) === selectedVehicleId)
    if (!chosenVehicles.length) {
      setAssistantError('No eligible vehicle is available for this trip. Select another vehicle or make one available.')
      return
    }
    setAssistantError('')
    setAssistant(null)
    setAssistantLoading(true)
    try {
      const response = await requestRouteAssistant({
        trip: {
          originName: trip.originName,
          destinationName: trip.destinationName,
          cargoWeightKg: Number(trip.cargoWeightKg),
          cargoVolume: Number(trip.cargoVolume),
          priority: trip.priority,
          requestedPickupTime: toIsoTimestamp(trip.requestedPickupTime),
          deliveryDeadline: toIsoTimestamp(trip.deliveryDeadline),
        },
        routes: route.alternatives?.length
          ? route.alternatives
          : [{ index: 1, distanceKm: route.distanceKm, durationMinutes: route.durationMinutes }],
        vehicles: chosenVehicles.map(vehicle => ({
          id: vehicle.id,
          registrationNumber: vehicle.registrationNumber,
          vehicleType: vehicle.vehicleType,
          capacityKg: Number(vehicle.capacityKg),
          capacityVolume: Number(vehicle.capacityVolume),
          fuelEfficiencyKmPerLitre: Number(vehicle.fuelEfficiency),
          fuelRemainingLitres: vehicle.fuelRemainingLitres == null ? null : Number(vehicle.fuelRemainingLitres),
          fuelTankCapacityLitres: vehicle.fuelTankCapacityLitres == null ? null : Number(vehicle.fuelTankCapacityLitres),
          status: vehicle.status,
        })),
        originWeather: weather?.origin || null,
        destinationWeather: weather?.destination || null,
      })
      setAssistant(response)
    } catch (requestError) {
      setAssistantError(requestError.message || 'Route assistant is unavailable.')
    } finally {
      setAssistantLoading(false)
    }
  }

  const recommendedAssessment = assistant?.routeAssessments?.find(item =>
    item.routeIndex === assistant.recommendedRouteIndex
      && String(item.vehicleId) === String(assistant.recommendedVehicleId))

  return (
    <Layout title="Route recommendation">
      <section className="reference-panel route-workspace">
        <div className="route-workspace-header">
          <div>
            <h2>Route recommendation</h2>
            <p className="panel-description">Compare OSRM road alternatives with forecast weather, cargo fit, delivery deadline, and recorded fuel.</p>
          </div>
          <label>Select trip
            <select aria-label="Select a trip for route estimate" value={selectedId}
              onChange={event => setSelectedId(event.target.value)}>
              <option value="">Choose trip</option>
              {trips.map(item => <option key={item.id} value={item.id}>
                {item.referenceNumber} · {item.originName} → {item.destinationName}
              </option>)}
            </select>
          </label>
        </div>
        {loading && <LoadingState label="Loading trips and vehicles" />}
        {!loading && error && <ErrorState message={`Route inputs unavailable: ${error}`} onRetry={loadTrips} />}
        {!loading && !error && !trips.length && <EmptyState title="No trips available" detail="Create a trip with origin and destination coordinates before requesting a route." />}
        {trip && (
          <>
            <div className="route-summary-banner">
              <div><span>Origin</span><strong>{trip.originName}</strong></div>
              <Navigation size={17} aria-hidden="true" />
              <div><span>Destination</span><strong>{trip.destinationName}</strong></div>
              <div className="route-result">
                {routeLoading ? 'Calculating routes…' : route
                  ? `${route.alternatives?.length || 1} route option(s) · ${route.distanceKm.toFixed(1)} km fastest`
                  : 'OSRM road route unavailable'}
              </div>
            </div>
            <div className="route-assistant-controls">
              <label>Vehicle for comparison
                <select value={selectedVehicleId} onChange={event => setSelectedVehicleId(event.target.value)}>
                  <option value="auto">Compare all eligible vehicles ({eligibleVehicles.length})</option>
                  {eligibleVehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registrationNumber} · {vehicle.fuelRemainingLitres ?? 'Fuel unknown'} L
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary-btn" type="button" onClick={analyzeRoute}
                disabled={!route || routeLoading || assistantLoading}>
                <Bot size={16} aria-hidden="true" />
                {assistantLoading ? 'Analyzing…' : 'Ask route assistant'}
              </button>
            </div>
            {routeError && <div className="route-fallback-note">OSRM road route unavailable: {routeError}</div>}
            <div className="route-map-frame">
              <GoogleFleetMap trip={trip} vehicles={vehicles} showRoute={showRoute}
                onRouteChange={handleRouteChange} onRouteStateChange={handleRouteState} />
              <div className="map-tools">
                <button type="button" onClick={() => setShowRoute(value => !value)}>
                  {showRoute ? 'Hide route' : 'Show route'}
                </button>
              </div>
            </div>
            <section className="reference-panel route-weather-panel">
              <div className="route-panel-heading">
                <CloudSun size={19} aria-hidden="true" />
                <div><h3>Weather forecast</h3><p>Open-Meteo forecast at both trip endpoints near the requested pickup time.</p></div>
                {weatherLoading && <RefreshCw size={15} className="route-spin" aria-label="Loading forecast" />}
              </div>
              {weatherError && <div className="route-fallback-note">Weather unavailable: {weatherError} Recommendation can still run without a weather adjustment.</div>}
              <div className="route-weather-grid">
                {['origin', 'destination'].map(point => (
                  <div key={point}>
                    <span>{point === 'origin' ? trip.originName : trip.destinationName}</span>
                    <strong>{weather?.[point]?.description || (weatherLoading ? 'Loading forecast…' : 'No forecast')}</strong>
                    <small>{weather?.[point]
                      ? `${displayNumber(weather[point].temperatureC, 0)}°C · ${displayNumber(weather[point].precipitationProbability, 0)}% rain chance · ${displayNumber(weather[point].windSpeedKmh, 0)} km/h wind`
                      : 'Weather data not available'}</small>
                  </div>
                ))}
              </div>
            </section>
            {assistantError && <ErrorState message={assistantError} />}
            {assistant && (
              <section className="reference-panel route-assistant-panel">
                <div className="route-panel-heading">
                  <Bot size={19} aria-hidden="true" />
                  <div><h3>Route planning assistant</h3><p>{assistant.method}</p></div>
                </div>
                <p className="route-assistant-summary">{assistant.recommendation}</p>
                {recommendedAssessment && (
                  <>
                    <div className="route-assistant-metrics">
                      <div><span>Suggested route</span><strong>Option {assistant.recommendedRouteIndex} · {displayNumber(recommendedAssessment.distanceKm)} km</strong></div>
                      <div><span>Vehicle</span><strong>{assistant.recommendedVehicleRegistration}</strong></div>
                      <div><span>Weather-adjusted ETA</span><strong>{displayNumber(recommendedAssessment.weatherAdjustedDurationMinutes, 0)} min</strong></div>
                      <div><span>Fuel estimate / usable</span><strong>{displayNumber(recommendedAssessment.estimatedFuelLitres)} L / {displayNumber(recommendedAssessment.usableFuelLitres)} L</strong></div>
                    </div>
                    <ul className="route-assistant-reasons">
                      {recommendedAssessment.reasons.map(reason => <li key={reason}>{reason}</li>)}
                    </ul>
                  </>
                )}
                <div className="route-quality-note">
                  {assistant.weatherSummary} Scores are explainable decision support, not a live-traffic or guaranteed arrival prediction.
                </div>
              </section>
            )}
            <div className="route-quality-note">
              OSRM provides road geometry and a baseline duration, not live traffic. Fuel estimates assume the recorded efficiency is in km/L and retain a 15% tank reserve.
              {' '}Active-trip mini-truck movement is simulated, not live GPS.
            </div>
          </>
        )}
      </section>
      <div className="route-unavailable-grid">
        <section className="reference-panel route-unavailable-card">
          <TrafficCone size={21} aria-hidden="true" />
          <EmptyState title="Live traffic unavailable" detail="OSRM returns baseline durations; real-time traffic data is not available in this integration." />
        </section>
        <section className="reference-panel route-unavailable-card">
          <Fuel size={21} aria-hidden="true" />
          <EmptyState title="Fuel readings" detail="Update each vehicle's remaining fuel and tank capacity in Vehicle availability & maintenance." />
        </section>
        <section className="reference-panel route-unavailable-card">
          <MapPinned size={21} aria-hidden="true" />
          <EmptyState title="Route inputs" detail="Route and weather forecasts use the origin/destination coordinates recorded with the manager-created trip." />
        </section>
      </div>
    </Layout>
  )
}
