import { vi } from 'vitest'
import { CALCULATE_URL, OPERATORS_URL } from '../api/client'
import type { Operation, OperatorInfo } from '../calculator/operation'

interface FakeServiceOptions {
  /**
   * How the Operator list request is answered: the supported Operators, `'unavailable'` for an
   * HTTP 503, or `'unreachable'` for a network failure (fetch rejects).
   */
  operators?: OperatorInfo[] | 'unavailable' | 'unreachable'
}

/**
 * A fake of the calculator service at the `fetch` boundary.
 * Results come from a table of known Operations (independent source of truth),
 * so the fake never re-implements the arithmetic it is standing in for.
 */
export function installFakeCalculatorService(
  known: Array<[Operation, number]>,
  { operators = [{ name: 'add', arity: 2 }] }: FakeServiceOptions = {},
) {
  const received: Operation[] = []
  let operatorListRequests = 0
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (url === OPERATORS_URL && method === 'GET') {
      operatorListRequests++
      if (operators === 'unreachable') throw new TypeError('Failed to fetch')
      if (operators === 'unavailable') {
        return jsonResponse(503, { error: { code: 'UNAVAILABLE', message: 'unavailable' } })
      }
      return jsonResponse(200, { operations: operators })
    }
    if (url !== CALCULATE_URL || method !== 'POST') {
      return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'not found' } })
    }
    const body = JSON.parse(String(init?.body)) as Operation
    received.push(body)
    const match = known.find(
      ([req]) => req.operation === body.operation && JSON.stringify(req.operands) === JSON.stringify(body.operands),
    )
    if (!match) throw new Error(`fake service has no answer for ${JSON.stringify(body)}`)
    return jsonResponse(200, { ...body, result: match[1] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    received,
    get operatorListRequests() {
      return operatorListRequests
    },
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
