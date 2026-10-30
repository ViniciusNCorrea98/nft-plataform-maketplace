import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { router } from './router'

export function AppProviders({ queryClient, children }: { queryClient: QueryClient; children?: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children ?? <RouterProvider router={router} context={{ queryClient }} />}
    </QueryClientProvider>
  )
}
