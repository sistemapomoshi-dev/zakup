import { describe, expect, test } from 'bun:test'

import { AppError } from '../http/errors'
import { assertDraftTransition } from './workflow'

describe('assertDraftTransition', () => {
  test('allows draft to pending_review', () => {
    expect(() => assertDraftTransition('draft', 'pending_review')).not.toThrow()
  })

  test('allows pending_review to approved', () => {
    expect(() => assertDraftTransition('pending_review', 'approved')).not.toThrow()
  })

  test('allows approved to sent', () => {
    expect(() => assertDraftTransition('approved', 'sent')).not.toThrow()
  })

  test('allows rejected to pending_review after edits', () => {
    expect(() => assertDraftTransition('rejected', 'pending_review')).not.toThrow()
  })

  test('rejects draft to sent', () => {
    expect(() => assertDraftTransition('draft', 'sent')).toThrow(AppError)
  })

  test('rejects sent transitions', () => {
    expect(() => assertDraftTransition('sent', 'draft')).toThrow(AppError)
  })
})
