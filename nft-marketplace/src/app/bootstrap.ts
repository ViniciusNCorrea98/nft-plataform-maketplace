type WorkerStarter = () => Promise<unknown>

export async function initializeMocks(
  isBrowser = typeof window !== 'undefined',
  startWorker?: WorkerStarter,
) {
  if (!isBrowser) return false

  const start = startWorker ?? (async () => {
    const { worker } = await import('@/mocks/browser')
    return worker.start({ onUnhandledRequest: 'error' })
  })

  await start()
  return true
}
