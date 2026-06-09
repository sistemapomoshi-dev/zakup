import type { NegotiationDto, UserDto } from '@web-app-demo/contracts'
import type { StrategyStepDto } from '@web-app-demo/contracts'

import type { DbClient } from '../db'
import { AppError } from '../http/errors'

export class NegotiationService {
  constructor(private readonly db: DbClient) {}

  async getBySupplier(actor: UserDto, supplierId: string): Promise<NegotiationDto | null> {
    await assertSupplierAccess(this.db, actor, supplierId)

    const negotiation = await this.db.negotiation.findFirst({
      where: { supplierId, status: 'active' },
      include: {
        supplier: { select: { name: true } },
        strategy: true,
        items: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (!negotiation) return null
    return toNegotiationDto(negotiation)
  }
}

async function assertSupplierAccess(db: DbClient, actor: UserDto, supplierId: string) {
  const supplier = await db.supplier.findUnique({
    where: { id: supplierId },
    select: { assignedManagerId: true },
  })
  if (!supplier) {
    throw new AppError(404, 'NOT_FOUND', 'Supplier not found')
  }
  if (actor.role === 'admin' || actor.role === 'approver') return
  if (supplier.assignedManagerId !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions')
  }
}

function toNegotiationDto(negotiation: {
  id: string
  supplierId: string
  status: 'active' | 'closed'
  title: string | null
  createdAt: Date
  updatedAt: Date
  supplier: { name: string }
  strategy: {
    supplierAnalysis: string | null
    strategyPlan: unknown
    nextStep: string | null
    lastMessageId: string | null
    updatedAt: Date
  } | null
  items: Array<{
    id: string
    scope: 'supplier' | 'category' | 'sku'
    sku: string | null
    category: string | null
    notes: string | null
    targetPrice: unknown
  }>
}): NegotiationDto {
  return {
    id: negotiation.id,
    supplierId: negotiation.supplierId,
    supplierName: negotiation.supplier.name,
    status: negotiation.status,
    title: negotiation.title,
    strategy: negotiation.strategy
      ? {
          supplierAnalysis: negotiation.strategy.supplierAnalysis,
          strategyPlan: normalizeStrategyPlan(negotiation.strategy.strategyPlan),
          nextStep: negotiation.strategy.nextStep,
          lastMessageId: negotiation.strategy.lastMessageId,
          updatedAt: negotiation.strategy.updatedAt.toISOString(),
        }
      : null,
    items: negotiation.items.map((item) => ({
      id: item.id,
      scope: item.scope,
      sku: item.sku,
      category: item.category,
      notes: item.notes,
      targetPrice: item.targetPrice != null ? Number(item.targetPrice) : null,
    })),
    createdAt: negotiation.createdAt.toISOString(),
    updatedAt: negotiation.updatedAt.toISOString(),
  }
}

function normalizeStrategyPlan(value: unknown): StrategyStepDto[] {
  if (!Array.isArray(value)) return []
  return value
    .map((step) => {
      if (!step || typeof step !== 'object') return null
      const record = step as Record<string, unknown>
      const title = typeof record.title === 'string' ? record.title : null
      const description = typeof record.description === 'string' ? record.description : null
      if (!title || !description) return null
      const status = record.status
      const normalizedStatus =
        status === 'done' || status === 'in_progress' || status === 'pending' ? status : 'pending'
      return { title, description, status: normalizedStatus }
    })
    .filter((step): step is StrategyStepDto => step !== null)
}
