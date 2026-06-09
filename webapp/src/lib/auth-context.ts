import { createContext } from 'react'
import type { LoginRequest, RegisterRequest, UserDto } from '@web-app-demo/contracts'

import type { ApiClient } from './api'

export type AuthContextValue = {
  user: UserDto | null
  isBootstrapping: boolean
  isAuthenticated: boolean
  register: (input: RegisterRequest) => Promise<void>
  login: (input: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  api: ApiClient
}

export const AuthContext = createContext<AuthContextValue | null>(null)
