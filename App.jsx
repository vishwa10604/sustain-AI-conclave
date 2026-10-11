import { Navigate, Route, Routes } from 'react-router-dom'
import RoleSelection from './pages/RoleSelection'
import ManagerLogin from './pages/ManagerLogin'
import DriverLogin from './pages/DriverLogin'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import RouteRecommendation from './pages/RouteRecommendation'
import Trips from './pages/Trips'
import Drivers from './pages/Drivers'
import Vehicles from './pages/Vehicles'
import DriverDashboard from './pages/DriverDashboard'
import PredictiveMaintenance from './pages/PredictiveMaintenance'
import './theme.css'

function ProtectedRoute({ role, children }) {
  const token = window.localStorage.getItem('fleetmind.token')
  const currentRole = window.localStorage.getItem('fleetmind.role')
  if (!token) return <Navigate to={role === 'DRIVER' ? '/driver-login' : '/manager-login'} replace />
  if (currentRole !== role) return <Navigate to={currentRole === 'DRIVER' ? '/driver-dashboard' : '/'} replace />
  return children
}

function ManagerPage({ children }) {
  return <ProtectedRoute role="MANAGER">{children}</ProtectedRoute>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ManagerPage><Dashboard /></ManagerPage>} />
      <Route path="/role-selection" element={<RoleSelection />} />
      <Route path="/manager-login" element={<ManagerLogin />} />
      <Route path="/driver-login" element={<DriverLogin />} />
      <Route path="/sign-up" element={<SignUp />} />
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="/monitoring" element={<Navigate to="/" replace />} />
      <Route path="/trip-assignment" element={<ManagerPage><Trips /></ManagerPage>} />
      <Route path="/vehicle-recommendation" element={<ManagerPage><Vehicles mode="recommendations" /></ManagerPage>} />
      <Route path="/route-recommendation" element={<ManagerPage><RouteRecommendation /></ManagerPage>} />
      <Route path="/vehicle-maintenance" element={<ManagerPage><Vehicles /></ManagerPage>} />
      <Route path="/predictive-maintenance" element={<ManagerPage><PredictiveMaintenance /></ManagerPage>} />
      <Route path="/driver-details" element={<ManagerPage><Drivers /></ManagerPage>} />
      <Route path="/driver-dashboard" element={<Navigate to="/driver-dashboard/assigned" replace />} />
      <Route path="/driver-dashboard/requests" element={<ProtectedRoute role="DRIVER"><DriverDashboard section="requests" /></ProtectedRoute>} />
      <Route path="/driver-dashboard/assigned" element={<ProtectedRoute role="DRIVER"><DriverDashboard section="assigned" /></ProtectedRoute>} />
      <Route path="/driver-dashboard/routes" element={<ProtectedRoute role="DRIVER"><DriverDashboard section="routes" /></ProtectedRoute>} />
      <Route path="/driver-dashboard/history" element={<ProtectedRoute role="DRIVER"><DriverDashboard section="history" /></ProtectedRoute>} />
      <Route path="/driver-dashboard/score" element={<ProtectedRoute role="DRIVER"><DriverDashboard section="score" /></ProtectedRoute>} />
      <Route path="/driver-dashboard/profile" element={<ProtectedRoute role="DRIVER"><DriverDashboard section="profile" /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
