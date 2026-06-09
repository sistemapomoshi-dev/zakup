import {
  apiErrorSchema,
  authResponseSchema,
  loginRequestSchema,
  logoutRequestSchema,
  meResponseSchema,
  refreshRequestSchema,
  refreshResponseSchema,
  registerRequestSchema,
  createSupplierRequestSchema,
  emailMessageListResponseSchema,
  emailThreadListResponseSchema,
  emailThreadSchema,
  linkThreadRequestSchema,
  mailboxConnectionNullableSchema,
  mailboxConnectionSchema,
  mailboxSyncResultSchema,
  moyskladStatusSchema,
  moyskladSyncResultSchema,
  priceComparisonListResponseSchema,
  productMarketLinkListResponseSchema,
  productMarketLinkSchema,
  parsedPriceRowListResponseSchema,
  aiStatusSchema,
  emailDraftDetailSchema,
  emailDraftListResponseSchema,
  negotiationSchema,
  rejectDraftRequestSchema,
  updateDraftRequestSchema,
  retailStatusSchema,
  retailSyncResultSchema,
  reparseAttachmentResponseSchema,
  supplierListResponseSchema,
  supplierSchema,
  upsertMailboxRequestSchema,
  type AuthResponse,
  type CreateSupplierRequest,
  type EmailMessageDto,
  type EmailThreadDto,
  type ParsedPriceRowDto,
  type PriceComparisonRowDto,
  type ProductMarketLinkDto,
  type RetailStatusDto,
  type RetailSyncResultDto,
  type MoySkladStatusDto,
  type MoySkladSyncResultDto,
  type CreateProductMarketLinkRequest,
  type AiStatusDto,
  type EmailDraftDetailDto,
  type EmailDraftDto,
  type EmailDraftStatusDto,
  type NegotiationDto,
  type RejectDraftRequest,
  type UpdateDraftRequest,
  type MailboxConnectionDto,
  type MailboxSyncResult,
  type SupplierDto,
  type SupplierListResponse,
  type UpsertMailboxRequest,
  type LoginRequest,
  type LogoutRequest,
  type MeResponse,
  type RefreshRequest,
  type RefreshResponse,
  type RegisterRequest,
} from '@web-app-demo/contracts'
import type { z } from 'zod'

const apiBaseUrl = (import.meta.env?.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

type ApiClientOptions = {
  getAccessToken: () => string | null
  setAccessToken: (accessToken: string | null) => void
  onAuthExpired?: () => void | Promise<void>
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
  retryOnUnauthorized?: boolean
  accessTokenOverride?: string
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export class ApiClient {
  private readonly options: ApiClientOptions
  private refreshPromise: Promise<RefreshResponse> | null = null

  constructor(options: ApiClientOptions) {
    this.options = options
  }

  register(input: RegisterRequest): Promise<AuthResponse> {
    const payload = registerRequestSchema.parse(input)
    return this.request('/api/auth/register', authResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
    })
  }

  login(input: LoginRequest): Promise<AuthResponse> {
    const payload = loginRequestSchema.parse(input)
    return this.request('/api/auth/login', authResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
    })
  }

  refresh(input: RefreshRequest = {}): Promise<RefreshResponse> {
    const payload = refreshRequestSchema.parse(input)
    return this.request('/api/auth/refresh', refreshResponseSchema, {
      method: 'POST',
      body: payload,
      auth: false,
      retryOnUnauthorized: false,
    })
  }


  listSuppliers(): Promise<SupplierListResponse> {
    return this.request('/api/suppliers', supplierListResponseSchema, {
      method: 'GET',
      auth: true,
    })
  }

  createSupplier(input: CreateSupplierRequest): Promise<SupplierDto> {
    const payload = createSupplierRequestSchema.parse(input)
    return this.request('/api/suppliers', supplierSchema, {
      method: 'POST',
      body: payload,
      auth: true,
    })
  }

  getMailbox(): Promise<MailboxConnectionDto | null> {
    return this.request('/api/mailbox', mailboxConnectionNullableSchema, {
      method: 'GET',
      auth: true,
    })
  }

  saveMailbox(input: UpsertMailboxRequest): Promise<MailboxConnectionDto> {
    const payload = upsertMailboxRequestSchema.parse(input)
    return this.request('/api/mailbox', mailboxConnectionSchema, {
      method: 'PUT',
      body: payload,
      auth: true,
    })
  }

  syncMailbox(): Promise<MailboxSyncResult> {
    return this.request('/api/mailbox/sync', mailboxSyncResultSchema, {
      method: 'POST',
      auth: true,
    })
  }

  listSupplierThreads(supplierId: string) {
    return this.request(`/api/mail/suppliers/${supplierId}/threads`, emailThreadListResponseSchema, {
      method: 'GET',
      auth: true,
    })
  }

  listUnlinkedThreads() {
    return this.request('/api/mail/threads/unlinked', emailThreadListResponseSchema, {
      method: 'GET',
      auth: true,
    })
  }

  listThreadMessages(threadId: string): Promise<{ items: EmailMessageDto[] }> {
    return this.request(`/api/mail/threads/${threadId}/messages`, emailMessageListResponseSchema, {
      method: 'GET',
      auth: true,
    })
  }

  linkThread(threadId: string, supplierId: string | null): Promise<EmailThreadDto> {
    const payload = linkThreadRequestSchema.parse({ supplierId })
    return this.request(`/api/mail/threads/${threadId}/link`, emailThreadSchema, {
      method: 'PATCH',
      body: payload,
      auth: true,
    })
  }

  listAttachmentRows(attachmentId: string): Promise<{ items: ParsedPriceRowDto[] }> {
    return this.request(`/api/mail/attachments/${attachmentId}/rows`, parsedPriceRowListResponseSchema, {
      method: 'GET',
      auth: true,
    })
  }

  reparseAttachment(attachmentId: string) {
    return this.request(`/api/mail/attachments/${attachmentId}/reparse`, reparseAttachmentResponseSchema, {
      method: 'POST',
      auth: true,
    })
  }

  getMoyskladStatus(): Promise<MoySkladStatusDto> {
    return this.request('/api/moysklad/status', moyskladStatusSchema, {
      method: 'GET',
      auth: true,
    })
  }

  syncMoysklad(): Promise<MoySkladSyncResultDto> {
    return this.request('/api/moysklad/sync', moyskladSyncResultSchema, {
      method: 'POST',
      auth: true,
    })
  }

  getAttachmentComparison(attachmentId: string, supplierId?: string): Promise<{ items: PriceComparisonRowDto[] }> {
    const query = supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : ''
    return this.request(`/api/moysklad/attachments/${attachmentId}/comparison${query}`, priceComparisonListResponseSchema, {
      method: 'GET',
      auth: true,
    })
  }

  getRetailStatus(): Promise<RetailStatusDto> {
    return this.request('/api/retail/status', retailStatusSchema, {
      method: 'GET',
      auth: true,
    })
  }

  syncRetail(): Promise<RetailSyncResultDto> {
    return this.request('/api/retail/sync', retailSyncResultSchema, {
      method: 'POST',
      auth: true,
    })
  }

  listProductMarketLinks(productId: string): Promise<{ items: ProductMarketLinkDto[] }> {
    return this.request(`/api/retail/products/${encodeURIComponent(productId)}/links`, productMarketLinkListResponseSchema, {
      method: 'GET',
      auth: true,
    })
  }

  createProductMarketLink(productId: string, input: CreateProductMarketLinkRequest): Promise<ProductMarketLinkDto> {
    return this.request(`/api/retail/products/${encodeURIComponent(productId)}/links`, productMarketLinkSchema, {
      method: 'POST',
      body: input,
      auth: true,
    })
  }

  deleteProductMarketLink(linkId: string) {
    return this.rawRequest(`/api/retail/links/${encodeURIComponent(linkId)}`, {
      method: 'DELETE',
      auth: true,
    })
  }

  getAiStatus(): Promise<AiStatusDto> {
    return this.request('/api/negotiations/status', aiStatusSchema, {
      method: 'GET',
      auth: true,
    })
  }

  getSupplierNegotiation(supplierId: string): Promise<NegotiationDto | null> {
    return this.request(`/api/negotiations/suppliers/${encodeURIComponent(supplierId)}`, negotiationSchema.nullable(), {
      method: 'GET',
      auth: true,
    })
  }

  listDrafts(filters?: { status?: EmailDraftStatusDto; supplierId?: string }) {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.supplierId) params.set('supplierId', filters.supplierId)
    const query = params.size ? `?${params.toString()}` : ''
    return this.request(`/api/drafts${query}`, emailDraftListResponseSchema, {
      method: 'GET',
      auth: true,
    })
  }

  getDraft(draftId: string): Promise<EmailDraftDetailDto> {
    return this.request(`/api/drafts/${encodeURIComponent(draftId)}`, emailDraftDetailSchema, {
      method: 'GET',
      auth: true,
    })
  }

  updateDraft(draftId: string, input: UpdateDraftRequest): Promise<EmailDraftDetailDto> {
    const payload = updateDraftRequestSchema.parse(input)
    return this.request(`/api/drafts/${encodeURIComponent(draftId)}`, emailDraftDetailSchema, {
      method: 'PATCH',
      body: payload,
      auth: true,
    })
  }

  submitDraft(draftId: string): Promise<EmailDraftDetailDto> {
    return this.request(`/api/drafts/${encodeURIComponent(draftId)}/submit`, emailDraftDetailSchema, {
      method: 'POST',
      auth: true,
    })
  }

  approveDraft(draftId: string): Promise<EmailDraftDetailDto> {
    return this.request(`/api/drafts/${encodeURIComponent(draftId)}/approve`, emailDraftDetailSchema, {
      method: 'POST',
      auth: true,
    })
  }

  rejectDraft(draftId: string, input: RejectDraftRequest): Promise<EmailDraftDetailDto> {
    const payload = rejectDraftRequestSchema.parse(input)
    return this.request(`/api/drafts/${encodeURIComponent(draftId)}/reject`, emailDraftDetailSchema, {
      method: 'POST',
      body: payload,
      auth: true,
    })
  }

  sendDraft(draftId: string): Promise<EmailDraftDetailDto> {
    return this.request(`/api/drafts/${encodeURIComponent(draftId)}/send`, emailDraftDetailSchema, {
      method: 'POST',
      auth: true,
    })
  }

  regenerateDraft(draftId: string): Promise<EmailDraftDetailDto> {
    return this.request(`/api/drafts/${encodeURIComponent(draftId)}/regenerate`, emailDraftDetailSchema, {
      method: 'POST',
      auth: true,
    })
  }

  me(): Promise<MeResponse> {
    return this.request('/api/auth/me', meResponseSchema, {
      auth: true,
    })
  }

  async logout(input: LogoutRequest = {}) {
    const payload = logoutRequestSchema.parse(input)
    await this.rawRequest('/api/auth/logout', {
      method: 'POST',
      body: payload,
      auth: false,
      retryOnUnauthorized: false,
    })
  }

  async expireSession() {
    this.options.setAccessToken(null)
    await this.rawRequest('/api/auth/logout', {
      method: 'POST',
      body: {},
      auth: false,
      retryOnUnauthorized: false,
    }).catch(() => undefined)
    await this.options.onAuthExpired?.()
  }

  private async request<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    options: RequestOptions,
  ): Promise<z.infer<TSchema>> {
    const response = await this.rawRequest(path, options)
    const data = await response.json()
    return schema.parse(data)
  }

  private async rawRequest(path: string, options: RequestOptions): Promise<Response> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: this.headers(options),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })

    if (response.status === 401 && options.auth && options.retryOnUnauthorized !== false) {
      const refreshed = await this.refreshOnce().catch(async (error: unknown) => {
        await this.expireSession()
        throw error
      })
      this.options.setAccessToken(refreshed.accessToken)
      return this.rawRequest(path, {
        ...options,
        accessTokenOverride: refreshed.accessToken,
        retryOnUnauthorized: false,
      })
    }

    if (!response.ok) {
      throw await toApiError(response)
    }

    return response
  }

  private refreshOnce() {
    this.refreshPromise ??= this.refresh().finally(() => {
      this.refreshPromise = null
    })

    return this.refreshPromise
  }

  private headers(options: RequestOptions) {
    const headers = new Headers({
      'X-Client-Platform': 'web',
    })

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    if (options.auth) {
      const accessToken = options.accessTokenOverride ?? this.options.getAccessToken()
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`)
      }
    }

    return headers
  }
}

async function toApiError(response: Response) {
  const fallbackMessage = `Request failed with status ${response.status}`

  try {
    const parsed = apiErrorSchema.parse(await response.json())
    return new ApiRequestError(response.status, parsed.error.code, parsed.error.message)
  } catch {
    return new ApiRequestError(response.status, 'INTERNAL_ERROR', fallbackMessage)
  }
}
