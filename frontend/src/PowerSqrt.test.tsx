import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import type { Operation } from './calculator/operation'
import { installFakeCalculatorService } from './test/fakeCalculatorService'
import { display, pendingOperationLine, press } from './test/keys'
import { exactly, operation } from './test/operations'

const squareRoot = (radicand: number): Operation => ({ operation: 'sqrt', operands: [radicand] })
const invalidOperand = { status: 422, code: 'INVALID_OPERAND', message: 'Result is not a real number' }
const divisionByZero = { status: 422, code: 'DIVISION_BY_ZERO', message: 'Cannot divide by zero' }

describe('Power and square root', () => {
  it.each([
    { keys: '2 xʸ 10 =', known: [[operation('power', 2, 10), 1024]], shows: '1024' },
    {
      keys: '2 xʸ 3 xʸ 2 =',
      known: [[operation('power', 2, 3), 8], [operation('power', 8, 2), 64]],
      shows: '64',
    },
    { keys: '9 √', known: [[squareRoot(9), 3]], shows: '3' },
    { keys: '16 + 9 √ =', known: [[squareRoot(9), 3], [operation('add', 16, 3), 19]], shows: '19' },
    { keys: '2 + 7 = √', known: [[operation('add', 2, 7), 9], [squareRoot(9), 3]], shows: '3' },
    { keys: '9 + √ =', known: [[squareRoot(9), 3], [operation('add', 9, 3), 12]], shows: '12' },
    {
      keys: '2 xʸ 3 = =',
      known: [[operation('power', 2, 3), 8], [operation('power', 8, 3), 512]],
      shows: '512',
    },
    { keys: '2 + xʸ 3 =', known: [[operation('power', 2, 3), 8]], shows: '8' },
    {
      keys: '2 + 7 = √ =',
      known: [[operation('add', 2, 7), 9], [squareRoot(9), 3], [operation('add', 3, 7), 10]],
      shows: '10',
    },
  ] as Array<{ keys: string; known: Array<[Operation, number]>; shows: string }>)(
    '$keys → $shows',
    async ({ keys, known, shows }) => {
      const service = installFakeCalculatorService(known)
      const user = userEvent.setup()
      render(<App />)

      await press(user, keys)

      expect(display()).toHaveTextContent(exactly(shows))
      expect(service.received).toEqual(known.map(([sent]) => sent))
    },
  )

  it('takes the square root at once, keeping the Pending Operation', async () => {
    installFakeCalculatorService([[squareRoot(9), 3]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '16 + 9 √')

    expect(display()).toHaveTextContent(exactly('3'))
    expect(pendingOperationLine()).toHaveTextContent(exactly('16 +'))
  })

  it('shows a pending power with ^', async () => {
    installFakeCalculatorService([])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '2 xʸ')

    expect(pendingOperationLine()).toHaveTextContent(exactly('2 ^'))
  })

  it('raises to a power from the keyboard with ^', async () => {
    const service = installFakeCalculatorService([[operation('power', 2, 10), 1024]])
    const user = userEvent.setup()
    render(<App />)

    await user.keyboard('2^10{Enter}')

    await waitFor(() => expect(display()).toHaveTextContent(exactly('1024')))
    expect(service.received).toEqual([operation('power', 2, 10)])
  })

  it.each([
    { keys: '4 ± √', sent: squareRoot(-4), failure: invalidOperand },
    { keys: '8 ± xʸ 0 . 5 =', sent: operation('power', -8, 0.5), failure: invalidOperand },
    { keys: '0 xʸ 1 ± =', sent: operation('power', 0, -1), failure: divisionByZero },
    {
      keys: '10 xʸ 400 =',
      sent: operation('power', 10, 400),
      failure: { status: 422, code: 'OVERFLOW', message: 'Result is too large' },
    },
  ])('shows the Math Error for $keys', async ({ keys, sent, failure }) => {
    installFakeCalculatorService([[sent, failure]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, keys)

    expect(display()).toHaveTextContent(exactly('Error'))
    expect(screen.getByRole('alert')).toHaveTextContent(failure.message)
  })

  it('ignores √ while an error is shown', async () => {
    const service = installFakeCalculatorService([[operation('divide', 5, 0), divisionByZero]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '5 ÷ 0 = √')

    expect(display()).toHaveTextContent(exactly('Error'))
    expect(service.received).toEqual([operation('divide', 5, 0)])
  })

  it.each(['power', 'square root'])('marks the %s key unavailable when the service lacks it', async (name) => {
    installFakeCalculatorService([], { operators: [{ name: 'add', arity: 2 }] })
    render(<App />)

    await waitFor(() => expect(screen.getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true'))
  })
})
