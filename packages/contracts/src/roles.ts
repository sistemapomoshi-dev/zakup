import { z } from 'zod'

export const userRoleSchema = z.enum(['manager', 'approver', 'admin'])

export type UserRole = z.infer<typeof userRoleSchema>
