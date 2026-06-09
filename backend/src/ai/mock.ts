import type { AiNegotiationOutput } from './parse-response'
import type { NegotiationContext } from './context'

export function mockAiNegotiationOutput(context: NegotiationContext): AiNegotiationOutput {
  const priceLines = context.priceHighlights
    .slice(0, 5)
    .map(
      (row) =>
        `- ${row.name ?? row.sku ?? 'позиция'}: прайс ${row.parsedPrice ?? '—'} ₽, закупка ${row.ourPrice ?? '—'} ₽, розница ${row.retailMedian ?? '—'} ₽, макс. опт ${row.maxWholesale ?? '—'} ₽`,
    )
    .join('\n')

  const draftBody = [
    `Здравствуйте!`,
    ``,
    `Спасибо за ваше письмо по теме «${context.inboundSubject}».`,
    context.inboundExcerpt ? `Мы изучили ваше предложение: ${context.inboundExcerpt}` : '',
    priceLines ? `По ключевым позициям видим следующее:\n${priceLines}` : '',
    `Просим пересмотреть условия с учётом рыночной розницы и нашей целевой маржи.`,
    `Готовы обсудить объём, сроки поставки и пакетные условия.`,
    ``,
    `С уважением,`,
    context.managerName ?? 'Отдел закупок',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    analysis: `Поставщик ${context.supplierName} прислал обновление. ${
      context.priceHighlights.some((row) => row.isLowMargin)
        ? 'Есть позиции с оптом выше допустимого уровня относительно розницы.'
        : 'Цены в целом конкурентны, но есть потенциал для скидки при объёме.'
    }`,
    strategy: [
      {
        title: 'Зафиксировать базовые цены',
        description: 'Сопоставить прайс с историей закупок и розницей на маркетплейсах.',
        status: 'in_progress',
      },
      {
        title: 'Запросить скидку за объём',
        description: 'Предложить увеличение объёма в обмен на снижение цены по ключевым SKU.',
        status: 'pending',
      },
      {
        title: 'Согласовать пакетные условия',
        description: 'Объединить переговоры по нескольким позициям в один пакет.',
        status: 'pending',
      },
    ],
    nextStep: 'Отправить контрпредложение с конкретными цифрами по позициям с низкой маржой.',
    draftSubject: `Re: ${context.inboundSubject}`,
    draftBody,
  }
}
