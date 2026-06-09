import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Typography } from '@/components/ui/typography'
import { useApi } from '@/lib/use-api'
import { useAuth } from '@/lib/use-auth'

export function SupplierNegotiationPage() {
  const { supplierId } = useParams({ from: '/suppliers/$supplierId/negotiation' })
  const api = useApi()
  const auth = useAuth()

  const negotiationQuery = useQuery({
    queryKey: ['negotiation', supplierId],
    queryFn: () => api.getSupplierNegotiation(supplierId),
    enabled: auth.isAuthenticated && Boolean(supplierId),
  })

  const aiStatusQuery = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.getAiStatus(),
    enabled: auth.isAuthenticated,
  })

  if (auth.isBootstrapping) return <Spinner />

  if (!auth.user) {
    return (
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-16">
        <Typography variant="h1">Войдите для просмотра стратегии</Typography>
        <Button asChild>
          <Link to="/">На страницу входа</Link>
        </Button>
      </section>
    )
  }

  const negotiation = negotiationQuery.data

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <Typography variant="h1">Стратегия переговоров</Typography>
        <Button asChild variant="outline" size="sm">
          <Link to="/suppliers">← Поставщики</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/suppliers/$supplierId/mail" params={{ supplierId }}>
            Переписка
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/drafts">Черновики</Link>
        </Button>
      </div>

      {aiStatusQuery.data && (
        <Badge variant={aiStatusQuery.data.configured ? 'default' : 'secondary'}>
          AI: {aiStatusQuery.data.configured ? 'YandexGPT' : 'mock (dev)'}
        </Badge>
      )}

      {negotiationQuery.isLoading && <Spinner />}

      {!negotiationQuery.isLoading && !negotiation && (
        <Card>
          <CardContent className="py-8">
            <Typography tone="muted">
              Стратегия появится после первого входящего письма от поставщика с привязкой к
              переписке.
            </Typography>
          </CardContent>
        </Card>
      )}

      {negotiation && (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{negotiation.title ?? negotiation.supplierName}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {negotiation.strategy?.supplierAnalysis && (
                <div>
                  <Typography variant="emphasis">Анализ ответа</Typography>
                  <Typography className="whitespace-pre-wrap">
                    {negotiation.strategy.supplierAnalysis}
                  </Typography>
                </div>
              )}
              {negotiation.strategy?.nextStep && (
                <div>
                  <Typography variant="emphasis">Следующий шаг</Typography>
                  <Typography>{negotiation.strategy.nextStep}</Typography>
                </div>
              )}
            </CardContent>
          </Card>

          {negotiation.strategy?.strategyPlan.length ? (
            <Card>
              <CardHeader>
                <CardTitle>План</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {negotiation.strategy.strategyPlan.map((step, index) => (
                  <div key={`${step.title}-${index}`} className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Typography variant="emphasis">{step.title}</Typography>
                      <Badge variant="outline">{step.status}</Badge>
                    </div>
                    <Typography variant="bodySm">{step.description}</Typography>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </section>
  )
}
