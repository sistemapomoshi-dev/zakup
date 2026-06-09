import {
  apiErrorSchema,
  createSupplierRequestSchema,
  supplierIdParamsSchema,
  supplierListResponseSchema,
  supplierSchema,
  updateSupplierRequestSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import type { AuthService } from '../auth/service'
import { requireUser } from '../auth/guard'
import { validationErrorHook } from '../http/errors'
import {
  assertSupplierDeleteRole,
  assertSupplierWriteRole,
  type SupplierService,
} from './service'

type SupplierRouteEnv = {
  Variables: {
    authService: AuthService
    supplierService: SupplierService
  }
}

const errorResponseContent = {
  'application/json': {
    schema: apiErrorSchema,
  },
}

const listRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: { 'application/json': { schema: supplierListResponseSchema } },
      description: 'List suppliers',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
  },
})

const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: supplierIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: supplierSchema } },
      description: 'Get supplier',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    404: { content: errorResponseContent, description: 'Not found' },
  },
})

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createSupplierRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: supplierSchema } },
      description: 'Created supplier',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
  },
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  request: {
    params: supplierIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: updateSupplierRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: supplierSchema } },
      description: 'Updated supplier',
    },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
    404: { content: errorResponseContent, description: 'Not found' },
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  request: { params: supplierIdParamsSchema },
  responses: {
    204: { description: 'Deleted supplier' },
    401: { content: errorResponseContent, description: 'Unauthorized' },
    403: { content: errorResponseContent, description: 'Forbidden' },
    404: { content: errorResponseContent, description: 'Not found' },
  },
})

export function createSupplierRoutes() {
  const routes = new OpenAPIHono<SupplierRouteEnv>({
    defaultHook: validationErrorHook,
  })

  routes.openapi(listRoute, async (c) => {
    const auth = c.get('authService')
    const suppliers = c.get('supplierService')
    const user = await requireUser(c, auth)
    return c.json({ items: await suppliers.list(user) }, 200)
  })

  routes.openapi(getRoute, async (c) => {
    const auth = c.get('authService')
    const suppliers = c.get('supplierService')
    const user = await requireUser(c, auth)
    const { id } = c.req.valid('param')
    return c.json(await suppliers.getById(id, user), 200)
  })

  routes.openapi(createRouteDef, async (c) => {
    const auth = c.get('authService')
    const suppliers = c.get('supplierService')
    const user = await requireUser(c, auth)
    assertSupplierWriteRole(user.role)
    const created = await suppliers.create(c.req.valid('json'), user)
    return c.json(created, 201)
  })

  routes.openapi(updateRoute, async (c) => {
    const auth = c.get('authService')
    const suppliers = c.get('supplierService')
    const user = await requireUser(c, auth)
    assertSupplierWriteRole(user.role)
    const { id } = c.req.valid('param')
    const updated = await suppliers.update(id, c.req.valid('json'), user)
    return c.json(updated, 200)
  })

  routes.openapi(deleteRoute, async (c) => {
    const auth = c.get('authService')
    const suppliers = c.get('supplierService')
    const user = await requireUser(c, auth)
    assertSupplierDeleteRole(user.role)
    const { id } = c.req.valid('param')
    await suppliers.remove(id, user)
    return c.body(null, 204)
  })

  return routes
}
