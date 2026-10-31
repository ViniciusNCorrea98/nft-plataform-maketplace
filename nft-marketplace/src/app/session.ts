import { QueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { authResponseSchema, sessionSchema, type AuthResponse, type LoginRequest, type RegisterRequest, type Session } from '@/domain/contracts'
import { apiClient, restoreAuthToken, setAuthToken } from '@/lib/http/api-client'

export const sessionQueryKey = ['auth', 'session'] as const

export function initializeAuth() { restoreAuthToken() }

export async function fetchSession(): Promise<Session> {
  const response = await apiClient.get('/auth/session')
  const session = sessionSchema.parse(response.data)
  if (!session.authenticated) setAuthToken(null)
  return session
}

async function authenticate(path: '/auth/login' | '/auth/register', payload: LoginRequest | RegisterRequest): Promise<AuthResponse> {
  const response = await apiClient.post(path, payload)
  const result = authResponseSchema.parse(response.data)
  setAuthToken(result.token)
  return result
}

export function login(payload: LoginRequest) { return authenticate('/auth/login', payload) }
export function register(payload: RegisterRequest) { return authenticate('/auth/register', payload) }

export async function logout() {
  try { await apiClient.post('/auth/logout') } catch { /* local sign-out still completes if the mock is unavailable */ } finally { setAuthToken(null) }
}

export function useSession() {
  return useQuery(getSessionQuery())
}

function getSessionQuery() {
  return { queryKey: sessionQueryKey, queryFn: fetchSession, staleTime: 30_000, retry: false as const }
}

export function getSession(queryClient: QueryClient) {
  return queryClient.fetchQuery(getSessionQuery())
}

export function isAuthenticated(session: Session | undefined): session is Session & { authenticated: true; user: NonNullable<Session['user']> } {
  return session?.authenticated === true && session.user !== null
}
