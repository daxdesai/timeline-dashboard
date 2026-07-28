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
