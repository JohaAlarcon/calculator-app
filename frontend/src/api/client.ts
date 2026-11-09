import type { Operation, OperatorInfo } from '../calculator/operation'

interface OperationResponse extends Operation {
  result: number
}

/** The app always calls the relative `/api` base; a proxy forwards it to the service (ADR-0005). */
export const CALCULATE_URL = '/api/v1/calculate'
/** Lists the supported Operators (the path name is fixed by the API contract). */
export const OPERATORS_URL = '/api/v1/operations'

/** Evaluates one Operation on the service and returns its Result. */
export async function calculate(operation: Operation): Promise<number> {
  const body = await fetchJSON<OperationResponse>(CALCULATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(operation),
  })
  return body.result
}

/** Lists the Operators the service supports. */
export async function listOperators(signal?: AbortSignal): Promise<OperatorInfo[]> {
  const body = await fetchJSON<{ operations: OperatorInfo[] }>(OPERATORS_URL, { method: 'GET', signal })
  return body.operations
}

async function fetchJSON<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`Calculator service responded with ${response.status}`)
  }
  return (await response.json()) as T
}
