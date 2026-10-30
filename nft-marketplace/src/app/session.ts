import { QueryClient } from '@tanstack/react-query'
import { sessionSchema, type Session } from '@/domain/contracts'
import { apiClient } from '@/lib/http/api-client'

export const sessionQueryKey = ['auth', 'session'] as const

export async function fetchSession(): Promise<Session> {
  const response = await apiClient.get('/auth/session')
  return sessionSchema.parse(response.data)
}

export function getSession(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
    staleTime: 30_000,
    retry: false,
  })
}

export function isAuthenticated(session: Session | undefined) {
  return session?.authenticated === true && session.user !== null
}
