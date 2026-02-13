import { apiFetch } from './api'

export type TokenResponse = {
  access_token: string
  token_type: string
}

export type UserOut = {
  id: number
  name: string
  username?: string | null
  email: string
  role: string
  branch_id: number
}

export async function login(username: string, password: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>(
    '/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
    { auth: false },
  )
}

export async function me(): Promise<UserOut> {
  return apiFetch<UserOut>('/auth/me', { method: 'GET' }, { auth: true })
}
