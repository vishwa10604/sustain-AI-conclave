const API_ROOT = import.meta.env.VITE_API_BASE_URL || '/api'
const AI_API_ROOT = import.meta.env.VITE_AI_API_BASE_URL || '/ai-api'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const token = window.localStorage.getItem('fleetmind.token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_ROOT}${path}`, { ...options, headers })
  if (!response.ok) {
    const message = await response.text()
    throw new ApiError(message || `Request failed (${response.status})`, response.status)
  }

  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') || ''
  return contentType.includes('application/json') ? response.json() : response.text()
}

export async function signIn(email, password) {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return response
}

export async function signUp(details) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(details),
  })
}

export async function requestRouteAssistant(details) {
  const response = await fetch(`${AI_API_ROOT}/route-assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(details),
  })
  if (!response.ok) {
    const responseBody = await response.text()
    let message = responseBody
    try {
      const parsed = JSON.parse(responseBody)
      message = parsed.detail || parsed.message || responseBody
    } catch {
      message = responseBody
    }
    throw new ApiError(message || `Route assistant request failed (${response.status})`, response.status)
  }
  return response.json()
}
