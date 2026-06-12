import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Typography } from '@/components/ui/typography'
import { useApi } from '@/lib/use-api'
import { useAuth } from '@/lib/use-auth'

export function SuppliersPage() {
  const api = useApi()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const suppliersQuery = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.listSuppliers(),
    enabled: auth.isAuthenticated,
  })

  const moyskladStatusQuery = useQuery({
    queryKey: ['moysklad-status'],
    queryFn: () => api.getMoyskladStatus(),
    enabled: auth.isAuthenticated,
  })

  const syncMoyskladMutation = useMutation({
    mutationFn: () => api.syncMoysklad(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['moysklad-status'] })
    },
  })

  const retailStatusQuery = useQuery({
    queryKey: ['retail-status'],
    queryFn: () => api.getRetailStatus(),
    enabled: auth.isAuthenticated,
  })

  const syncRetailMutation = useMutation({
    mutationFn: () => api.syncRetail(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['retail-status'] })
    },
  })

  const createMutation = useMutation({
    mutationFn: () => api.createSupplier({ name, email: email || undefined }),
    onSuccess: async () => {
      setName('')
      setEmail('')
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })

  if (auth.isBootstrapping) {
    return (
      <section className="mx-auto w-full max-w-6xl px-5 py-16">
        <Spinner />
      </section>
    )
  }

  if (!auth.user) {
    return (
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-16">
        <Typography variant="h1">Войдите, чтобы видеть поставщиков</Typography>
        <Button asChild>
          <Link to="/">На страницу входа</Link>
        </Button>
      </section>
    )
  }

  const canCreate = auth.user.role === 'manager' || auth.user.role === 'admin'
  const canSyncMoysklad = canCreate

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <Typography variant="h1">Поставщики</Typography>
        <Badge variant="outline">{auth.user.role}</Badge>
      </div>

      {canSyncMoysklad && (
        <Card>
          <CardHeader>
            <CardTitle>Розничные цены (маркетплейсы)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {retailStatusQuery.isLoading && <Spinner />}
            {retailStatusQuery.data && (
              <>
                <Badge variant={retailStatusQuery.data.enabled ? 'default' : 'secondary'}>
                  {retailStatusQuery.data.enabled ? 'включено' : 'выключено'}
                </Badge>
                <Typography variant="bodySm" tone="muted">
                  Привязок: {retailStatusQuery.data.counts.links} · SKU с розницей:{' '}
                  {retailStatusQuery.data.counts.productsWithRetail} · целевая маржа{' '}
                  {retailStatusQuery.data.targetMarginPercent}%
                  {retailStatusQuery.data.lastFullSyncAt &&
                    ` · синк ${new Date(retailStatusQuery.data.lastFullSyncAt).toLocaleString()}`}
                </Typography>
                {retailStatusQuery.data.lastError && (
                  <Typography variant="bodySm" tone="muted">
                    Ошибка: {retailStatusQuery.data.lastError}
                  </Typography>
                )}
              </>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={!retailStatusQuery.data?.enabled || syncRetailMutation.isPending}
              onClick={() => syncRetailMutation.mutate()}
            >
              {syncRetailMutation.isPending ? 'Обновление...' : 'Обновить розничные цены'}
            </Button>
          </CardContent>
        </Card>
      )}

      {canSyncMoysklad && (
        <Card>
          <CardHeader>
            <CardTitle>МойСклад</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {moyskladStatusQuery.isLoading && <Spinner />}
            {moyskladStatusQuery.data && (
              <>
                <Badge variant={moyskladStatusQuery.data.configured ? 'default' : 'secondary'}>
                  {moyskladStatusQuery.data.configured ? 'подключён' : 'не настроен'}
                </Badge>
                {moyskladStatusQuery.data.configured && (
                  <Typography variant="bodySm" tone="muted">
                    Номенклатура: {moyskladStatusQuery.data.counts.products} · Заказы:{' '}
                    {moyskladStatusQuery.data.counts.purchaseOrders} · Файлы:{' '}
                    {moyskladStatusQuery.data.counts.files}
                    {moyskladStatusQuery.data.lastFullSyncAt &&
                      ` · синк ${new Date(moyskladStatusQuery.data.lastFullSyncAt).toLocaleString()}`}
                  </Typography>
                )}
                {moyskladStatusQuery.data.lastError && (
                  <Typography variant="bodySm" tone="muted">
                    Ошибка: {moyskladStatusQuery.data.lastError}
                  </Typography>
                )}
              </>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={!moyskladStatusQuery.data?.configured || syncMoyskladMutation.isPending}
              onClick={() => syncMoyskladMutation.mutate()}
            >
              {syncMoyskladMutation.isPending ? 'Синхронизация...' : 'Обновить из МойСклад'}
            </Button>
          </CardContent>
        </Card>
      )}

      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Добавить поставщика</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Email (опционально)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button
              type="button"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Сохранение...' : 'Добавить'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Каталог</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {suppliersQuery.isLoading && <Spinner />}
          {suppliersQuery.error && (
            <Typography tone="muted">Не удалось загрузить поставщиков</Typography>
          )}
          {suppliersQuery.data?.items.length === 0 && (
            <Typography tone="muted">Пока нет поставщиков</Typography>
          )}
          {suppliersQuery.data?.items.map((supplier) => (
            <div key={supplier.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <Typography variant="emphasis">{supplier.name}</Typography>
                <Typography variant="bodySm" tone="muted">
                  {supplier.email ?? 'без email'}
                </Typography>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/suppliers/$supplierId/mail" params={{ supplierId: supplier.id }}>
                    Переписка
                  </Link>
                </Button>
                <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'}>
                  {supplier.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
