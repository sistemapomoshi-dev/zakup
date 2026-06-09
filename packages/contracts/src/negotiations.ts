import { z } from 'zod'

export const negotiationStatusSchema = z.enum(['active', 'closed'])

export const negotiationItemScopeSchema = z.enum(['supplier', 'category', 'sku'])

export const strategyStepSchema = z.object({
  title: z.string(),
  description: z.string(),
  status: z.enum(['pending', 'in_progress', 'done']).default('pending'),
})

export const negotiationItemSchema = z.object({
  id: z.string().uuid(),
  scope: negotiationItemScopeSchema,
  sku: z.string().nullable(),
  category: z.string().nullable(),
  notes: z.string().nullable(),
  targetPrice: z.number().nullable(),
})

export const negotiationStrategySchema = z.object({
  supplierAnalysis: z.string().nullable(),
  strategyPlan: z.array(strategyStepSchema),
  nextStep: z.string().nullable(),
  lastMessageId: z.string().uuid().nullable(),
  updatedAt: z.string().datetime(),
})

export const negotiationSchema = z.object({
  id: z.string().uuid(),
  supplierId: z.string().uuid(),
  supplierName: z.string(),
  status: negotiationStatusSchema,
  title: z.string().nullable(),
  strategy: negotiationStrategySchema.nullable(),
  items: z.array(negotiationItemSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const negotiationSupplierParamsSchema = z.object({
  supplierId: z.string().uuid(),
})

export const aiStatusSchema = z.object({
  configured: z.boolean(),
  autoAnalyze: z.boolean(),
  model: z.string(),
})

export type NegotiationDto = z.infer<typeof negotiationSchema>
export type StrategyStepDto = z.infer<typeof strategyStepSchema>
export type AiStatusDto = z.infer<typeof aiStatusSchema>
