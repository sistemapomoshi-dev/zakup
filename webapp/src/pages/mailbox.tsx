import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Typography } from '@/components/ui/typography'
import { useApi } from '@/lib/use-api'
import { useAuth } from '@/lib/use-auth'

export function MailboxPage() {
  const api = useApi()
  const auth = useAuth()
  const queryClient = useQueryClient()

  const mailboxQuery = useQuery({
    queryKey: ['mailbox'],
    queryFn: () => api.getMailbox(),
    enabled: auth.isAuthenticated,
  })

  const [form, setForm] = useState({
    imapHost: 'imap.yandex.ru',
    imapPort: '993',
    imapSecure: true,
    smtpHost: 'smtp.yandex.ru',
    smtpPort: '587',
    smtpSecure: true,
    email: '',
    login: '',
    password: '',
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      api.saveMailbox({
        imapHost: form.imapHost,
        imapPort: Number(form.imapPort),
        imapSecure: form.imapSecure,
        smtpHost: form.smtpHost,
        smtpPort: Number(form.smtpPort),
        smtpSecure: form.smtpSecure,
        email: form.email,
        login: form.login,
        password: form.password,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mailbox'] })
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => api.syncMailbox(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mailbox'] })
      await queryClient.invalidateQueries({ queryKey: ['mail-threads'] })
    },
  })

  if (auth.isBootstrapping) {
    return <Spinner />
  }

  if (!auth.user) {
    return (
      <section className="mx-auto grid w-full max-w-3xl gap-4 px-5 py-16">
        <Typography variant="h1">Войдите для настройки почты</Typography>
        <Button asChild>
          <Link to="/">На страницу входа</Link>
        </Button>
      </section>
    )
  }

  const mailbox = mailboxQuery.data

  return (
    <section className="mx-auto grid w-full max-w-3xl gap-6 px-5 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <Typography variant="h1">Настройки почты</Typography>
        {mailbox && <Badge variant="outline">{mailbox.syncStatus}</Badge>}
      </div>

      {mailbox && (
        <Card>
          <CardHeader>
            <CardTitle>Текущий ящик</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <div>{mailbox.email}</div>
            <div>IMAP: {mailbox.imapHost}:{mailbox.imapPort}</div>
            <div>Последняя синхронизация: {mailbox.lastSyncAt ? new Date(mailbox.lastSyncAt).toLocaleString() : '—'}</div>
            {mailbox.lastSyncError && <div className="text-destructive">{mailbox.lastSyncError}</div>}
            <Button
              type="button"
              className="mt-2 w-fit"
              disabled={syncMutation.isPending || mailbox.syncStatus === 'syncing'}
              onClick={() => syncMutation.mutate()}
            >
              {syncMutation.isPending ? 'Синхронизация...' : 'Синхронизировать сейчас'}
            </Button>
            {syncMutation.data && (
              <Typography variant="bodySm" tone="muted">
                Импортировано: {syncMutation.data.imported}, пропущено: {syncMutation.data.skipped}, привязано:{' '}
                {syncMutation.data.linked}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{mailbox ? 'Обновить подключение' : 'Подключить ящик'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="login">Логин IMAP</Label>
            <Input
              id="login"
              value={form.login}
              onChange={(e) => setForm((prev) => ({ ...prev, login: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Пароль / app-password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="imapHost">IMAP host</Label>
              <Input
                id="imapHost"
                value={form.imapHost}
                onChange={(e) => setForm((prev) => ({ ...prev, imapHost: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="smtpHost">SMTP host</Label>
              <Input
                id="smtpHost"
                value={form.smtpHost}
                onChange={(e) => setForm((prev) => ({ ...prev, smtpHost: e.target.value }))}
              />
            </div>
          </div>
          <Button
            type="button"
            disabled={saveMutation.isPending || !form.email || !form.login || !form.password}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}
