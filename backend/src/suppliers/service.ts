import type {
  CreateSupplierPayload,
  SupplierDto,
  UpdateSupplierPayload,
  UserDto,
  UserRole,
} from '@web-app-demo/contracts'

import type { DbClient } from '../db'
import { AppError } from '../http/errors'
import { Prisma } from '../generated/prisma/client'
import { ensureSupplierContact } from '../mail/linking'

type SupplierRecord = {
  id: string
  name: string
  email: string | null
  status: 'active' | 'inactive'
  moyskladCounterpartyId: string | null
  assignedManagerId: string | null
  createdAt: Date
  updatedAt: Date
}

export class SupplierService {
  constructor(private readonly db: DbClient) {}

  async list(actor: UserDto): Promise<SupplierDto[]> {
    const where = actor.role === 'admin' ? {} : { assignedManagerId: actor.id }
    const rows = await this.db.supplier.findMany({ where, orderBy: { name: 'asc' } })
    return rows.map(toSupplierDto)
  }

  async getById(id: string, actor: UserDto): Promise<SupplierDto> {
    const supplier = await this.findAccessible(id, actor)
    return toSupplierDto(supplier)
  }

  async create(input: CreateSupplierPayload, actor: UserDto): Promise<SupplierDto> {
    const assignedManagerId = input.assignedManagerId ?? actor.id
    const row = await this.db.supplier.create({
      data: {
        name: input.name,
        email: input.email ?? null,
        status: input.status ?? 'active',
        moyskladCounterpartyId: input.moyskladCounterpartyId ?? null,
        assignedManagerId,
        assignments: {
          create: { managerId: assignedManagerId },
        },
      },
    })
    if (row.email) {
      await ensureSupplierContact(this.db, row.id, row.email, true)
    }
    return toSupplierDto(row)
  }

  async update(id: string, input: UpdateSupplierPayload, actor: UserDto): Promise<SupplierDto> {
    await this.findAccessible(id, actor)
    try {
      const row = await this.db.supplier.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.email !== undefined ? { email: input.email ?? null } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.moyskladCounterpartyId !== undefined
            ? { moyskladCounterpartyId: input.moyskladCounterpartyId ?? null }
            : {}),
          ...(input.assignedManagerId !== undefined
            ? { assignedManagerId: input.assignedManagerId ?? null }
            : {}),
        },
      })
      if (row.email) {
        await ensureSupplierContact(this.db, row.id, row.email, true)
      }
      return toSupplierDto(row)
    } catch (error) {
      if (isNotFound(error)) throw new AppError(404, 'NOT_FOUND', 'Supplier not found')
      throw error
    }
  }

  async remove(id: string, actor: UserDto) {
    await this.findAccessible(id, actor)
    try {
      await this.db.supplier.delete({ where: { id } })
    } catch (error) {
      if (isNotFound(error)) throw new AppError(404, 'NOT_FOUND', 'Supplier not found')
      throw error
    }
  }

  private async findAccessible(id: string, actor: UserDto) {
    const supplier = await this.db.supplier.findUnique({ where: { id } })
    if (!supplier) throw new AppError(404, 'NOT_FOUND', 'Supplier not found')
    if (actor.role !== 'admin' && supplier.assignedManagerId !== actor.id) {
      throw new AppError(403, 'FORBIDDEN', 'Supplier is assigned to another manager')
    }
    return supplier
  }
}

function isNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

function toSupplierDto(supplier: SupplierRecord): SupplierDto {
  return {
    id: supplier.id,
    name: supplier.name,
    email: supplier.email,
    status: supplier.status,
    moyskladCounterpartyId: supplier.moyskladCounterpartyId,
    assignedManagerId: supplier.assignedManagerId,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  }
}

export function assertSupplierWriteRole(role: UserRole) {
  if (role !== 'manager' && role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions')
  }
}

export function assertSupplierDeleteRole(role: UserRole) {
  if (role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Only admin can delete suppliers')
  }
}
