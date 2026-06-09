import {
  apiErrorSchema,
  draftIdParamsSchema,
  draftListQuerySchema,
  emailDraftDetailSchema,
  emailDraftListResponseSchema,
  rejectDraftRequestSchema,
  updateDraftRequestSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import { requireUser } from '../auth/guard'
import type { AuthService } from '../auth/service'
import { validationErrorHook } from '../http/errors'
import type { DraftService } from './service'

type DraftRouteEnv = {
  Variables: {
    authService: AuthService
    draftService: DraftService
  }
}

const errorResponseContent = { 'application/json': { schema: apiErrorSchema } }

const listRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: draftListQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: emailDraftListResponseSchema } },
      description: 'Draft list',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
  },
})

const getRoute = createRoute({
  method: 'get',
  path: '/{draftId}',
  request: { params: draftIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: emailDraftDetailSchema } },
      description: 'Draft detail',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
    404: { content: errorResponseContent, description: 'Not found' },
  },
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/{draftId}',
  request: {
    params: draftIdParamsSchema,
    body: { content: { 'application/json': { schema: updateDraftRequestSchema } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: emailDraftDetailSchema } },
      description: 'Updated draft',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
    409: { content: errorResponseContent, description: 'Conflict' },
  },
})

const submitRoute = createRoute({
  method: 'post',
  path: '/{draftId}/submit',
  request: { params: draftIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: emailDraftDetailSchema } },
      description: 'Submitted for review',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
    409: { content: errorResponseContent, description: 'Conflict' },
  },
})

const approveRoute = createRoute({
  method: 'post',
  path: '/{draftId}/approve',
  request: { params: draftIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: emailDraftDetailSchema } },
      description: 'Approved draft',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
    409: { content: errorResponseContent, description: 'Conflict' },
  },
})

const rejectRoute = createRoute({
  method: 'post',
  path: '/{draftId}/reject',
  request: {
    params: draftIdParamsSchema,
    body: { content: { 'application/json': { schema: rejectDraftRequestSchema } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: emailDraftDetailSchema } },
      description: 'Rejected draft',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
    409: { content: errorResponseContent, description: 'Conflict' },
  },
})

const sendRoute = createRoute({
  method: 'post',
  path: '/{draftId}/send',
  request: { params: draftIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: emailDraftDetailSchema } },
      description: 'Sent draft',
    },
    400: { content: errorResponseContent, description: 'Validation error' },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
    409: { content: errorResponseContent, description: 'Conflict' },
  },
})

const regenerateRoute = createRoute({
  method: 'post',
  path: '/{draftId}/regenerate',
  request: { params: draftIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: emailDraftDetailSchema } },
      description: 'Regenerated draft',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
    409: { content: errorResponseContent, description: 'Conflict' },
  },
})

export function createDraftRoutes() {
  const routes = new OpenAPIHono<DraftRouteEnv>({ defaultHook: validationErrorHook })

  routes.openapi(listRoute, async (c) => {
    const auth = c.get('authService')
    const drafts = c.get('draftService')
    const user = await requireUser(c, auth)
    const query = c.req.valid('query')
    return c.json({ items: await drafts.list(user, query) }, 200)
  })

  routes.openapi(getRoute, async (c) => {
    const auth = c.get('authService')
    const drafts = c.get('draftService')
    const user = await requireUser(c, auth)
    const { draftId } = c.req.valid('param')
    return c.json(await drafts.getById(user, draftId), 200)
  })

  routes.openapi(updateRoute, async (c) => {
    const auth = c.get('authService')
    const drafts = c.get('draftService')
    const user = await requireUser(c, auth)
    const { draftId } = c.req.valid('param')
    const body = c.req.valid('json')
    return c.json(await drafts.update(user, draftId, body), 200)
  })

  routes.openapi(submitRoute, async (c) => {
    const auth = c.get('authService')
    const drafts = c.get('draftService')
    const user = await requireUser(c, auth)
    const { draftId } = c.req.valid('param')
    return c.json(await drafts.submit(user, draftId), 200)
  })

  routes.openapi(approveRoute, async (c) => {
    const auth = c.get('authService')
    const drafts = c.get('draftService')
    const user = await requireUser(c, auth)
    const { draftId } = c.req.valid('param')
    return c.json(await drafts.approve(user, draftId), 200)
  })

  routes.openapi(rejectRoute, async (c) => {
    const auth = c.get('authService')
    const drafts = c.get('draftService')
    const user = await requireUser(c, auth)
    const { draftId } = c.req.valid('param')
    const body = c.req.valid('json')
    return c.json(await drafts.reject(user, draftId, body), 200)
  })

  routes.openapi(sendRoute, async (c) => {
    const auth = c.get('authService')
    const drafts = c.get('draftService')
    const user = await requireUser(c, auth)
    const { draftId } = c.req.valid('param')
    return c.json(await drafts.send(user, draftId), 200)
  })

  routes.openapi(regenerateRoute, async (c) => {
    const auth = c.get('authService')
    const drafts = c.get('draftService')
    const user = await requireUser(c, auth)
    const { draftId } = c.req.valid('param')
    return c.json(await drafts.regenerate(user, draftId), 200)
  })

  return routes
}
