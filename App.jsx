import { Navigate, Route, Routes } from 'react-router-dom'
import RoleSelection from './pages/RoleSelection'
import ManagerLogin from './pages/ManagerLogin'
import DriverLogin from './pages/DriverLogin'
import Dashboard from './pages/Dashboard'
import RouteRecommendation from './pages/RouteRecommendation'
import Trips from './pages/Trips'
import Drivers from './pages/Drivers'
import Vehicles from './pages/Vehicles'
import DriverDashboard from './pages/DriverDashboard'
import './theme.css'

function ProtectedRoute({ role, children }) {
  const token = window.localStorage.getItem('fleetmind.token')
  const currentRole = window.localStorage.getItem('fleetmind.role')
  if (!token) return <Navigate to={role === 'DRIVER' ? '/driver-login' : '/manager-login'} replace />
  if (currentRole !== role) return <Navigate to={currentRole === 'DRIVER' ? '/driver-dashboard' : '/dashboard'} replace />
  return children
}

function ManagerPage({ children }) {
  return <ProtectedRoute role="MANAGER">{children}</ProtectedRoute>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/role-selection" replace />} />
      <Route path="/role-selection" element={<RoleSelection />} />
      <Route path="/manager-login" element={<ManagerLogin />} />
      <Route path="/driver-login" element={<DriverLogin />} />
      <Route path="/dashboard" element={<ManagerPage><Dashboard /></ManagerPage>} />
      <Route path="/monitoring" element={<Navigate to="/dashboard" replace />} />
      <Route path="/trip-assignment" element={<ManagerPage><Trips /></ManagerPage>} />
      <Route path="/vehicle-recommendation" element={<ManagerPage><Vehicles mode="recommendations" /></ManagerPage>} />
      <Route path="/route-recommendation" element={<ManagerPage><RouteRecommendation /></ManagerPage>} />
      <Route path="/vehicle-maintenance" element={<ManagerPage><Vehicles /></ManagerPage>} />
      <Route path="/driver-details" element={<ManagerPage><Drivers /></ManagerPage>} />
      <Route path="/driver-dashboard" element={<ProtectedRoute role="DRIVER"><DriverDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
