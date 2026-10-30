import axios from 'axios'

const AUTH_TOKEN_KEY = 'nft-marketplace.auth-token'

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 5_000,
  headers: { 'Content-Type': 'application/json' },
})

export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
    if (typeof window !== 'undefined') window.localStorage.setItem(AUTH_TOKEN_KEY, token)
  } else {
    delete apiClient.defaults.headers.common.Authorization
    if (typeof window !== 'undefined') window.localStorage.removeItem(AUTH_TOKEN_KEY)
  }
}

export function restoreAuthToken() {
  if (typeof window === 'undefined') return null
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
  return token
}
