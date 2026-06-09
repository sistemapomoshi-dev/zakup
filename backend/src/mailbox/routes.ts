import {
  apiErrorSchema,
  mailboxConnectionNullableSchema,
  mailboxConnectionSchema,
  mailboxSyncResultSchema,
  upsertMailboxRequestSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import { requireUser } from '../auth/guard'
import type { AuthService } from '../auth/service'
import { validationErrorHook } from '../http/errors'
import type { MailboxService } from './service'

type MailboxRouteEnv = {
  Variables: {
    authService: AuthService
    mailboxService: MailboxService
  }
}

const errorResponseContent = {
  'application/json': { schema: apiErrorSchema },
}

const getMailboxRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: { 'application/json': { schema: mailboxConnectionNullableSchema } },
      description: 'Mailbox connection',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
  },
})

const upsertMailboxRoute = createRoute({
  method: 'put',
  path: '/',
  request: {
    body: {
      content: { 'application/json': { schema: upsertMailboxRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: mailboxConnectionSchema } },
      description: 'Mailbox saved',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
  },
})

const syncMailboxRoute = createRoute({
  method: 'post',
  path: '/sync',
  responses: {
    200: {
      content: { 'application/json': { schema: mailboxSyncResultSchema } },
      description: 'Sync completed',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    404: { content: errorResponseContent, description: 'Mailbox not configured' },
    409: { content: errorResponseContent, description: 'Sync already running' },
  },
})

export function createMailboxRoutes() {
  const routes = new OpenAPIHono<MailboxRouteEnv>({
    defaultHook: validationErrorHook,
  })

  routes.openapi(getMailboxRoute, async (c) => {
    const auth = c.get('authService')
    const mailbox = c.get('mailboxService')
    const user = await requireUser(c, auth)
    return c.json(await mailbox.getForUser(user.id), 200)
  })

  routes.openapi(upsertMailboxRoute, async (c) => {
    const auth = c.get('authService')
    const mailbox = c.get('mailboxService')
    const user = await requireUser(c, auth)
    return c.json(await mailbox.upsert(user, c.req.valid('json')), 200)
  })

  routes.openapi(syncMailboxRoute, async (c) => {
    const auth = c.get('authService')
    const mailbox = c.get('mailboxService')
    const user = await requireUser(c, auth)
    return c.json(await mailbox.sync(user), 200)
  })

  return routes
}
