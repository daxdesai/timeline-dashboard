import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getStoredToken,
  setStoredToken,
  setUnauthorizedHandler,
  UnauthorizedError,
} from '../api/client'
import { fetchMe, login as loginRequest, logout as logoutRequest } from '../api/endpoints'
import type { User } from '../api/types'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isBootstrapping: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  const handleUnauthorized = useCallback(() => {
    setUser(null)
    setStoredToken(null)
    navigate('/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized)
    return () => setUnauthorizedHandler(null)
  }, [handleUnauthorized])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const token = getStoredToken()
      if (!token) {
        setIsBootstrapping(false)
        return
      }

      try {
        const profile = await fetchMe()
        if (!cancelled) {
          setUser(profile)
        }
      } catch {
        if (!cancelled) {
          setStoredToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false)
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      const response = await loginRequest(username, password)
      setStoredToken(response.access_token)
      try {
        const profile = await fetchMe()
        setUser(profile)
        navigate('/', { replace: true })
      } catch (error) {
        setStoredToken(null)
        throw error
      }
    },
    [navigate],
  )

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) {
        console.warn('Logout request failed', error)
      }
    } finally {
      setStoredToken(null)
      setUser(null)
      navigate('/login', { replace: true })
    }
  }, [navigate])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      login,
      logout,
    }),
    [user, isBootstrapping, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
