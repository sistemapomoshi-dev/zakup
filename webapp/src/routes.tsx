import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { AppPage, HomePage, RootLayout } from './pages'
import { DraftsPage } from './pages/drafts'
import { MailboxPage } from './pages/mailbox'
import { SupplierMailPage } from './pages/supplier-mail'
import { SupplierNegotiationPage } from './pages/supplier-negotiation'
import { SuppliersPage } from './pages/suppliers'

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: AppPage,
})

const suppliersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/suppliers',
  component: SuppliersPage,
})

const supplierMailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/suppliers/$supplierId/mail',
  component: SupplierMailPage,
})

const mailboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/mailbox',
  component: MailboxPage,
})

const draftsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/drafts',
  component: DraftsPage,
})

const supplierNegotiationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/suppliers/$supplierId/negotiation',
  component: SupplierNegotiationPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  appRoute,
  suppliersRoute,
  supplierMailRoute,
  supplierNegotiationRoute,
  draftsRoute,
  mailboxRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
