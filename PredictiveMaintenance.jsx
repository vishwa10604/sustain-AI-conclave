import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CalendarClock, ClipboardCheck, Gauge, RefreshCw, Wrench } from 'lucide-react'
import Layout from '../components/Layout'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'
import { apiRequest } from '../lib/api'

const DAYS_AHEAD = 30
const DAY_MS = 24 * 60 * 60 * 1000

function parseDate(value) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = parseDate(value)
  return date ? date.toLocaleDateString() : 'Not scheduled'
}

function maintenanceForecast(vehicle, records, today) {
  const vehicleRecords = records.filter(record => String(record.vehicleId) === String(vehicle.id))
  const openRecords = vehicleRecords.filter(record => String(record.status).toUpperCase() !== 'COMPLETED')
  const latestRecord = [...vehicleRecords].sort((a, b) => {
    const dateA = parseDate(a.serviceDate)?.getTime() || 0
    const dateB = parseDate(b.serviceDate)?.getTime() || 0
    return dateB - dateA
  })[0]
  const dueDate = vehicle.nextServiceDue || latestRecord?.nextServiceDate || null
  const due = parseDate(dueDate)
  const daysUntilDue = due ? Math.ceil((due.getTime() - today.getTime()) / DAY_MS) : null

  let status = 'No schedule'
  let statusTone = 'info'
  if (vehicle.status === 'MAINTENANCE' || openRecords.length) {
    status = vehicle.status === 'MAINTENANCE' ? 'In maintenance' : 'Open service'
    statusTone = openRecords.some(record => ['HIGH', 'CRITICAL'].includes(String(record.severity).toUpperCase()))
      ? 'danger' : 'warning'
  } else if (daysUntilDue !== null && daysUntilDue < 0) {
    status = 'Overdue'
    statusTone = 'danger'
  } else if (daysUntilDue !== null && daysUntilDue <= DAYS_AHEAD) {
    status = 'Due soon'
    statusTone = 'warning'
  } else if (dueDate) {
    status = 'Scheduled'
    statusTone = 'success'
  }

  return {
    vehicle,
    latestRecord,
    openRecords,
    dueDate,
    daysUntilDue,
    status,
    statusTone,
  }
}

export default function PredictiveMaintenance() {
  const [vehicles, setVehicles] = useState(null)
  const [records, setRecords] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadForecast = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [vehicleData, maintenanceData] = await Promise.all([
        apiRequest('/vehicles'),
        apiRequest('/maintenance'),
      ])
      setVehicles(vehicleData)
      setRecords(maintenanceData)
    } catch (requestError) {
      setError(requestError.message || 'Unable to load maintenance forecast.')
      setVehicles(null)
      setRecords(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadForecast() }, [loadForecast])

  const forecast = useMemo(() => {
    if (!Array.isArray(vehicles) || !Array.isArray(records)) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return vehicles.map(vehicle => maintenanceForecast(vehicle, records, today))
      .sort((a, b) => {
        const severityOrder = { Overdue: 0, 'Open service': 1, 'In maintenance': 1, 'Due soon': 2, Scheduled: 3, 'No schedule': 4 }
        return severityOrder[a.status] - severityOrder[b.status]
          || (a.daysUntilDue ?? Infinity) - (b.daysUntilDue ?? Infinity)
      })
  }, [vehicles, records])

  const overdueCount = forecast.filter(item => item.status === 'Overdue').length
  const dueSoonCount = forecast.filter(item => item.status === 'Due soon').length
  const openServiceCount = forecast.reduce((total, item) => total + item.openRecords.length, 0)
  const unscheduledCount = forecast.filter(item => item.status === 'No schedule').length

  return (
    <Layout title="Predictive Maintenance">
      <section className="metric-section" aria-label="Maintenance forecast overview">
        <div className="metric-section-heading">
          <div><Activity size={16} /><h2>Maintenance forecast</h2></div>
          <span>Schedule-based outlook from fleet records</span>
        </div>
        <div className="kpi-strip">
          <Metric label="Overdue service" value={loading ? '—' : overdueCount} description="Past the recorded service date" icon={AlertTriangle} tone="red" />
          <Metric label="Due in 30 days" value={loading ? '—' : dueSoonCount} description="Upcoming scheduled service" icon={CalendarClock} tone="amber" />
          <Metric label="Open service items" value={loading ? '—' : openServiceCount} description="Uncompleted maintenance records" icon={Wrench} tone="blue" />
          <Metric label="No schedule recorded" value={loading ? '—' : unscheduledCount} description="Needs a service due date" icon={ClipboardCheck} tone="teal" />
        </div>
      </section>

      <section className="reference-panel predictive-panel">
        <div className="section-header">
          <div>
            <h2>Vehicle service outlook</h2>
            <p className="panel-description">Vehicles are prioritized by overdue dates, active service records, and upcoming due dates.</p>
          </div>
          <button className="secondary-btn compact-btn" type="button" onClick={loadForecast} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
        </div>

        {loading && <LoadingState label="Loading maintenance forecast" />}
        {!loading && error && <ErrorState message={`Maintenance forecast unavailable: ${error}`} onRetry={loadForecast} />}
        {!loading && !error && forecast.length === 0 && (
          <EmptyState title="No vehicles to forecast" detail="Vehicle records from the fleet service will appear here." />
        )}
        {!loading && !error && forecast.length > 0 && (
          <div className="table-scroll">
            <table className="data-table predictive-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Forecast</th>
                  <th>Next service</th>
                  <th>Odometer</th>
                  <th>Latest maintenance record</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map(item => (
                  <tr key={item.vehicle.id}>
                    <td>
                      <strong>{item.vehicle.registrationNumber}</strong>
                      <span className="predictive-subtext">{item.vehicle.vehicleType || 'Vehicle'} · {item.vehicle.status?.replaceAll('_', ' ') || 'Status unknown'}</span>
                    </td>
                    <td><span className={`status-badge ${item.statusTone}`}>{item.status}</span></td>
                    <td>
                      {formatDate(item.dueDate)}
                      {item.daysUntilDue !== null && (
                        <span className="predictive-subtext">
                          {item.daysUntilDue < 0 ? `${Math.abs(item.daysUntilDue)} days overdue`
                            : item.daysUntilDue === 0 ? 'Due today' : `In ${item.daysUntilDue} days`}
                        </span>
                      )}
                    </td>
                    <td>{item.vehicle.odometer == null ? 'Not recorded' : `${Number(item.vehicle.odometer).toLocaleString()} km`}</td>
                    <td>
                      {item.latestRecord
                        ? <><strong>{item.latestRecord.maintenanceType || 'Service'}</strong><span className="predictive-subtext">{item.latestRecord.status?.replaceAll('_', ' ') || 'Status unknown'} · {formatDate(item.latestRecord.serviceDate)}</span></>
                        : 'No maintenance history'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="predictive-note"><Gauge size={13} aria-hidden="true" /> Forecast uses recorded due dates and maintenance logs; sensor-based fault prediction is not connected.</p>
      </section>
    </Layout>
  )
}

function Metric({ label, value, description, icon: Icon, tone }) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-card-heading">
        <span className="metric-label">{label}</span>
        <span className="metric-icon"><Icon size={15} aria-hidden="true" /></span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-hint">{description}</div>
    </article>
  )
}
