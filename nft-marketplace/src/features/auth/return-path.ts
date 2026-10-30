export function safeReturnPath(value: string | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value === '/login' || value === '/register') return '/'
  return value
}
