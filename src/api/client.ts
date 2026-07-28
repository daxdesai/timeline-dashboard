import type { ApiEnvelope } from './types'

const TOKEN_KEY = 'access_token'

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'https://fractaldmsdev.centralindia.cloudapp.azure.com'

export class ApiError extends Error {
  statusCode: number
  traceId?: string

  constructor(message: string, statusCode: number, traceId?: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.traceId = traceId
  }
}

export class ValidationError extends ApiError {
  fieldErrors: Record<string, string[]>

  constructor(
    message: string,
    fieldErrors: Record<string, string[]>,
    traceId?: string,
  ) {
    super(message, 422, traceId)
    this.name = 'ValidationError'
    this.fieldErrors = fieldErrors
  }
}

function parseFieldErrors(data: unknown): Record<string, string[]> {
  if (!data || typeof data !== 'object') return {}

  if (Array.isArray(data)) {
    const errors: Record<string, string[]> = {}
    for (const item of data) {
      if (!item || typeof item !== 'object') continue
      const field =
        'field' in item && typeof item.field === 'string'
          ? item.field
          : 'loc' in item && Array.isArray(item.loc)
            ? String(item.loc[item.loc.length - 1])
            : 'detail' in item
              ? 'error'
              : 'general'
      const message =
        'message' in item && typeof item.message === 'string'
          ? item.message
          : 'msg' in item && typeof item.msg === 'string'
            ? item.msg
            : 'detail' in item && typeof item.detail === 'string'
              ? item.detail
              : JSON.stringify(item)
      errors[field] = [...(errors[field] ?? []), message]
    }
    return errors
  }

  const errors: Record<string, string[]> = {}
  for (const [field, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value === 'string') {
      errors[field] = [value]
    } else if (Array.isArray(value)) {
      errors[field] = value.map(String)
    }
  }
  return errors
}

export function formatApiErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    const details = Object.entries(error.fieldErrors)
      .flatMap(([field, messages]) =>
        messages.map((message) =>
          field === 'general' || field === 'error' ? message : `${field}: ${message}`,
        ),
      )
      .join(' ')
    return details ? `${error.message} ${details}`.trim() : error.message
  }
  if (error instanceof ApiError) {
    if (error.statusCode === 403) return 'Access denied.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

export class UnauthorizedError extends ApiError {
  constructor(message: string, traceId?: string) {
    super(message, 401, traceId)
    this.name = 'UnauthorizedError'
  }
}

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiEnvelope<T>

  if (body.status_code >= 400) {
    if (body.status_code === 401) {
      throw new UnauthorizedError(body.message, body.trace_id)
    }
    if (body.status_code === 422) {
      throw new ValidationError(
        body.message,
        parseFieldErrors(body.data),
        body.trace_id,
      )
    }
    throw new ApiError(body.message, body.status_code, body.trace_id)
  }

  return body.data
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean; retries?: number } = {},
): Promise<T> {
  const { skipAuth = false, retries = 2, ...fetchOptions } = options
  const headers = new Headers(fetchOptions.headers)

  if (!headers.has('Content-Type') && fetchOptions.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (!skipAuth) {
    const token = getStoredToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  let attempt = 0
  let lastError: unknown

  while (attempt <= retries) {
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...fetchOptions,
        headers,
      })

      if (response.status === 401 && !skipAuth) {
        setStoredToken(null)
        unauthorizedHandler?.()
        const body = (await response.json()) as ApiEnvelope<null>
        throw new UnauthorizedError(body.message, body.trace_id)
      }

      if (response.status >= 500 && attempt < retries) {
        attempt += 1
        await sleep(500 * 2 ** (attempt - 1))
        continue
      }

      return parseEnvelope<T>(response)
    } catch (error) {
      lastError = error
      if (error instanceof UnauthorizedError) {
        throw error
      }
      if (error instanceof ApiError && error.statusCode < 500) {
        throw error
      }
      if (attempt < retries) {
        attempt += 1
        await sleep(500 * 2 ** (attempt - 1))
        continue
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Request failed after retries')
}
