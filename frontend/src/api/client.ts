import type { Operation, OperatorInfo } from '../calculator/operation'

interface OperationResponse extends Operation {
  result: number
}

/** The app always calls the relative `/api` base; a proxy forwards it to the service (ADR-0005). */
export const CALCULATE_URL = '/api/v1/calculate'
/** Lists the supported Operators (the path name is fixed by the API contract). */
export const OPERATORS_URL = '/api/v1/operations'

/**
 * What happened to an Operation sent to the service:
 * - `result`: it was evaluated;
 * - `rejected`: the service refused it (a Math Error or an Invalid Request), with its code and message;
 * - `unavailable`: no usable answer (network failure, 5xx, or an unreadable response).
 */
export type OperationOutcome =
  | { kind: 'result'; result: number }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unavailable' }

const UNAVAILABLE: OperationOutcome = { kind: 'unavailable' }

/** How long an Operation may take before the service counts as unavailable (the keypad is locked meanwhile). */
export const REQUEST_TIMEOUT_MS = 10_000

/** Evaluates one Operation on the service. Never throws: failures come back as an outcome. */
export async function calculate(operation: Operation): Promise<OperationOutcome> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(CALCULATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(operation),
      signal: controller.signal,
    })
  } catch {
    return UNAVAILABLE // network failure or timeout
  } finally {
    clearTimeout(timer)
  }
  const body: unknown = await response.json().catch(() => null)
  if (response.ok && isOperationResponse(body)) {
    return { kind: 'result', result: body.result }
  }
  // A 4xx with the service's JSON error is a refusal; anything else (e.g. a proxy's HTML page) is unavailability.
  if (response.status >= 400 && response.status < 500 && isErrorResponse(body)) {
    return { kind: 'rejected', code: body.error.code, message: body.error.message }
  }
  return UNAVAILABLE
}

function isOperationResponse(body: unknown): body is OperationResponse {
  return typeof (body as OperationResponse | null)?.result === 'number'
}

interface ErrorResponse {
  error: { code: string; message: string }
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  const error = (body as ErrorResponse | null)?.error
  return typeof error?.code === 'string' && typeof error.message === 'string'
}

/** Lists the Operators the service supports. */
export async function listOperators(signal?: AbortSignal): Promise<OperatorInfo[]> {
  const body = await fetchJSON<{ operations?: unknown }>(OPERATORS_URL, { method: 'GET', signal })
  if (!Array.isArray(body.operations)) {
    throw new Error('Calculator service returned no Operator list')
  }
  return body.operations as OperatorInfo[]
}

async function fetchJSON<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`Calculator service responded with ${response.status}`)
  }
  return (await response.json()) as T
}
