import { vi } from 'vitest'
import { CALCULATE_URL } from '../api/client'
import type { Operation } from '../calculator/operation'

/**
 * A fake of the calculator service at the `fetch` boundary.
 * Results come from a table of known Operations (independent source of truth),
 * so the fake never re-implements the arithmetic it is standing in for.
 */
export function installFakeCalculatorService(known: Array<[Operation, number]>) {
  const received: Operation[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url !== CALCULATE_URL || init?.method !== 'POST') {
      return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'not found' } })
    }
    const body = JSON.parse(String(init.body)) as Operation
    received.push(body)
    const match = known.find(
      ([req]) => req.operation === body.operation && JSON.stringify(req.operands) === JSON.stringify(body.operands),
    )
    if (!match) throw new Error(`fake service has no answer for ${JSON.stringify(body)}`)
    return jsonResponse(200, { ...body, result: match[1] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { received }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
