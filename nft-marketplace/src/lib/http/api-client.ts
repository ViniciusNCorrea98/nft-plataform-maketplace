import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 5_000,
  headers: { 'Content-Type': 'application/json' },
})

export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete apiClient.defaults.headers.common.Authorization
  }
}
