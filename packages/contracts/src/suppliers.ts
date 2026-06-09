import { z } from 'zod'

import { emailSchema } from './auth'

export const supplierStatusSchema = z.enum(['active', 'inactive'])

export const supplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: emailSchema.nullable(),
  status: supplierStatusSchema,
  moyskladCounterpartyId: z.string().nullable(),
  assignedManagerId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const createSupplierRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: emailSchema.optional(),
  status: supplierStatusSchema.optional(),
  moyskladCounterpartyId: z.string().trim().min(1).optional(),
  assignedManagerId: z.string().uuid().optional(),
})

export const updateSupplierRequestSchema = createSupplierRequestSchema.partial()

export const supplierListResponseSchema = z.object({
  items: z.array(supplierSchema),
})

export const supplierIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export type SupplierDto = z.infer<typeof supplierSchema>
export type SupplierStatus = z.infer<typeof supplierStatusSchema>
export type CreateSupplierRequest = z.input<typeof createSupplierRequestSchema>
export type CreateSupplierPayload = z.output<typeof createSupplierRequestSchema>
export type UpdateSupplierRequest = z.input<typeof updateSupplierRequestSchema>
export type UpdateSupplierPayload = z.output<typeof updateSupplierRequestSchema>
export type SupplierListResponse = z.infer<typeof supplierListResponseSchema>
