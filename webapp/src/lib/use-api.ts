import { useAuth } from './use-auth'

export function useApi() {
  const auth = useAuth()
  return auth.api
}
