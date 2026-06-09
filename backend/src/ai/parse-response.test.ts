import { describe, expect, test } from 'bun:test'

import { parseAiNegotiationOutput } from './parse-response'

describe('parseAiNegotiationOutput', () => {
  test('parses fenced JSON', () => {
    const result = parseAiNegotiationOutput(`
\`\`\`json
{
  "analysis": "Поставщик уступил по 2 SKU",
  "strategy": [{"title":"Шаг 1","description":"Запросить скидку","status":"pending"}],
  "nextStep": "Отправить контрпредложение",
  "draftSubject": "Re: Прайс",
  "draftBody": "Здравствуйте!"
}
\`\`\`
`)

    expect(result.analysis).toContain('уступил')
    expect(result.strategy).toHaveLength(1)
    expect(result.draftSubject).toBe('Re: Прайс')
    expect(result.draftBody).toBe('Здравствуйте!')
  })
})
