import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

type Props = {
  roles: string[]
}

export default function RequireRole({ roles }: Props) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === 'SUPER_ADMIN') {
    return <Outlet />
  }

  if (!roles.includes(user.role)) {
    return <div>Not authorized.</div>
  }

  return <Outlet />
}
