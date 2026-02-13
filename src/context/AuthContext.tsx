import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { ApiError } from '../lib/api'
import { me, type UserOut } from '../lib/auth'
import { getAccessToken } from '../lib/storage'

type AuthState = {
  user: UserOut | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const token = getAccessToken()
    if (!token) {
      setUser(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const u = await me()
      setUser(u)
    } catch (err) {
      setUser(null)
      if (err instanceof ApiError) {
        setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ''}`)
      } else {
        setError('Failed to load /auth/me')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const value = useMemo<AuthState>(() => ({ user, loading, error, refresh }), [user, loading, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
