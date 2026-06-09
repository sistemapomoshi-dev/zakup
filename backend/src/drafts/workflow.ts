import type { EmailDraftStatusDto } from '@web-app-demo/contracts'

import type { EmailDraftStatus } from '../generated/prisma/enums'
import { AppError } from '../http/errors'

const transitions: Record<EmailDraftStatus, EmailDraftStatusDto[]> = {
  draft: ['pending_review'],
  pending_review: ['approved', 'rejected'],
  approved: ['sent'],
  rejected: ['draft', 'pending_review'],
  sent: [],
}

export function assertDraftTransition(from: EmailDraftStatus, to: EmailDraftStatusDto) {
  if (!transitions[from].includes(to)) {
    throw new AppError(409, 'CONFLICT', `Invalid draft transition: ${from} -> ${to}`)
  }
}
