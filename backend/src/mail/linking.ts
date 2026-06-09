import type { DbClient } from '../db'

export function extractEmailAddress(raw: string) {
  const match = raw.match(/<([^>]+)>/)
  const candidate = (match?.[1] ?? raw).trim().toLowerCase()
  return candidate
}

export function extractDomain(email: string) {
  const at = email.lastIndexOf('@')
  if (at === -1) return null
  return email.slice(at + 1).toLowerCase()
}

export async function findSupplierForEmail(db: DbClient, managerId: string, fromEmail: string) {
  const email = extractEmailAddress(fromEmail)

  const byContact = await db.supplierContact.findFirst({
    where: {
      email,
      supplier: { assignedManagerId: managerId },
    },
    select: { supplierId: true },
  })
  if (byContact) return byContact.supplierId

  const supplier = await db.supplier.findFirst({
    where: {
      assignedManagerId: managerId,
      email,
    },
    select: { id: true },
  })
  if (supplier) return supplier.id

  const domain = extractDomain(email)
  if (!domain) return null

  const byDomain = await db.supplierContact.findFirst({
    where: {
      domain,
      supplier: { assignedManagerId: managerId },
    },
    select: { supplierId: true },
  })
  return byDomain?.supplierId ?? null
}

export async function ensureSupplierContact(
  db: DbClient,
  supplierId: string,
  email: string,
  isPrimary = false,
) {
  const normalized = extractEmailAddress(email)
  const domain = extractDomain(normalized)
  await db.supplierContact.upsert({
    where: {
      supplierId_email: { supplierId, email: normalized },
    },
    create: { supplierId, email: normalized, domain, isPrimary },
    update: { domain, isPrimary: isPrimary || undefined },
  })
}

export function buildThreadKey(messageId: string, inReplyTo: string | null | undefined, subject: string) {
  const root = inReplyTo?.trim() || messageId.trim()
  if (root) return root.toLowerCase()
  return `subject:${subject.trim().toLowerCase().slice(0, 200)}`
}
