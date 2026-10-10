import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn } from '../lib/api'

export default function DriverLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await signIn(email, password)
      if (session.role !== 'DRIVER') throw new Error('This account does not have driver access.')
      window.localStorage.setItem('fleetmind.token', session.token)
      window.localStorage.setItem('fleetmind.role', session.role)
      window.localStorage.setItem('fleetmind.email', session.email)
      navigate('/driver-dashboard', { replace: true })
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page dark-login">
      <form className="login-card dark-card" onSubmit={handleSubmit}>
        <div className="login-header">
          <span className="eyebrow">FleetMind AI · Driver access</span>
          <h1>Driver sign in</h1>
          <p>Access your assigned fleet workspace.</p>
        </div>
        <label className="login-field">
          <span>Email</span>
          <input type="email" value={email} autoComplete="username" required
            onChange={event => setEmail(event.target.value)} />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input type="password" value={password} autoComplete="current-password" required
            onChange={event => setPassword(event.target.value)} />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="submit" className="primary-btn driver-btn" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in as Driver'}
        </button>
        <p className="login-switch">Manager? <Link to="/manager-login">Sign in here</Link></p>
        <p className="login-switch"><Link to="/role-selection">Back to role selection</Link></p>
      </form>
    </div>
  )
}
