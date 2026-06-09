import type { Context } from 'hono'
import type { UserDto, UserRole } from '@web-app-demo/contracts'

import { AppError } from '../http/errors'
import type { AuthService } from './service'

export function bearerToken(c: Context) {
  const authorization = c.req.header('authorization')
  if (!authorization?.startsWith('Bearer ')) return undefined
  return authorization.slice('Bearer '.length)
}

export async function requireUser(c: Context, auth: AuthService): Promise<UserDto> {
  const token = bearerToken(c)
  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing access token')
  }
  const { user } = await auth.getMe(token)
  return user
}

export function requireRole(user: UserDto, allowed: UserRole[]) {
  if (!allowed.includes(user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions')
  }
}
