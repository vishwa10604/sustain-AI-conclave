import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { signUp } from '../lib/api'
import Brand from '../components/Brand'

export default function SignUp() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialRole = searchParams.get('role') === 'MANAGER' ? 'MANAGER' : 'DRIVER'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(initialRole)
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseExpiry, setLicenseExpiry] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await signUp({
        name,
        email,
        password,
        role,
        ...(role === 'DRIVER' && { licenseNumber, licenseExpiry, dateOfBirth: dateOfBirth || null }),
      })
      window.localStorage.setItem('fleetmind.token', session.token)
      window.localStorage.setItem('fleetmind.role', session.role)
      window.localStorage.setItem('fleetmind.email', session.email)
      navigate(role === 'DRIVER' ? '/driver-dashboard' : '/', { replace: true })
    } catch (requestError) {
      setError(requestError.message || 'Unable to create your account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page dark-login">
      <form className="login-card dark-card signup-card" onSubmit={handleSubmit}>
        <div className="login-header">
          <Brand />
          <span className="eyebrow">Create an account</span>
          <h1>Sign up</h1>
          <p>Join Verdant Fleet to manage operations or drive assigned trips.</p>
        </div>
        <label className="login-field">
          <span>Account type</span>
          <select value={role} onChange={event => setRole(event.target.value)}>
            <option value="DRIVER">Driver</option>
            <option value="MANAGER">Manager</option>
          </select>
        </label>
        <label className="login-field">
          <span>Full name</span>
          <input value={name} autoComplete="name" required
            onChange={event => setName(event.target.value)} />
        </label>
        <label className="login-field">
          <span>Email</span>
          <input type="email" value={email} autoComplete="email" required
            onChange={event => setEmail(event.target.value)} />
        </label>
        <label className="login-field">
          <span>Password (at least 8 characters)</span>
          <input type="password" value={password} minLength={8} autoComplete="new-password" required
            onChange={event => setPassword(event.target.value)} />
        </label>
        {role === 'DRIVER' && (
          <>
            <label className="login-field">
              <span>License number</span>
              <input value={licenseNumber} required
                onChange={event => setLicenseNumber(event.target.value)} />
            </label>
            <label className="login-field">
              <span>License expiry</span>
              <input type="date" value={licenseExpiry} min={new Date().toISOString().slice(0, 10)} required
                onChange={event => setLicenseExpiry(event.target.value)} />
            </label>
            <label className="login-field">
              <span>Date of birth (optional)</span>
              <input type="date" value={dateOfBirth} max={new Date().toISOString().slice(0, 10)}
                onChange={event => setDateOfBirth(event.target.value)} />
            </label>
          </>
        )}
        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="submit" className={`primary-btn${role === 'DRIVER' ? ' driver-btn' : ''}`} disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <p className="login-switch">Already have an account? <Link to={role === 'DRIVER' ? '/driver-login' : '/manager-login'}>Sign in</Link></p>
        <p className="login-switch"><Link to="/role-selection">Back to role selection</Link></p>
      </form>
    </div>
  )
}
