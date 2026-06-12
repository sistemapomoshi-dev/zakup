import { describe, expect, test } from 'bun:test'

import { recentThreadMessagesToPromptHistory, summarizeNegotiationStrategy } from './context'

describe('recentThreadMessagesToPromptHistory', () => {
  test('converts latest-first database rows to chronological prompt history', () => {
    const history = recentThreadMessagesToPromptHistory([
      {
        direction: 'inbound',
        fromEmail: 'supplier@example.com',
        fromName: 'Supplier',
        sentAt: new Date('2026-06-11T10:02:00.000Z'),
        bodyText: 'Последний ответ поставщика',
        subject: 'Re: Прайс',
      },
      {
        direction: 'outbound',
        fromEmail: 'manager@example.com',
        fromName: null,
        sentAt: new Date('2026-06-11T10:01:00.000Z'),
        bodyText: 'Наше контрпредложение',
        subject: 'Re: Прайс',
      },
    ])

    expect(history).toEqual([
      {
        direction: 'outbound',
        from: 'manager@example.com',
        sentAt: '2026-06-11T10:01:00.000Z',
        excerpt: 'Наше контрпредложение',
      },
      {
        direction: 'inbound',
        from: 'Supplier',
        sentAt: '2026-06-11T10:02:00.000Z',
        excerpt: 'Последний ответ поставщика',
      },
    ])
  })
})

describe('summarizeNegotiationStrategy', () => {
  test('includes analysis, strategy plan and next step for AI context', () => {
    expect(
      summarizeNegotiationStrategy({
        supplierAnalysis: 'Поставщик готов обсуждать объём.',
        strategyPlan: [
          {
            title: 'Запросить скидку',
            description: 'Сослаться на объём и рыночную розницу.',
            status: 'pending',
          },
        ],
        nextStep: 'Отправить контрпредложение по SKU с низкой маржой.',
      }),
    ).toBe(
      [
        'Анализ: Поставщик готов обсуждать объём.',
        'План:\n1. Запросить скидку: Сослаться на объём и рыночную розницу.',
        'Следующий шаг: Отправить контрпредложение по SKU с низкой маржой.',
      ].join('\n'),
    )
  })

  test('returns null for an empty strategy', () => {
    expect(summarizeNegotiationStrategy(null)).toBeNull()
    expect(
      summarizeNegotiationStrategy({
        supplierAnalysis: null,
        strategyPlan: [],
        nextStep: null,
      }),
    ).toBeNull()
  })
})
