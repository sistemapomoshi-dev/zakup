import {
  apiErrorSchema,
  moyskladStatusSchema,
  moyskladSyncResultSchema,
  priceComparisonListResponseSchema,
  moyskladAttachmentComparisonParamsSchema,
  moyskladAttachmentComparisonQuerySchema,
  moyskladPriceSuggestionIdParamsSchema,
  moyskladPriceSuggestionListQuerySchema,
  moyskladPriceSuggestionListResponseSchema,
  moyskladPriceSuggestionSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import { requireUser } from '../auth/guard'
import type { AuthService } from '../auth/service'
import { AppError, validationErrorHook } from '../http/errors'
import type { MoySkladService } from './service'

type MoySkladRouteEnv = {
  Variables: {
    authService: AuthService
    moyskladService: MoySkladService
  }
}

const errorResponseContent = {
  'application/json': { schema: apiErrorSchema },
}

const statusRoute = createRoute({
  method: 'get',
  path: '/status',
  responses: {
    200: {
      content: { 'application/json': { schema: moyskladStatusSchema } },
      description: 'MoySklad integration status',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
  },
})

const syncRoute = createRoute({
  method: 'post',
  path: '/sync',
  responses: {
    200: {
      content: { 'application/json': { schema: moyskladSyncResultSchema } },
      description: 'MoySklad sync completed',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
    502: { content: errorResponseContent, description: 'Sync failed' },
    503: { content: errorResponseContent, description: 'Not configured' },
  },
})

const attachmentComparisonRoute = createRoute({
  method: 'get',
  path: '/attachments/{attachmentId}/comparison',
  request: {
    params: moyskladAttachmentComparisonParamsSchema,
    query: moyskladAttachmentComparisonQuerySchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: priceComparisonListResponseSchema } },
      description: 'Parsed price comparison with MoySklad',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    404: { content: errorResponseContent, description: 'Not found' },
  },
})

const listPriceSuggestionsRoute = createRoute({
  method: 'get',
  path: '/price-suggestions',
  request: { query: moyskladPriceSuggestionListQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: moyskladPriceSuggestionListResponseSchema } },
      description: 'MoySklad price suggestions',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
  },
})

const createPriceSuggestionsRoute = createRoute({
  method: 'post',
  path: '/attachments/{attachmentId}/price-suggestions',
  request: {
    params: moyskladAttachmentComparisonParamsSchema,
    query: moyskladAttachmentComparisonQuerySchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: moyskladPriceSuggestionListResponseSchema } },
      description: 'Generated MoySklad price suggestions from attachment',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
    404: { content: errorResponseContent, description: 'Not found' },
  },
})

const confirmPriceSuggestionRoute = createRoute({
  method: 'post',
  path: '/price-suggestions/{suggestionId}/confirm',
  request: { params: moyskladPriceSuggestionIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: moyskladPriceSuggestionSchema } },
      description: 'Confirmed MoySklad price suggestion',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
    404: { content: errorResponseContent, description: 'Not found' },
  },
})

export function createMoySkladRoutes() {
  const routes = new OpenAPIHono<MoySkladRouteEnv>({
    defaultHook: validationErrorHook,
  })

  routes.openapi(statusRoute, async (c) => {
    const auth = c.get('authService')
    const moysklad = c.get('moyskladService')
    await requireUser(c, auth)
    return c.json(await moysklad.getStatus(), 200)
  })

  routes.openapi(syncRoute, async (c) => {
    const auth = c.get('authService')
    const moysklad = c.get('moyskladService')
    const user = await requireUser(c, auth)
    assertMoySkladSyncRole(user.role)
    return c.json(await moysklad.syncAll(), 200)
  })

  routes.openapi(attachmentComparisonRoute, async (c) => {
    const auth = c.get('authService')
    const moysklad = c.get('moyskladService')
    await requireUser(c, auth)
    const { attachmentId } = c.req.valid('param')
    const { supplierId } = c.req.valid('query')
    return c.json(
      { items: await moysklad.compareAttachment(attachmentId, supplierId ?? null) },
      200,
    )
  })

  routes.openapi(listPriceSuggestionsRoute, async (c) => {
    const auth = c.get('authService')
    const moysklad = c.get('moyskladService')
    await requireUser(c, auth)
    return c.json({ items: await moysklad.listPriceSuggestions(c.req.valid('query')) }, 200)
  })

  routes.openapi(createPriceSuggestionsRoute, async (c) => {
    const auth = c.get('authService')
    const moysklad = c.get('moyskladService')
    const user = await requireUser(c, auth)
    assertMoySkladSyncRole(user.role)
    const { attachmentId } = c.req.valid('param')
    const { supplierId } = c.req.valid('query')
    return c.json(
      { items: await moysklad.createPriceSuggestionsFromAttachment(attachmentId, supplierId ?? null) },
      200,
    )
  })

  routes.openapi(confirmPriceSuggestionRoute, async (c) => {
    const auth = c.get('authService')
    const moysklad = c.get('moyskladService')
    const user = await requireUser(c, auth)
    assertMoySkladSyncRole(user.role)
    const { suggestionId } = c.req.valid('param')
    return c.json(await moysklad.confirmPriceSuggestion(user.id, suggestionId), 200)
  })

  return routes
}

function assertMoySkladSyncRole(role: string) {
  if (role !== 'manager' && role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions')
  }
}
