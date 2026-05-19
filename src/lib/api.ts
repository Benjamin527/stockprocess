export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getErrorMessage(payload: unknown, status: number) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }

  if (payload && typeof payload === 'object' && 'error' in payload) {
    const message = payload.error
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  return `Request failed with status ${status}`
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    throw new ApiError(getErrorMessage(payload, response.status), response.status)
  }

  return payload as T
}

export async function requestVoid(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init)

  if (response.ok) {
    return
  }

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json() : await response.text()

  throw new ApiError(getErrorMessage(payload, response.status), response.status)
}
