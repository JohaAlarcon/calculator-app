import { vi } from 'vitest'
import { CALCULATE_URL, OPERATORS_URL } from '../api/client'
import type { Operation, OperatorInfo } from '../calculator/operation'

interface FakeServiceOptions {
  /**
   * How the Operator list request is answered: the supported Operators, `'unavailable'` for an
   * HTTP 503, `'unreachable'` for a network failure (fetch rejects), or `'malformed'` for a
   * 200 whose body has no `operations` list.
   */
  operators?: OperatorInfo[] | 'unavailable' | 'unreachable' | 'malformed'
}

const ALL_OPERATORS: OperatorInfo[] = [
  { name: 'add', arity: 2 },
  { name: 'divide', arity: 2 },
  { name: 'multiply', arity: 2 },
  { name: 'percentage', arity: 2 },
  { name: 'power', arity: 2 },
  { name: 'sqrt', arity: 1 },
  { name: 'subtract', arity: 2 },
]

/** How the fake answers a known Operation that does not succeed. */
export type FakeFailure = { status: number; code: string; message: string } | 'unreachable'

/**
 * A fake of the calculator service at the `fetch` boundary.
 * Results come from a table of known Operations (independent source of truth),
 * so the fake never re-implements the arithmetic it is standing in for.
 */
export function installFakeCalculatorService(
  known: Array<[Operation, number | FakeFailure]>,
  { operators = ALL_OPERATORS }: FakeServiceOptions = {},
) {
  const received: Operation[] = []
  let operatorListRequests = 0
  let held: Promise<void> | null = null
  let release = () => {}
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (url === OPERATORS_URL && method === 'GET') {
      operatorListRequests++
      if (operators === 'unreachable') throw new TypeError('Failed to fetch')
      if (operators === 'unavailable') {
        return jsonResponse(503, { error: { code: 'UNAVAILABLE', message: 'unavailable' } })
      }
      if (operators === 'malformed') return jsonResponse(200, { status: 'ok' })
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
    if (held) await untilReleasedOrAborted(held, init?.signal)
    const answer = match[1]
    if (answer === 'unreachable') throw new TypeError('Failed to fetch')
    if (typeof answer === 'number') return jsonResponse(200, { ...body, result: answer })
    return jsonResponse(answer.status, { error: { code: answer.code, message: answer.message } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    received,
    get operatorListRequests() {
      return operatorListRequests
    },
    /** Keeps every calculate request in flight until `release()` is called. */
    hold() {
      held = new Promise((resolve) => {
        release = () => {
          held = null
          resolve()
        }
      })
    },
    release: () => release(),
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Waits for a held request to be released, or rejects like fetch does when the request is aborted. */
function untilReleasedOrAborted(held: Promise<void>, signal: AbortSignal | null | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    void held.then(resolve)
    signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
  })
}
