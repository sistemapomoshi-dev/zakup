import { describe, expect, test } from 'bun:test'

import type { DbClient } from '../db'
import { buildThreadKey, extractDomain, extractEmailAddress, findSupplierForEmail } from './linking'

type SupplierFixture = {
  id: string
  assignedManagerId: string
  email: string | null
  contacts: Array<{
    email: string
    domain: string | null
  }>
}

function createDb(suppliers: SupplierFixture[]) {
  return {
    supplierContact: {
      findFirst: async ({ where }: { where: { email?: string; domain?: string; supplier: { assignedManagerId: string } } }) => {
        const supplier = suppliers.find((candidate) => {
          if (candidate.assignedManagerId !== where.supplier.assignedManagerId) return false
          return candidate.contacts.some((contact) => {
            if (where.email) return contact.email === where.email
            if (where.domain) return contact.domain === where.domain
            return false
          })
        })
        return supplier ? { supplierId: supplier.id } : null
      },
      upsert: async () => ({}),
    },
    supplier: {
      findFirst: async ({ where }: { where: { assignedManagerId: string; email: string } }) => {
        const supplier = suppliers.find(
          (candidate) =>
            candidate.assignedManagerId === where.assignedManagerId && candidate.email === where.email,
        )
        return supplier ? { id: supplier.id } : null
      },
    },
  } as unknown as DbClient
}

describe('mail linking', () => {
  test('normalizes mailbox addresses and domains', () => {
    expect(extractEmailAddress('Sales Team <Supplier@Example.COM>')).toBe('supplier@example.com')
    expect(extractEmailAddress('SUPPLIER@EXAMPLE.COM')).toBe('supplier@example.com')
    expect(extractDomain('supplier@example.com')).toBe('example.com')
    expect(extractDomain('not-an-email')).toBeNull()
  })

  test('builds a stable thread key from reply chain headers', () => {
    expect(buildThreadKey('<message-2@example.com>', '<Message-1@Example.COM>', 'Price list')).toBe(
      '<message-1@example.com>',
    )
    expect(buildThreadKey('<Message-1@Example.COM>', null, 'Price list')).toBe('<message-1@example.com>')
  })

  test('finds assigned supplier by contact, direct email, then contact domain', async () => {
    const db = createDb([
      {
        id: 'supplier-by-contact',
        assignedManagerId: 'manager-1',
        email: null,
        contacts: [{ email: 'buyer@supplier.test', domain: 'supplier.test' }],
      },
      {
        id: 'supplier-by-email',
        assignedManagerId: 'manager-1',
        email: 'sales@direct.test',
        contacts: [],
      },
      {
        id: 'supplier-by-domain',
        assignedManagerId: 'manager-1',
        email: null,
        contacts: [{ email: 'owner@domain.test', domain: 'domain.test' }],
      },
    ])

    await expect(findSupplierForEmail(db, 'manager-1', 'Buyer <buyer@supplier.test>')).resolves.toBe(
      'supplier-by-contact',
    )
    await expect(findSupplierForEmail(db, 'manager-1', 'sales@direct.test')).resolves.toBe(
      'supplier-by-email',
    )
    await expect(findSupplierForEmail(db, 'manager-1', 'unknown@domain.test')).resolves.toBe(
      'supplier-by-domain',
    )
  })

  test('does not link mail from suppliers assigned to another manager', async () => {
    const db = createDb([
      {
        id: 'other-manager-supplier',
        assignedManagerId: 'manager-2',
        email: 'sales@supplier.test',
        contacts: [{ email: 'buyer@supplier.test', domain: 'supplier.test' }],
      },
    ])

    await expect(findSupplierForEmail(db, 'manager-1', 'buyer@supplier.test')).resolves.toBeNull()
    await expect(findSupplierForEmail(db, 'manager-1', 'sales@supplier.test')).resolves.toBeNull()
  })
})
