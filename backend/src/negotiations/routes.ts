import {
  aiStatusSchema,
  apiErrorSchema,
  negotiationSchema,
  negotiationSupplierParamsSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { requireUser } from '../auth/guard'
import type { AuthService } from '../auth/service'
import type { AppEnv } from '../env'
import { isAiConfigured } from '../ai/config'
import { validationErrorHook } from '../http/errors'
import type { NegotiationService } from './service'

type NegotiationRouteEnv = {
  Variables: {
    authService: AuthService
    negotiationService: NegotiationService
    env: AppEnv
  }
}

const errorResponseContent = { 'application/json': { schema: apiErrorSchema } }

const aiStatusRoute = createRoute({
  method: 'get',
  path: '/status',
  responses: {
    200: {
      content: { 'application/json': { schema: aiStatusSchema } },
      description: 'AI integration status',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
  },
})

const supplierNegotiationRoute = createRoute({
  method: 'get',
  path: '/suppliers/{supplierId}',
  request: { params: negotiationSupplierParamsSchema },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.union([negotiationSchema, z.null()]),
        },
      },
      description: 'Supplier negotiation',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
    404: { content: errorResponseContent, description: 'Not found' },
  },
})

export function createNegotiationRoutes() {
  const routes = new OpenAPIHono<NegotiationRouteEnv>({ defaultHook: validationErrorHook })

  routes.openapi(aiStatusRoute, async (c) => {
    const auth = c.get('authService')
    const env = c.get('env')
    await requireUser(c, auth)
    return c.json(
      {
        configured: isAiConfigured(env),
        autoAnalyze: env.AI_AUTO_ANALYZE,
        model: env.YANDEX_GPT_MODEL,
      },
      200,
    )
  })

  routes.openapi(supplierNegotiationRoute, async (c) => {
    const auth = c.get('authService')
    const negotiations = c.get('negotiationService')
    const user = await requireUser(c, auth)
    const { supplierId } = c.req.valid('param')
    return c.json(await negotiations.getBySupplier(user, supplierId), 200)
  })

  return routes
}
