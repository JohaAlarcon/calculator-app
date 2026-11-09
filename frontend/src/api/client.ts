import type { Operation } from '../calculator/operation'

interface OperationResponse extends Operation {
  result: number
}

/** The app always calls the relative `/api` base; a proxy forwards it to the service (ADR-0005). */
export const CALCULATE_URL = '/api/v1/calculate'

/** Evaluates one Operation on the service and returns its Result. */
export async function calculate(operation: Operation): Promise<number> {
  const response = await fetch(CALCULATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(operation),
  })
  if (!response.ok) {
    throw new Error(`Calculator service responded with ${response.status}`)
  }
  const body = (await response.json()) as OperationResponse
  return body.result
}
