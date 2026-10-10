import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn } from '../lib/api'

export default function ManagerLogin() {
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
      if (session.role !== 'MANAGER') throw new Error('This account does not have manager access.')
      window.localStorage.setItem('fleetmind.token', session.token)
      window.localStorage.setItem('fleetmind.role', session.role)
      window.localStorage.setItem('fleetmind.email', session.email)
      navigate('/dashboard', { replace: true })
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
          <span className="eyebrow">FleetMind AI · Manager access</span>
          <h1>Welcome back</h1>
          <p>Sign in to manage fleet operations.</p>
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
        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in as Manager'}
        </button>
        <p className="login-switch">Driver? <Link to="/driver-login">Sign in here</Link></p>
        <p className="login-switch"><Link to="/role-selection">Back to role selection</Link></p>
      </form>
    </div>
  )
}
