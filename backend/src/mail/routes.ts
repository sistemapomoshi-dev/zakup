import {
  apiErrorSchema,
  attachmentDownloadResponseSchema,
  emailMessageListResponseSchema,
  emailThreadListResponseSchema,
  emailThreadSchema,
  linkThreadRequestSchema,
  mailAttachmentIdParamsSchema,
  mailSupplierIdParamsSchema,
  mailThreadIdParamsSchema,
  parsedPriceRowListResponseSchema,
  reparseAttachmentResponseSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import { requireUser } from '../auth/guard'
import type { AuthService } from '../auth/service'
import { validationErrorHook } from '../http/errors'
import type { MailService } from './service'

type MailRouteEnv = {
  Variables: {
    authService: AuthService
    mailService: MailService
  }
}

const errorResponseContent = {
  'application/json': { schema: apiErrorSchema },
}

const supplierThreadsRoute = createRoute({
  method: 'get',
  path: '/suppliers/{supplierId}/threads',
  request: { params: mailSupplierIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: emailThreadListResponseSchema } },
      description: 'Threads for supplier',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    404: { content: errorResponseContent, description: 'Not found' },
  },
})

const unlinkedThreadsRoute = createRoute({
  method: 'get',
  path: '/threads/unlinked',
  responses: {
    200: {
      content: { 'application/json': { schema: emailThreadListResponseSchema } },
      description: 'Unlinked threads',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
  },
})

const threadMessagesRoute = createRoute({
  method: 'get',
  path: '/threads/{threadId}/messages',
  request: { params: mailThreadIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: emailMessageListResponseSchema } },
      description: 'Messages in thread',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    404: { content: errorResponseContent, description: 'Not found' },
  },
})

const linkThreadRoute = createRoute({
  method: 'patch',
  path: '/threads/{threadId}/link',
  request: {
    params: mailThreadIdParamsSchema,
    body: {
      content: { 'application/json': { schema: linkThreadRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: emailThreadSchema } },
      description: 'Thread linked',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    404: { content: errorResponseContent, description: 'Not found' },
  },
})

const attachmentRowsRoute = createRoute({
  method: 'get',
  path: '/attachments/{attachmentId}/rows',
  request: { params: mailAttachmentIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: parsedPriceRowListResponseSchema } },
      description: 'Parsed price rows',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    404: { content: errorResponseContent, description: 'Not found' },
  },
})

const attachmentDownloadRoute = createRoute({
  method: 'get',
  path: '/attachments/{attachmentId}/download',
  request: { params: mailAttachmentIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: attachmentDownloadResponseSchema } },
      description: 'Attachment download URL',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    404: { content: errorResponseContent, description: 'Not found' },
    501: { content: errorResponseContent, description: 'Not implemented for local storage' },
    503: { content: errorResponseContent, description: 'Storage unavailable' },
  },
})

const reparseAttachmentRoute = createRoute({
  method: 'post',
  path: '/attachments/{attachmentId}/reparse',
  request: { params: mailAttachmentIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: reparseAttachmentResponseSchema } },
      description: 'Attachment reparse started',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    404: { content: errorResponseContent, description: 'Not found' },
  },
})

export function createMailRoutes() {
  const routes = new OpenAPIHono<MailRouteEnv>({
    defaultHook: validationErrorHook,
  })

  routes.openapi(supplierThreadsRoute, async (c) => {
    const auth = c.get('authService')
    const mail = c.get('mailService')
    const user = await requireUser(c, auth)
    const { supplierId } = c.req.valid('param')
    return c.json({ items: await mail.listThreadsForSupplier(user, supplierId) }, 200)
  })

  routes.openapi(unlinkedThreadsRoute, async (c) => {
    const auth = c.get('authService')
    const mail = c.get('mailService')
    const user = await requireUser(c, auth)
    return c.json({ items: await mail.listUnlinkedThreads(user) }, 200)
  })

  routes.openapi(threadMessagesRoute, async (c) => {
    const auth = c.get('authService')
    const mail = c.get('mailService')
    const user = await requireUser(c, auth)
    const { threadId } = c.req.valid('param')
    return c.json({ items: await mail.listMessages(user, threadId) }, 200)
  })

  routes.openapi(linkThreadRoute, async (c) => {
    const auth = c.get('authService')
    const mail = c.get('mailService')
    const user = await requireUser(c, auth)
    const { threadId } = c.req.valid('param')
    const { supplierId } = c.req.valid('json')
    return c.json(await mail.linkThread(user, threadId, supplierId), 200)
  })

  routes.openapi(attachmentRowsRoute, async (c) => {
    const auth = c.get('authService')
    const mail = c.get('mailService')
    const user = await requireUser(c, auth)
    const { attachmentId } = c.req.valid('param')
    return c.json({ items: await mail.listParsedRows(user, attachmentId) }, 200)
  })

  routes.openapi(attachmentDownloadRoute, async (c) => {
    const auth = c.get('authService')
    const mail = c.get('mailService')
    const user = await requireUser(c, auth)
    const { attachmentId } = c.req.valid('param')
    return c.json(await mail.createAttachmentDownload(user, attachmentId), 200)
  })

  routes.openapi(reparseAttachmentRoute, async (c) => {
    const auth = c.get('authService')
    const mail = c.get('mailService')
    const user = await requireUser(c, auth)
    const { attachmentId } = c.req.valid('param')
    return c.json(await mail.reparseAttachment(user, attachmentId), 200)
  })

  return routes
}
