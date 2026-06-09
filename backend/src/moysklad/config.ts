import type { AppEnv } from '../env'

export type MoySkladConfig = {
  apiUrl: string
  login: string
  password: string
}

export function moyskladConfigFromEnv(env: AppEnv): MoySkladConfig | null {
  if (!env.MOYSKLAD_LOGIN || !env.MOYSKLAD_PASSWORD) {
    return null
  }

  return {
    apiUrl: env.MOYSKLAD_API_URL.replace(/\/$/, ''),
    login: env.MOYSKLAD_LOGIN,
    password: env.MOYSKLAD_PASSWORD,
  }
}

export function minorUnitsToMajor(value: number) {
  return value / 100
}

export function normalizeMatchToken(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function extractIdFromHref(href: string) {
  const parts = href.split('/')
  return parts.at(-1) ?? null
}
