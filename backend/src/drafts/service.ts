import type {
  EmailDraftDetailDto,
  EmailDraftDto,
  RejectDraftRequest,
  UpdateDraftRequest,
  UserDto,
} from '@web-app-demo/contracts'

import { regenerateDraftFromAi } from '../ai/pipeline'
import type { DbClient } from '../db'
import type { AppEnv } from '../env'
import type { EmailDraftStatus } from '../generated/prisma/enums'
import { AppError } from '../http/errors'
import { assertDraftTransition } from './workflow'
import { sendDraftEmail } from './send'

type DraftRecord = {
  id: string
  supplierId: string
  negotiationId: string | null
  threadId: string | null
  triggerMessageId: string | null
  mailboxUserId: string
  status: EmailDraftStatus
  subject: string
  approvedById: string | null
  approvedAt: Date | null
  rejectedReason: string | null
  sentAt: Date | null
  sentMessageId: string | null
  createdAt: Date
  updatedAt: Date
  supplier: { name: string; email: string | null; assignedManagerId: string | null }
  versions: Array<{
    id: string
    version: number
    bodyText: string
    source: 'ai' | 'user'
    createdById: string | null
    createdAt: Date
  }>
}

export class DraftService {
  constructor(
    private readonly db: DbClient,
    private readonly env: AppEnv,
  ) {}

  async list(
    actor: UserDto,
    filters: { status?: EmailDraftStatus; supplierId?: string },
  ): Promise<EmailDraftDto[]> {
    const where = buildDraftListWhere(actor, filters)
    const rows = await this.db.emailDraft.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        supplier: { select: { name: true, email: true, assignedManagerId: true } },
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    })
    return rows.map(toDraftDto)
  }

  async getById(actor: UserDto, draftId: string): Promise<EmailDraftDetailDto> {
    const draft = await this.findAccessibleDraft(actor, draftId)
    return toDraftDetailDto(draft)
  }

  async update(actor: UserDto, draftId: string, input: UpdateDraftRequest) {
    const draft = await this.findAccessibleDraft(actor, draftId)
    assertManagerWrite(actor, draft)
    if (draft.status !== 'draft' && draft.status !== 'rejected') {
      throw new AppError(409, 'CONFLICT', 'Only draft or rejected items can be edited')
    }

    const nextVersion = (draft.versions[0]?.version ?? 0) + 1
    const updated = await this.db.$transaction(async (tx) => {
      await tx.draftVersion.create({
        data: {
          draftId,
          version: nextVersion,
          bodyText: input.bodyText,
          source: 'user',
          createdById: actor.id,
        },
      })
      return tx.emailDraft.update({
        where: { id: draftId },
        data: {
          ...(input.subject ? { subject: input.subject } : {}),
          status: 'draft',
          rejectedReason: null,
          approvedById: null,
          approvedAt: null,
        },
        include: {
          supplier: { select: { name: true, email: true, assignedManagerId: true } },
          versions: { orderBy: { version: 'desc' } },
        },
      })
    })

    return toDraftDetailDto(updated)
  }

  async submit(actor: UserDto, draftId: string) {
    return this.transition(actor, draftId, 'pending_review')
  }

  async approve(actor: UserDto, draftId: string) {
    assertApproverRole(actor)
    const draft = await this.findAccessibleDraft(actor, draftId)
    assertDraftTransition(draft.status, 'approved')
    const updated = await this.db.emailDraft.update({
      where: { id: draftId },
      data: {
        status: 'approved',
        approvedById: actor.id,
        approvedAt: new Date(),
        rejectedReason: null,
      },
      include: {
        supplier: { select: { name: true, email: true, assignedManagerId: true } },
        versions: { orderBy: { version: 'desc' } },
      },
    })
    return toDraftDetailDto(updated)
  }

  async reject(actor: UserDto, draftId: string, input: RejectDraftRequest) {
    assertApproverRole(actor)
    const draft = await this.findAccessibleDraft(actor, draftId)
    assertDraftTransition(draft.status, 'rejected')
    const updated = await this.db.emailDraft.update({
      where: { id: draftId },
      data: {
        status: 'rejected',
        rejectedReason: input.reason,
        approvedById: null,
        approvedAt: null,
      },
      include: {
        supplier: { select: { name: true, email: true, assignedManagerId: true } },
        versions: { orderBy: { version: 'desc' } },
      },
    })
    return toDraftDetailDto(updated)
  }

  async send(actor: UserDto, draftId: string) {
    const draft = await this.findAccessibleDraft(actor, draftId)
    assertManagerWrite(actor, draft)
    assertDraftTransition(draft.status, 'sent')

    const supplierEmail = draft.supplier.email
    if (!supplierEmail) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Supplier email is not configured')
    }

    const mailbox = await this.db.mailboxConnection.findUnique({
      where: { userId: draft.mailboxUserId },
    })
    if (!mailbox) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Mailbox is not configured for this draft')
    }

    const latest = draft.versions[0]
    if (!latest) {
      throw new AppError(409, 'CONFLICT', 'Draft has no content')
    }

    const triggerMessage = draft.triggerMessageId
      ? await this.db.emailMessage.findUnique({
          where: { id: draft.triggerMessageId },
          select: { messageId: true },
        })
      : null

    const sent = await sendDraftEmail(mailbox, this.env.JWT_SECRET, {
      to: supplierEmail,
      subject: draft.subject,
      bodyText: latest.bodyText,
      inReplyTo: triggerMessage?.messageId ?? null,
    })

    const updated = await this.db.emailDraft.update({
      where: { id: draftId },
      data: {
        status: 'sent',
        sentAt: sent.sentAt,
        sentMessageId: sent.messageId,
      },
      include: {
        supplier: { select: { name: true, email: true, assignedManagerId: true } },
        versions: { orderBy: { version: 'desc' } },
      },
    })

    return toDraftDetailDto(updated)
  }

  async regenerate(actor: UserDto, draftId: string) {
    const draft = await this.findAccessibleDraft(actor, draftId)
    assertManagerWrite(actor, draft)
    if (draft.status !== 'draft' && draft.status !== 'rejected') {
      throw new AppError(409, 'CONFLICT', 'Only draft or rejected items can be regenerated')
    }

    await regenerateDraftFromAi(this.db, this.env, draftId)
    return this.getById(actor, draftId)
  }

  private async transition(actor: UserDto, draftId: string, status: EmailDraftStatus) {
    const draft = await this.findAccessibleDraft(actor, draftId)
    assertManagerWrite(actor, draft)
    assertDraftTransition(draft.status, status)
    const updated = await this.db.emailDraft.update({
      where: { id: draftId },
      data: { status },
      include: {
        supplier: { select: { name: true, email: true, assignedManagerId: true } },
        versions: { orderBy: { version: 'desc' } },
      },
    })
    return toDraftDetailDto(updated)
  }

  private async findAccessibleDraft(actor: UserDto, draftId: string) {
    const draft = await this.db.emailDraft.findUnique({
      where: { id: draftId },
      include: {
        supplier: { select: { name: true, email: true, assignedManagerId: true } },
        versions: { orderBy: { version: 'desc' } },
      },
    })
    if (!draft) {
      throw new AppError(404, 'NOT_FOUND', 'Draft not found')
    }
    if (!canAccessDraft(actor, draft)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions')
    }
    return draft
  }
}

function buildDraftListWhere(
  actor: UserDto,
  filters: { status?: EmailDraftStatus; supplierId?: string },
) {
  const where: {
    status?: EmailDraftStatus
    supplierId?: string
    supplier?: { assignedManagerId: string }
  } = {}

  if (filters.status) where.status = filters.status
  if (filters.supplierId) where.supplierId = filters.supplierId

  if (actor.role === 'manager') {
    where.supplier = { assignedManagerId: actor.id }
  } else if (actor.role === 'approver' && !filters.status) {
    where.status = 'pending_review'
  }

  return where
}

function canAccessDraft(
  actor: UserDto,
  draft: { supplier: { assignedManagerId: string | null }; status: EmailDraftStatus },
) {
  if (actor.role === 'admin' || actor.role === 'approver') return true
  return draft.supplier.assignedManagerId === actor.id
}

function assertManagerWrite(
  actor: UserDto,
  draft: { supplier: { assignedManagerId: string | null } },
) {
  if (actor.role === 'admin') return
  if (actor.role !== 'manager') {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions')
  }
  if (draft.supplier.assignedManagerId !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'Draft belongs to another manager')
  }
}

function assertApproverRole(actor: UserDto) {
  if (actor.role !== 'approver' && actor.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Approver role required')
  }
}

function toDraftDto(draft: DraftRecord): EmailDraftDto {
  const latest = draft.versions[0]
  return {
    id: draft.id,
    supplierId: draft.supplierId,
    supplierName: draft.supplier.name,
    negotiationId: draft.negotiationId,
    threadId: draft.threadId,
    triggerMessageId: draft.triggerMessageId,
    status: draft.status,
    subject: draft.subject,
    bodyText: latest?.bodyText ?? '',
    latestVersion: latest?.version ?? 0,
    approvedById: draft.approvedById,
    approvedAt: draft.approvedAt?.toISOString() ?? null,
    rejectedReason: draft.rejectedReason,
    sentAt: draft.sentAt?.toISOString() ?? null,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  }
}

function toDraftDetailDto(draft: DraftRecord): EmailDraftDetailDto {
  const base = toDraftDto(draft)
  return {
    ...base,
    versions: draft.versions.map((version) => ({
      id: version.id,
      version: version.version,
      bodyText: version.bodyText,
      source: version.source,
      createdById: version.createdById,
      createdAt: version.createdAt.toISOString(),
    })),
  }
}
