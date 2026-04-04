import { useState, useCallback } from 'react'

interface AuthState {
  token: string | null
  username: string | null
}

function loadAuth(): AuthState {
  try {
    const token = localStorage.getItem('pf_token')
    const username = localStorage.getItem('pf_username')
    if (token && username) return { token, username }
  } catch {}
  return { token: null, username: null }
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(loadAuth)

  const login = useCallback((token: string, username: string) => {
    localStorage.setItem('pf_token', token)
    localStorage.setItem('pf_username', username)
    setAuth({ token, username })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('pf_token')
    localStorage.removeItem('pf_username')
    setAuth({ token: null, username: null })
  }, [])

  // Authenticated fetch — injects Authorization header automatically
  const apiFetch = useCallback((input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {})
    if (auth.token) headers.set('Authorization', `Bearer ${auth.token}`)
    return fetch(input, { ...init, headers })
  }, [auth.token])

  return { ...auth, isLoggedIn: !!auth.token, login, logout, apiFetch }
}
