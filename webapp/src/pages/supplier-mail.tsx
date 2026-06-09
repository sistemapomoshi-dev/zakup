import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Typography } from '@/components/ui/typography'
import { useApi } from '@/lib/use-api'
import { useAuth } from '@/lib/use-auth'
import type { EmailAttachmentDto } from '@web-app-demo/contracts'

const parseStatusLabels: Record<EmailAttachmentDto['parseStatus'], string> = {
  pending: 'ожидает',
  parsing: 'парсинг',
  parsed: 'распознан',
  failed: 'ошибка',
  skipped: 'пропущен',
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return '—'
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
}

function formatDelta(value: number | null | undefined) {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
}

function AttachmentPanel({
  attachment,
  supplierId,
  onClose,
}: {
  attachment: EmailAttachmentDto
  supplierId: string
  onClose: () => void
}) {
  const api = useApi()
  const queryClient = useQueryClient()

  const rowsQuery = useQuery({
    queryKey: ['attachment-rows', attachment.id],
    queryFn: () => api.listAttachmentRows(attachment.id),
    enabled: attachment.parseStatus === 'parsed',
  })

  const comparisonQuery = useQuery({
    queryKey: ['attachment-comparison', attachment.id, supplierId],
    queryFn: () => api.getAttachmentComparison(attachment.id, supplierId),
    enabled: attachment.parseStatus === 'parsed',
  })

  const reparseMutation = useMutation({
    mutationFn: () => api.reparseAttachment(attachment.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mail-messages'] })
      await queryClient.invalidateQueries({ queryKey: ['attachment-rows', attachment.id] })
      await queryClient.invalidateQueries({ queryKey: ['attachment-comparison', attachment.id] })
    },
  })

  const comparisonByRowId = new Map(
    comparisonQuery.data?.items.map((row) => [row.parsedRowId, row]) ?? [],
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>{attachment.filename}</CardTitle>
          <Typography variant="bodySm" tone="muted">
            {attachment.mimeType ?? 'unknown'} · {attachment.sizeBytes ?? '—'} байт
          </Typography>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Закрыть
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={attachment.parseStatus === 'parsed' ? 'default' : 'outline'}>
            {parseStatusLabels[attachment.parseStatus]}
          </Badge>
          {attachment.rowCount > 0 && (
            <Typography variant="bodySm" tone="muted">
              Строк: {attachment.rowCount}
            </Typography>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={reparseMutation.isPending}
            onClick={() => reparseMutation.mutate()}
          >
            {reparseMutation.isPending ? 'Повтор...' : 'Повторить парсинг'}
          </Button>
        </div>

        {attachment.parseError && (
          <Typography variant="bodySm" tone="muted">
            {attachment.parseError}
          </Typography>
        )}

        {attachment.parseStatus === 'parsed' && (rowsQuery.isLoading || comparisonQuery.isLoading) && (
          <Spinner />
        )}

        {rowsQuery.data?.items.length ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Артикул</TableHead>
                  <TableHead>Наименование</TableHead>
                  <TableHead>Цена в прайсе</TableHead>
                  <TableHead>Наша закупка</TableHead>
                  <TableHead>Δ</TableHead>
                  <TableHead>Розница (медиана)</TableHead>
                  <TableHead>Наценка</TableHead>
                  <TableHead>Макс. опт</TableHead>
                  <TableHead>МойСклад</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsQuery.data.items.map((row) => {
                  const comparison = comparisonByRowId.get(row.id)
                  const deltaClass =
                    comparison?.priceDelta != null && comparison.priceDelta > 0
                      ? 'text-destructive'
                      : comparison?.priceDelta != null && comparison.priceDelta < 0
                        ? 'text-green-600'
                        : undefined
                  const retailClass = comparison?.retail?.isLowMargin ? 'text-destructive' : undefined

                  return (
                    <TableRow key={row.id} className={comparison?.retail?.isLowMargin ? 'bg-destructive/5' : undefined}>
                      <TableCell>{row.sku ?? '—'}</TableCell>
                      <TableCell>{row.name ?? '—'}</TableCell>
                      <TableCell>{formatMoney(row.price)}</TableCell>
                      <TableCell>{formatMoney(comparison?.ourLastPurchasePrice)}</TableCell>
                      <TableCell className={deltaClass}>
                        {formatDelta(comparison?.priceDelta ?? null)}
                        {comparison?.priceDeltaPercent != null && (
                          <Typography variant="bodySm" tone="muted" className="block">
                            {comparison.priceDeltaPercent > 0 ? '+' : ''}
                            {comparison.priceDeltaPercent.toFixed(1)}%
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell className={retailClass}>
                        {formatMoney(comparison?.retail?.medianPrice)}
                        {comparison?.retail?.snapshots.length ? (
                          <Typography variant="bodySm" tone="muted" className="block">
                            {comparison.retail.snapshots.map((snapshot) => snapshot.marketplace).join(', ')}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell className={retailClass}>
                        {comparison?.retail?.markupPercent != null
                          ? `${comparison.retail.markupPercent.toFixed(1)}%`
                          : '—'}
                        {comparison?.retail?.marginPercent != null && (
                          <Typography variant="bodySm" tone="muted" className="block">
                            маржа {comparison.retail.marginPercent.toFixed(1)}%
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell className={retailClass}>
                        {formatMoney(comparison?.retail?.maxWholesaleAtTargetMargin)}
                        {comparison?.retail?.targetMarginPercent != null && (
                          <Typography variant="bodySm" tone="muted" className="block">
                            при марже {comparison.retail.targetMarginPercent}%
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {comparison?.matchedProduct ? (
                          <Typography variant="bodySm">
                            {comparison.matchedProduct.name}
                            {comparison.matchType && (
                              <Badge variant="outline" className="ml-2">
                                {comparison.matchType}
                              </Badge>
                            )}
                          </Typography>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {attachment.parseStatus === 'parsed' && rowsQuery.data?.items.length === 0 && (
          <Typography tone="muted">Распознанных строк нет.</Typography>
        )}
      </CardContent>
    </Card>
  )
}

export function SupplierMailPage() {
  const { supplierId } = useParams({ from: '/suppliers/$supplierId/mail' })
  const api = useApi()
  const auth = useAuth()
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedAttachment, setSelectedAttachment] = useState<EmailAttachmentDto | null>(null)

  const threadsQuery = useQuery({
    queryKey: ['mail-threads', supplierId],
    queryFn: () => api.listSupplierThreads(supplierId),
    enabled: auth.isAuthenticated && Boolean(supplierId),
  })

  const messagesQuery = useQuery({
    queryKey: ['mail-messages', selectedThreadId],
    queryFn: () => api.listThreadMessages(selectedThreadId!),
    enabled: Boolean(selectedThreadId),
  })

  if (auth.isBootstrapping) {
    return <Spinner />
  }

  if (!auth.user) {
    return (
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-16">
        <Typography variant="h1">Войдите для просмотра переписки</Typography>
        <Button asChild>
          <Link to="/">На страницу входа</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <Typography variant="h1">Переписка</Typography>
        <Button asChild variant="outline" size="sm">
          <Link to="/suppliers">← Поставщики</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/suppliers/$supplierId/negotiation" params={{ supplierId }}>
            Стратегия
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/drafts">Черновики</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/settings/mailbox">Настройки почты</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Треды</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {threadsQuery.isLoading && <Spinner />}
            {threadsQuery.data?.items.length === 0 && (
              <Typography tone="muted">Нет писем. Настройте почту и запустите синхронизацию.</Typography>
            )}
            {threadsQuery.data?.items.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`rounded-lg border p-3 text-left transition hover:bg-muted ${
                  selectedThreadId === thread.id ? 'border-primary bg-muted' : ''
                }`}
                onClick={() => {
                  setSelectedThreadId(thread.id)
                  setSelectedAttachment(null)
                }}
              >
                <Typography variant="emphasis">{thread.subject}</Typography>
                <Typography variant="bodySm" tone="muted">
                  {thread.previewFrom ?? '—'} · {new Date(thread.lastMessageAt).toLocaleString()}
                </Typography>
                <Badge variant="outline" className="mt-2">
                  {thread.linkStatus}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Сообщения</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {!selectedThreadId && <Typography tone="muted">Выберите тред слева</Typography>}
              {messagesQuery.isLoading && <Spinner />}
              {messagesQuery.data?.items.map((message) => (
                <div key={message.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <Typography variant="emphasis">
                      {message.fromName ?? message.fromEmail}
                    </Typography>
                    <Badge variant={message.direction === 'inbound' ? 'default' : 'secondary'}>
                      {message.direction}
                    </Badge>
                  </div>
                  <Typography variant="bodySm" tone="muted" className="mb-3">
                    {new Date(message.sentAt).toLocaleString()}
                  </Typography>
                  <Typography className="whitespace-pre-wrap">
                    {message.bodyText ?? '(нет текста)'}
                  </Typography>
                  {message.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.attachments.map((attachment) => (
                        <Button
                          key={attachment.id}
                          type="button"
                          variant={selectedAttachment?.id === attachment.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedAttachment(attachment)}
                        >
                          {attachment.filename}
                          <Badge variant="secondary" className="ml-2">
                            {parseStatusLabels[attachment.parseStatus]}
                          </Badge>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {selectedAttachment && (
            <AttachmentPanel
              attachment={selectedAttachment}
              supplierId={supplierId}
              onClose={() => setSelectedAttachment(null)}
            />
          )}
        </div>
      </div>
    </section>
  )
}
