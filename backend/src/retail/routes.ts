import {

  apiErrorSchema,

  createProductMarketLinkRequestSchema,

  marketLinkIdParamsSchema,

  productMarketLinkListResponseSchema,

  productMarketLinkParamsSchema,

  productMarketLinkSchema,

  retailStatusSchema,

  retailSyncResultSchema,

} from '@web-app-demo/contracts'

import { createRoute, OpenAPIHono } from '@hono/zod-openapi'



import { requireUser } from '../auth/guard'

import type { AuthService } from '../auth/service'

import { AppError, validationErrorHook } from '../http/errors'

import type { RetailService } from './service'



type RetailRouteEnv = {

  Variables: {

    authService: AuthService

    retailService: RetailService

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

      content: { 'application/json': { schema: retailStatusSchema } },

      description: 'Retail price integration status',

    },

    401: { content: errorResponseContent, description: 'Unauthorized' },

  },

})



const syncRoute = createRoute({

  method: 'post',

  path: '/sync',

  responses: {

    200: {

      content: { 'application/json': { schema: retailSyncResultSchema } },

      description: 'Retail price sync completed',

    },

    401: { content: errorResponseContent, description: 'Unauthorized' },

    403: { content: errorResponseContent, description: 'Forbidden' },

    502: { content: errorResponseContent, description: 'Sync failed' },

    503: { content: errorResponseContent, description: 'Disabled' },

  },

})



const listLinksRoute = createRoute({

  method: 'get',

  path: '/products/{productId}/links',

  request: { params: productMarketLinkParamsSchema },

  responses: {

    200: {

      content: { 'application/json': { schema: productMarketLinkListResponseSchema } },

      description: 'Product marketplace links',

    },

    401: { content: errorResponseContent, description: 'Unauthorized' },

    404: { content: errorResponseContent, description: 'Not found' },

  },

})



const createLinkRoute = createRoute({

  method: 'post',

  path: '/products/{productId}/links',

  request: {

    params: productMarketLinkParamsSchema,

    body: {

      content: { 'application/json': { schema: createProductMarketLinkRequestSchema } },

    },

  },

  responses: {

    201: {

      content: { 'application/json': { schema: productMarketLinkSchema } },

      description: 'Marketplace link created',

    },

    400: { content: errorResponseContent, description: 'Validation error' },

    401: { content: errorResponseContent, description: 'Unauthorized' },

    404: { content: errorResponseContent, description: 'Not found' },

  },

})



const deleteLinkRoute = createRoute({

  method: 'delete',

  path: '/links/{linkId}',

  request: { params: marketLinkIdParamsSchema },

  responses: {

    204: { description: 'Deleted' },

    401: { content: errorResponseContent, description: 'Unauthorized' },

    404: { content: errorResponseContent, description: 'Not found' },

  },

})



export function createRetailRoutes() {

  const routes = new OpenAPIHono<RetailRouteEnv>({

    defaultHook: validationErrorHook,

  })



  routes.openapi(statusRoute, async (c) => {

    const auth = c.get('authService')

    const retail = c.get('retailService')

    await requireUser(c, auth)

    return c.json(await retail.getStatus(), 200)

  })



  routes.openapi(syncRoute, async (c) => {

    const auth = c.get('authService')

    const retail = c.get('retailService')

    const user = await requireUser(c, auth)

    assertRetailSyncRole(user.role)

    return c.json(await retail.syncAll(), 200)

  })



  routes.openapi(listLinksRoute, async (c) => {

    const auth = c.get('authService')

    const retail = c.get('retailService')

    await requireUser(c, auth)

    const { productId } = c.req.valid('param')

    return c.json({ items: await retail.listProductLinks(productId) }, 200)

  })



  routes.openapi(createLinkRoute, async (c) => {

    const auth = c.get('authService')

    const retail = c.get('retailService')

    const user = await requireUser(c, auth)

    assertRetailSyncRole(user.role)

    const { productId } = c.req.valid('param')

    const body = c.req.valid('json')

    const link = await retail.createProductLink(productId, body)

    return c.json(link, 201)

  })



  routes.openapi(deleteLinkRoute, async (c) => {

    const auth = c.get('authService')

    const retail = c.get('retailService')

    const user = await requireUser(c, auth)

    assertRetailSyncRole(user.role)

    const { linkId } = c.req.valid('param')

    await retail.deleteLink(linkId)

    return c.body(null, 204)

  })



  return routes

}



function assertRetailSyncRole(role: string) {

  if (role !== 'manager' && role !== 'admin') {

    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions')

  }

}


