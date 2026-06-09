import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import type { DbClient } from './db'
import type { AppEnv } from './env'
import { createAuthRoutes } from './auth/routes'
import { createMailRoutes } from './mail/routes'
import { MailService } from './mail/service'
import { createMailboxRoutes } from './mailbox/routes'
import { MailboxService } from './mailbox/service'
import { createMoySkladRoutes } from './moysklad/routes'
import { MoySkladService } from './moysklad/service'
import { createRetailRoutes } from './retail/routes'
import { RetailService } from './retail/service'
import { createDraftRoutes } from './drafts/routes'
import { DraftService } from './drafts/service'
import { createNegotiationRoutes } from './negotiations/routes'
import { NegotiationService } from './negotiations/service'
import { createSupplierRoutes } from './suppliers/routes'
import { SupplierService } from './suppliers/service'
import { AuthService } from './auth/service'
import { errorResponse, handleError, validationErrorHook } from './http/errors'
import { createStorageServiceFromEnv, type StorageService } from './storage/service'

type AppBindings = {
  Variables: {
    authService: AuthService
    env: AppEnv
    storageService: StorageService | null
    supplierService: SupplierService
    mailboxService: MailboxService
    mailService: MailService
    moyskladService: MoySkladService
    retailService: RetailService
    draftService: DraftService
    negotiationService: NegotiationService
  }
}

type CreateAppOptions = {
  env: AppEnv
  prisma: DbClient
}

export function createApp({ env, prisma }: CreateAppOptions) {
  const authService = new AuthService(prisma, env)
  const storageService = createStorageServiceFromEnv(env)
  const supplierService = new SupplierService(prisma)
  const mailboxService = new MailboxService(prisma, env, storageService)
  const mailService = new MailService(prisma, env, storageService)
  const moyskladService = new MoySkladService(prisma, env)
  const retailService = new RetailService(prisma, env)
  const draftService = new DraftService(prisma, env)
  const negotiationService = new NegotiationService(prisma)
  const app = new OpenAPIHono<AppBindings>({
    defaultHook: validationErrorHook,
  })

  app.use(secureHeaders())
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return env.CORS_ORIGINS[0] ?? null
        return env.CORS_ORIGINS.includes(origin) ? origin : null
      },
      allowHeaders: ['Content-Type', 'Authorization', 'X-Client-Platform'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
      maxAge: 600,
    }),
  )
  app.use('*', async (c, next) => {
    c.set('authService', authService)
    c.set('env', env)
    c.set('storageService', storageService)
    c.set('supplierService', supplierService)
    c.set('mailboxService', mailboxService)
    c.set('mailService', mailService)
    c.set('moyskladService', moyskladService)
    c.set('retailService', retailService)
    c.set('draftService', draftService)
    c.set('negotiationService', negotiationService)
    await next()
  })

  app.get('/', (c) => {
    return c.json({
      name: 'zakup backend',
      status: 'ok',
    })
  })

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
    })
  })

  app.route('/api/auth', createAuthRoutes())

  app.route('/api/suppliers', createSupplierRoutes())
  app.route('/api/mailbox', createMailboxRoutes())
  app.route('/api/mail', createMailRoutes())
  app.route('/api/moysklad', createMoySkladRoutes())
  app.route('/api/retail', createRetailRoutes())
  app.route('/api/drafts', createDraftRoutes())
  app.route('/api/negotiations', createNegotiationRoutes())

  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'zakup API',
      version: '1.0.0',
    },
  })

  app.notFound((c) => c.json(errorResponse('NOT_FOUND', 'Route not found'), 404))
  app.onError(handleError)

  return app
}

export type AppType = ReturnType<typeof createApp>
