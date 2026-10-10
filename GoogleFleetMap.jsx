import { useEffect, useMemo, useRef, useState } from 'react'

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
let mapsApiPromise

function loadGoogleMapsApi() {
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (!apiKey) return Promise.reject(new Error('Set VITE_GOOGLE_MAPS_API_KEY in frontend/.env.local to enable Google Maps.'))
  if (!mapsApiPromise) {
    mapsApiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`
      script.async = true
      script.defer = true
      script.onload = () => window.google?.maps
        ? resolve(window.google.maps)
        : reject(new Error('Google Maps loaded without its Maps JavaScript API.'))
      script.onerror = () => reject(new Error('Google Maps could not be loaded. Check the API key, network, and enabled APIs.'))
      document.head.appendChild(script)
    }).catch(error => {
      mapsApiPromise = null
      throw error
    })
  }
  return mapsApiPromise
}

function coordinates(trip, prefix) {
  const rawLatitude = trip?.[`${prefix}Latitude`]
  const rawLongitude = trip?.[`${prefix}Longitude`]
  if (rawLatitude == null || rawLongitude == null
    || String(rawLatitude).trim() === '' || String(rawLongitude).trim() === '') return null
  const latitude = Number(rawLatitude)
  const longitude = Number(rawLongitude)
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { lat: latitude, lng: longitude }
    : null
}

function truckIcon(maps, status) {
  const color = status === 'AVAILABLE' ? '#278653'
    : status === 'ON_TRIP' ? '#d38a27' : '#657487'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="64" viewBox="0 0 56 64">
    <path d="M28 2C13.6 2 2 13.6 2 28c0 19 26 34 26 34s26-15 26-34C54 13.6 42.4 2 28 2Z" fill="${color}" stroke="#fff" stroke-width="2"/>
    <path d="M12 22h20v16H12zM32 27h7l6 6v5H32z" fill="#fff" stroke="#173126" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M35 29v5h7l-4-5z" fill="#9fc5df"/>
    <circle cx="20" cy="40" r="3.5" fill="#17212b" stroke="#fff" stroke-width="1.5"/>
    <circle cx="39" cy="40" r="3.5" fill="#17212b" stroke="#fff" stroke-width="1.5"/>
  </svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(42, 48),
    anchor: new maps.Point(21, 46),
  }
}

function tripCoordinatesKey(trip) {
  if (!trip) return ''
  return [
    trip.id,
    trip.originLatitude,
    trip.originLongitude,
    trip.destinationLatitude,
    trip.destinationLongitude,
  ].join(':')
}

export default function GoogleFleetMap({
  trip,
  vehicles = [],
  showRoute = true,
  className = '',
  onRouteChange,
  onRouteStateChange,
}) {
  const mapElement = useRef(null)
  const routePolylinesRef = useRef([])
  const showRouteRef = useRef(showRoute)
  const [map, setMap] = useState(null)
  const [mapError, setMapError] = useState('')
  const [routePath, setRoutePath] = useState([])
  const tripKey = useMemo(() => tripCoordinatesKey(trip), [trip])
  const origin = useMemo(() => coordinates(trip, 'origin'), [tripKey])
  const destination = useMemo(() => coordinates(trip, 'destination'), [tripKey])

  useEffect(() => {
    let cancelled = false
    loadGoogleMapsApi()
      .then(maps => {
        if (cancelled || !mapElement.current) return
        const instance = new maps.Map(mapElement.current, {
          center: { lat: 20.5937, lng: 78.9629 },
          zoom: 5,
          mapTypeId: maps.MapTypeId.SATELLITE,
          mapTypeControl: true,
          mapTypeControlOptions: {
            mapTypeIds: [maps.MapTypeId.HYBRID, maps.MapTypeId.SATELLITE, maps.MapTypeId.ROADMAP],
            position: maps.ControlPosition.TOP_RIGHT,
            style: maps.MapTypeControlStyle.HORIZONTAL_BAR,
          },
          fullscreenControl: true,
          streetViewControl: false,
          zoomControl: true,
          clickableIcons: false,
        })
        setMap(instance)
      })
      .catch(error => {
        if (!cancelled) {
          const message = error.message || 'Google Maps is unavailable.'
          setMapError(message)
          onRouteChange?.(null)
          onRouteStateChange?.('error', message)
        }
      })
    return () => { cancelled = true }
  }, [onRouteChange, onRouteStateChange])

  useEffect(() => {
    showRouteRef.current = showRoute
    routePolylinesRef.current.forEach(polyline => polyline.setMap(showRoute ? map : null))
  }, [map, showRoute])

  useEffect(() => {
    if (!map) return undefined
    let cancelled = false
    const controller = new AbortController()
    routePolylinesRef.current.forEach(polyline => polyline.setMap(null))
    routePolylinesRef.current = []
    setRoutePath([])
    if (!origin || !destination) {
      onRouteChange?.(null)
      onRouteStateChange?.('unavailable', 'Trip coordinates are missing or invalid.')
      return undefined
    }

    onRouteChange?.(null)
    onRouteStateChange?.('loading', '')
    async function requestRoute() {
      try {
        const url = new URL(
          `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`,
        )
        url.searchParams.set('overview', 'full')
        url.searchParams.set('geometries', 'geojson')
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error(`OSRM returned HTTP ${response.status}.`)
        const result = await response.json()
        if (cancelled) return
        const selectedRoute = result.code === 'Ok' ? result.routes?.[0] : null
        const coordinates = selectedRoute?.geometry?.coordinates
        if (!selectedRoute || !Array.isArray(coordinates) || coordinates.length < 2) {
          onRouteChange?.(null)
          onRouteStateChange?.('error', result.message || 'OSRM returned no drivable road route.')
          return
        }
        const path = coordinates.map(([longitude, latitude]) => ({ lat: latitude, lng: longitude }))
        if (path.some(point => !Number.isFinite(point.lat) || !Number.isFinite(point.lng))) {
          throw new Error('OSRM returned invalid route coordinates.')
        }
        const polyline = new window.google.maps.Polyline({
          path,
          strokeColor: '#24c6a1',
          strokeOpacity: 0.92,
          strokeWeight: 6,
        })
        if (cancelled) {
          polyline.setMap(null)
          return
        }
        routePolylinesRef.current = [polyline]
        polyline.setMap(showRouteRef.current ? map : null)
        setRoutePath(path)
        if (path.length) {
          const bounds = new window.google.maps.LatLngBounds()
          path.forEach(point => bounds.extend(point))
          map.fitBounds(bounds, { top: 70, right: 70, bottom: 60, left: 70 })
        }
        onRouteChange?.({
          distanceKm: selectedRoute.distance / 1000,
          durationMinutes: selectedRoute.duration / 60,
        })
        onRouteStateChange?.('road', '')
      } catch (error) {
        if (cancelled || controller.signal.aborted) return
        routePolylinesRef.current.forEach(polyline => polyline.setMap(null))
        routePolylinesRef.current = []
        setRoutePath([])
        onRouteChange?.(null)
        onRouteStateChange?.('error', error.message || 'OSRM road route request failed.')
      }
    }
    requestRoute()
    return () => {
      cancelled = true
      controller.abort()
      routePolylinesRef.current.forEach(polyline => polyline.setMap(null))
      routePolylinesRef.current = []
    }
  }, [map, tripKey, origin?.lat, origin?.lng, destination?.lat, destination?.lng, onRouteChange, onRouteStateChange])

  useEffect(() => {
    if (!map) return undefined
    const maps = window.google.maps
    const markers = []
    const selectedVehicle = trip?.vehicleId == null
      ? null
      : vehicles.find(vehicle => String(vehicle.id) === String(trip.vehicleId))
    const simulateMovement = Boolean(
      showRoute && routePath.length > 1 && selectedVehicle
      && ['ASSIGNED', 'IN_PROGRESS'].includes(trip?.status),
    )

    if (origin && destination) {
      markers.push(new maps.Marker({
        map,
        position: origin,
        title: `Origin · ${trip.originName}`,
        label: { text: 'A', color: '#ffffff', fontWeight: '700', fontSize: '11px' },
        zIndex: 10,
      }))
      markers.push(new maps.Marker({
        map,
        position: destination,
        title: `Destination · ${trip.destinationName}`,
        label: { text: 'B', color: '#ffffff', fontWeight: '700', fontSize: '11px' },
        zIndex: 10,
      }))
    }

    let simulationTimer
    let simulatedMarker
    const vehiclesToFit = trip && selectedVehicle
      ? vehicles.filter(vehicle => String(vehicle.id) === String(selectedVehicle.id))
      : vehicles
    vehiclesToFit.forEach(vehicle => {
      const lat = Number(vehicle.currentLocationLatitude)
      const lng = Number(vehicle.currentLocationLongitude)
      const isSimulatedTruck = simulateMovement && String(vehicle.id) === String(selectedVehicle.id)
      const hasRecordedPosition = Number.isFinite(lat) && Number.isFinite(lng)
        && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      if (!hasRecordedPosition && !isSimulatedTruck) return
      const marker = new maps.Marker({
        map,
        position: isSimulatedTruck ? routePath[0] : { lat, lng },
        title: isSimulatedTruck
          ? `${vehicle.registrationNumber} · simulated movement (not live GPS)`
          : `${vehicle.registrationNumber} · last recorded fleet location`,
        icon: truckIcon(maps, vehicle.status),
        zIndex: isSimulatedTruck ? 20 : 5,
      })
      markers.push(marker)
      if (isSimulatedTruck) simulatedMarker = marker
    })

    if (simulateMovement && simulatedMarker) {
      let step = trip.status === 'IN_PROGRESS'
        ? Math.floor((routePath.length - 1) * 0.35) : 0
      simulatedMarker.setPosition(routePath[step])
      const stride = Math.max(1, Math.ceil((routePath.length - 1) / 50))
      simulationTimer = window.setInterval(() => {
        step = Math.min(step + stride, routePath.length - 1)
        simulatedMarker.setPosition(routePath[step])
        if (step >= routePath.length - 1) window.clearInterval(simulationTimer)
      }, 900)
    }

    const bounds = new maps.LatLngBounds()
    let hasPoint = false
    if (origin) { bounds.extend(origin); hasPoint = true }
    if (destination) { bounds.extend(destination); hasPoint = true }
    vehiclesToFit.forEach(vehicle => {
      const lat = Number(vehicle.currentLocationLatitude)
      const lng = Number(vehicle.currentLocationLongitude)
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        bounds.extend({ lat, lng })
        hasPoint = true
      }
    })
    if (hasPoint) map.fitBounds(bounds, { top: 70, right: 70, bottom: 60, left: 70 })
    return () => {
      window.clearInterval(simulationTimer)
      markers.forEach(marker => marker.setMap(null))
    }
  }, [map, tripKey, trip?.status, trip?.vehicleId, vehicles, origin?.lat, origin?.lng,
    destination?.lat, destination?.lng, routePath, showRoute])

  return (
    <div className={`google-map-shell ${className}`}>
      <div className="google-map-canvas" ref={mapElement} />
      {mapError && (
        <div className="google-map-message" role="status">
          <strong>Google Maps needs configuration</strong>
          <span>{mapError}</span>
        </div>
      )}
      {!mapError && !map && <div className="google-map-message">Loading Google Maps…</div>}
      {map && trip?.vehicleId != null && ['ASSIGNED', 'IN_PROGRESS'].includes(trip.status)
        && routePath.length > 1 && (
          <div className="google-map-simulation-note">Truck movement is simulated for preview—not live GPS.</div>
        )}
    </div>
  )
}
