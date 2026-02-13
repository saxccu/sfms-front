import { Navigate, Outlet } from 'react-router-dom'

import { getAccessToken } from '../lib/storage'

export default function ProtectedRoute() {
  const token = getAccessToken()
  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
