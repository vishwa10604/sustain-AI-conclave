import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'
import { apiRequest } from '../lib/api'

function driverName(driver) {
  return driver.user?.name || driver.user?.email || 'Name unavailable'
}

export default function Drivers() {
  const [drivers, setDrivers] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', licenseNumber: '', licenseExpiry: '', dateOfBirth: '' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const loadDrivers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDrivers(await apiRequest('/drivers'))
    } catch (requestError) {
      setDrivers(null)
      setError(requestError.message || 'Unable to load drivers.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDrivers() }, [loadDrivers])
  useEffect(() => {
    const applyGlobalSearch = event => setQuery(event.detail || '')
    window.addEventListener('fleetmind-search', applyGlobalSearch)
    return () => window.removeEventListener('fleetmind-search', applyGlobalSearch)
  }, [])

  const filteredDrivers = useMemo(() => {
    if (!Array.isArray(drivers)) return []
    const text = query.trim().toLowerCase()
    return drivers.filter(driver => [
      driverName(driver), driver.licenseNumber, driver.availabilityStatus,
    ].some(value => String(value || '').toLowerCase().includes(text)))
  }, [drivers, query])

  async function createDriver(event) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setNotice('')
    try {
      await apiRequest('/drivers', { method: 'POST', body: JSON.stringify(form) })
      setNotice(`Driver ${form.name} was added. They can now sign in with the email and password you assigned.`)
      setForm({ name: '', email: '', password: '', licenseNumber: '', licenseExpiry: '', dateOfBirth: '' })
      setShowForm(false)
      await loadDrivers()
    } catch (requestError) {
      setFormError(requestError.message || 'Could not create the driver profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout title="Driver details">
      <section className="reference-panel table-panel">
        <div className="section-header">
          <div><h2>Driver details</h2><p className="panel-description">Roster records and license validity from the manager API.</p></div>
          <div className="table-action-group">
            <button className="primary-btn compact-btn" type="button" onClick={() => setShowForm(value => !value)}>{showForm ? 'Close form' : 'Add driver'}</button>
            <button className="secondary-btn compact-btn" type="button" onClick={loadDrivers}>Refresh</button>
          </div>
        </div>
        {notice && <div className="success-message" role="status">{notice}</div>}
        {showForm && (
          <form className="trip-create-form" onSubmit={createDriver}>
            <h3>Create driver account</h3>
            <div className="form-grid">
              <label>Full name<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
              <label>Email<input type="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
              <label>Temporary password<input type="password" minLength="8" required value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>
              <label>License number<input required value={form.licenseNumber} onChange={event => setForm({ ...form, licenseNumber: event.target.value })} /></label>
              <label>License expiry<input type="date" required value={form.licenseExpiry} onChange={event => setForm({ ...form, licenseExpiry: event.target.value })} /></label>
              <label>Date of birth<input type="date" required value={form.dateOfBirth} onChange={event => setForm({ ...form, dateOfBirth: event.target.value })} /></label>
            </div>
            {formError && <ErrorState message={`Driver could not be created: ${formError}`} />}
            <div className="form-actions">
              <button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create driver'}</button>
              <button className="text-button" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        )}
        <div className="table-controls">
          <label className="search-row"><span aria-hidden="true">⌕</span><input value={query}
            onChange={event => setQuery(event.target.value)} placeholder="Search drivers" /></label>
        </div>
        {loading && <LoadingState label="Loading driver roster" />}
        {!loading && error && <ErrorState message={`Drivers could not be loaded: ${error}`} onRetry={loadDrivers} />}
        {!loading && !error && Array.isArray(drivers) && !drivers.length
          && <EmptyState title="No driver records" detail="The fleet API returned an empty driver roster." />}
        {!error && Array.isArray(drivers) && drivers.length > 0 && filteredDrivers.length === 0
          && <EmptyState title="No matching drivers" detail="Try a different search." />}
        {!error && Array.isArray(drivers) && filteredDrivers.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Driver</th><th>License</th><th>Expiry</th><th>Availability</th><th>Recorded coordinates</th></tr></thead>
              <tbody>
                {filteredDrivers.map(driver => (
                  <tr key={driver.id}>
                    <td>{driverName(driver)}</td>
                    <td>{driver.licenseNumber}</td>
                    <td>{driver.licenseExpiry || 'Not recorded'}</td>
                    <td><span className="status-badge info">{(driver.availabilityStatus || 'UNKNOWN').replaceAll('_', ' ')}</span></td>
                    <td>{driver.currentLocationLatitude != null && driver.currentLocationLongitude != null
                      ? `${driver.currentLocationLatitude}, ${driver.currentLocationLongitude}` : 'Not recorded'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="data-footnote">
        Driver assignment history and delivery performance are not available from the current API.
      </div>
    </Layout>
  )
}
