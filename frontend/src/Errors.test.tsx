import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { REQUEST_TIMEOUT_MS } from './api/client'
import type { Operation } from './calculator/operation'
import { installFakeCalculatorService, type FakeFailure } from './test/fakeCalculatorService'
import { display, pendingOperationLine, press } from './test/keys'

const operation = (operator: Operation['operation'], a: number, b: number): Operation => ({
  operation: operator,
  operands: [a, b],
})
const divisionByZero: FakeFailure = { status: 422, code: 'DIVISION_BY_ZERO', message: 'Cannot divide by zero' }
const errorBanner = () => screen.queryByRole('alert')

describe('Math Errors and Invalid Requests (ADR-0004)', () => {
  it("shows Error and the service's message, keeping the input before the failed Operation", async () => {
    installFakeCalculatorService([[operation('divide', 5, 0), divisionByZero]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '5 ÷ 0 =')

    expect(display()).toHaveTextContent(/^Error$/)
    expect(errorBanner()).toHaveTextContent('Cannot divide by zero')
    expect(pendingOperationLine()).toHaveTextContent('5 ÷')
  })

  it('clears the error on the next digit and continues the preserved Pending Operation', async () => {
    const service = installFakeCalculatorService([
      [operation('divide', 5, 0), divisionByZero],
      [operation('divide', 5, 2), 2.5],
    ])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '5 ÷ 0 =')
    expect(errorBanner()).toBeInTheDocument()
    await press(user, '2')
    expect(errorBanner()).not.toBeInTheDocument()
    expect(display()).toHaveTextContent(/^2$/)
    await press(user, '=')

    expect(display()).toHaveTextContent(/^2\.5$/)
    expect(service.received).toEqual([operation('divide', 5, 0), operation('divide', 5, 2)])
  })

  it('clears the error and the Chain on C', async () => {
    installFakeCalculatorService([[operation('divide', 5, 0), divisionByZero]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '5 ÷ 0 =')
    expect(errorBanner()).toBeInTheDocument()
    await press(user, 'C')

    expect(errorBanner()).not.toBeInTheDocument()
    expect(display()).toHaveTextContent(/^0$/)
    expect(pendingOperationLine()).toBeEmptyDOMElement()
  })

  it('shows the error when resolving a Pending Operation on the next Operator', async () => {
    installFakeCalculatorService([[operation('divide', 5, 0), divisionByZero]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '5 ÷ 0 +')

    expect(display()).toHaveTextContent(/^Error$/)
    expect(errorBanner()).toHaveTextContent('Cannot divide by zero')
    expect(pendingOperationLine()).toHaveTextContent('5 ÷') // the Chain before the failed Operation
  })

  it('ignores Operators, ± and ⌫ while an error is shown, so no input is dropped silently', async () => {
    const service = installFakeCalculatorService([[operation('divide', 5, 0), divisionByZero]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '5 ÷ 0 = × ± ⌫')

    expect(display()).toHaveTextContent(/^Error$/)
    expect(errorBanner()).toHaveTextContent('Cannot divide by zero')
    expect(pendingOperationLine()).toHaveTextContent('5 ÷')
    expect(service.received).toEqual([operation('divide', 5, 0)])
  })

  it('starts a new right Operand with the decimal point after an error', async () => {
    installFakeCalculatorService([[operation('divide', 5, 0), divisionByZero]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '5 ÷ 0 = .')

    expect(errorBanner()).not.toBeInTheDocument()
    expect(display()).toHaveTextContent(/^0\.$/)
  })

  it("shows an Invalid Request's message from the service", async () => {
    installFakeCalculatorService([
      [operation('add', 1, 2), { status: 400, code: 'UNKNOWN_OPERATION', message: 'Unknown operation "add"' }],
    ])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '1 + 2 =')

    expect(display()).toHaveTextContent(/^Error$/)
    expect(errorBanner()).toHaveTextContent('Unknown operation "add"')
  })
})

describe('Service unavailable', () => {
  it.each([
    { scenario: 'a 5xx response', failure: { status: 503, code: 'UNAVAILABLE', message: 'upstream down' } },
    { scenario: 'a network failure', failure: 'unreachable' },
  ] as Array<{ scenario: string; failure: FakeFailure }>)(
    'shows "Calculator service unavailable" on $scenario and retries with the same input',
    async ({ failure }) => {
      // The known answer is changed between presses to simulate the service recovering.
      const known: Array<[Operation, number | FakeFailure]> = [[operation('add', 2, 3), failure]]
      const service = installFakeCalculatorService(known)
      const user = userEvent.setup()
      render(<App />)

      await press(user, '2 + 3 =')
      expect(display()).toHaveTextContent(/^Error$/)
      expect(errorBanner()).toHaveTextContent('Calculator service unavailable')
      expect(errorBanner()).not.toHaveTextContent('upstream down')

      known[0][1] = 5
      await press(user, '=')

      expect(display()).toHaveTextContent(/^5$/)
      expect(errorBanner()).not.toBeInTheDocument()
      expect(service.received).toEqual([operation('add', 2, 3), operation('add', 2, 3)])
    },
  )
})

describe('In-flight lock', () => {
  it('disables the keys while an Operation is in flight, so a double-tap sends one request', async () => {
    const service = installFakeCalculatorService([[operation('add', 2, 3), 5]])
    const user = userEvent.setup()
    render(<App />)
    await press(user, '2 + 3')

    service.hold()
    await press(user, '=')
    const equals = screen.getByRole('button', { name: 'equals' })
    expect(equals).toBeDisabled()
    expect(screen.getByRole('button', { name: '7' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'clear' })).toBeDisabled()
    await user.click(equals)

    service.release()
    await waitFor(() => expect(display()).toHaveTextContent(/^5$/))
    expect(equals).toBeEnabled()
    expect(service.received).toEqual([operation('add', 2, 3)])
  })
})

describe('Request timeout', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('gives up on a hung Operation, shows the service as unavailable and unlocks the keys', async () => {
    const service = installFakeCalculatorService([[operation('add', 2, 3), 5]])
    const user = userEvent.setup()
    render(<App />)
    await press(user, '2 + 3')

    service.hold() // never released: the service hangs
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fireEvent.click(screen.getByRole('button', { name: 'equals' }))
    expect(screen.getByRole('button', { name: 'equals' })).toBeDisabled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    })

    expect(errorBanner()).toHaveTextContent('Calculator service unavailable')
    expect(display()).toHaveTextContent(/^Error$/)
    expect(screen.getByRole('button', { name: 'equals' })).toBeEnabled()
    expect(pendingOperationLine()).toHaveTextContent('2 +')
  })
})
