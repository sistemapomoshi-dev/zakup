import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import { useApi } from '@/lib/use-api'
import { useAuth } from '@/lib/use-auth'
import type { EmailDraftDto, EmailDraftStatusDto } from '@web-app-demo/contracts'

const statusLabels: Record<EmailDraftStatusDto, string> = {
  draft: 'черновик',
  pending_review: 'на согласовании',
  approved: 'одобрен',
  rejected: 'отклонён',
  sent: 'отправлен',
}

function DraftDetail({
  draft,
  onClose,
}: {
  draft: EmailDraftDto
  onClose: () => void
}) {
  const api = useApi()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [subject, setSubject] = useState(draft.subject)
  const [bodyText, setBodyText] = useState(draft.bodyText)
  const [rejectReason, setRejectReason] = useState('')

  const detailQuery = useQuery({
    queryKey: ['draft', draft.id],
    queryFn: () => api.getDraft(draft.id),
    initialData: undefined,
  })

  const current = detailQuery.data ?? draft
  const role = auth.user?.role

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['drafts'] })
    await queryClient.invalidateQueries({ queryKey: ['draft', draft.id] })
  }

  const updateMutation = useMutation({
    mutationFn: () => api.updateDraft(draft.id, { subject, bodyText }),
    onSuccess: async () => {
      await invalidate()
    },
  })

  const submitMutation = useMutation({
    mutationFn: () => api.submitDraft(draft.id),
    onSuccess: invalidate,
  })

  const approveMutation = useMutation({
    mutationFn: () => api.approveDraft(draft.id),
    onSuccess: invalidate,
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.rejectDraft(draft.id, { reason: rejectReason }),
    onSuccess: invalidate,
  })

  const sendMutation = useMutation({
    mutationFn: () => api.sendDraft(draft.id),
    onSuccess: invalidate,
  })

  const regenerateMutation = useMutation({
    mutationFn: () => api.regenerateDraft(draft.id),
    onSuccess: async (data) => {
      setSubject(data.subject)
      setBodyText(data.bodyText)
      await invalidate()
    },
  })

  const canEdit = role === 'manager' || role === 'admin'
  const canApprove = role === 'approver' || role === 'admin'

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>{current.subject}</CardTitle>
          <Typography variant="bodySm" tone="muted">
            {current.supplierName} · {statusLabels[current.status]}
          </Typography>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Закрыть
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge>{statusLabels[current.status]}</Badge>
          {current.rejectedReason && (
            <Typography variant="bodySm" tone="muted">
              Причина отклонения: {current.rejectedReason}
            </Typography>
          )}
        </div>

        {(current.status === 'draft' || current.status === 'rejected') && canEdit && (
          <>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
            <Textarea
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              rows={12}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
              >
                Сохранить
              </Button>
              <Button
                variant="outline"
                disabled={regenerateMutation.isPending}
                onClick={() => regenerateMutation.mutate()}
              >
                Перегенерировать AI
              </Button>
              <Button disabled={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
                На согласование
              </Button>
            </div>
          </>
        )}

        {current.status !== 'draft' && current.status !== 'rejected' && (
          <Typography className="whitespace-pre-wrap">{current.bodyText}</Typography>
        )}

        {current.status === 'pending_review' && canApprove && (
          <div className="grid gap-2">
            <Textarea
              placeholder="Причина отклонения"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
                Одобрить
              </Button>
              <Button
                variant="destructive"
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()}
              >
                Отклонить
              </Button>
            </div>
          </div>
        )}

        {current.status === 'approved' && canEdit && (
          <Button disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
            Отправить поставщику
          </Button>
        )}

        {current.threadId && (
          <Button asChild variant="outline" size="sm">
            <Link to="/suppliers/$supplierId/mail" params={{ supplierId: current.supplierId }}>
              Переписка
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function DraftsPage() {
  const api = useApi()
  const auth = useAuth()
  const [selectedDraft, setSelectedDraft] = useState<EmailDraftDto | null>(null)
  const [statusFilter, setStatusFilter] = useState<EmailDraftStatusDto | 'all'>('all')

  const draftsQuery = useQuery({
    queryKey: ['drafts', statusFilter],
    queryFn: () =>
      api.listDrafts(statusFilter === 'all' ? undefined : { status: statusFilter }),
    enabled: auth.isAuthenticated,
  })

  if (auth.isBootstrapping) return <Spinner />

  if (!auth.user) {
    return (
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-16">
        <Typography variant="h1">Войдите для просмотра черновиков</Typography>
        <Button asChild>
          <Link to="/">На страницу входа</Link>
        </Button>
      </section>
    )
  }

  const filters: Array<EmailDraftStatusDto | 'all'> = [
    'all',
    'draft',
    'pending_review',
    'approved',
    'rejected',
    'sent',
  ]

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <Typography variant="h1">Черновики</Typography>
        <Badge variant="outline">{auth.user.role}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Button
            key={filter}
            size="sm"
            variant={statusFilter === filter ? 'default' : 'outline'}
            onClick={() => setStatusFilter(filter)}
          >
            {filter === 'all' ? 'все' : statusLabels[filter]}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Очередь</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {draftsQuery.isLoading && <Spinner />}
            {draftsQuery.data?.items.length === 0 && (
              <Typography tone="muted">Черновиков пока нет.</Typography>
            )}
            {draftsQuery.data?.items.map((draft) => (
              <button
                key={draft.id}
                type="button"
                className={`rounded-lg border p-3 text-left transition hover:bg-muted ${
                  selectedDraft?.id === draft.id ? 'border-primary bg-muted' : ''
                }`}
                onClick={() => setSelectedDraft(draft)}
              >
                <Typography variant="emphasis">{draft.subject}</Typography>
                <Typography variant="bodySm" tone="muted">
                  {draft.supplierName} · {statusLabels[draft.status]}
                </Typography>
              </button>
            ))}
          </CardContent>
        </Card>

        {selectedDraft ? (
          <DraftDetail draft={selectedDraft} onClose={() => setSelectedDraft(null)} />
        ) : (
          <Card>
            <CardContent className="py-10">
              <Typography tone="muted">Выберите черновик слева</Typography>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}
