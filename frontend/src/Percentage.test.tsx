import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import type { Operation } from './calculator/operation'
import { installFakeCalculatorService, type FakeFailure } from './test/fakeCalculatorService'
import { display, pendingOperationLine, press } from './test/keys'

const operation = (operator: Operation['operation'], a: number, b: number): Operation => ({
  operation: operator,
  operands: [a, b],
})

describe('Percentage key: phone-calculator convention (ADR-0002)', () => {
  it.each([
    {
      keys: '50 + 10 % =',
      known: [[operation('percentage', 10, 50), 5], [operation('add', 50, 5), 55]],
      shows: '55',
    },
    {
      keys: '50 − 10 % =',
      known: [[operation('percentage', 10, 50), 5], [operation('subtract', 50, 5), 45]],
      shows: '45',
    },
    {
      keys: '50 × 10 % =',
      known: [[operation('percentage', 10, 1), 0.1], [operation('multiply', 50, 0.1), 5]],
      shows: '5',
    },
    {
      keys: '50 ÷ 10 % =',
      known: [[operation('percentage', 10, 1), 0.1], [operation('divide', 50, 0.1), 500]],
      shows: '500',
    },
    {
      keys: '10 %',
      known: [[operation('percentage', 10, 1), 0.1]],
      shows: '0.1',
    },
  ] as Array<{ keys: string; known: Array<[Operation, number]>; shows: string }>)(
    '$keys → $shows',
    async ({ keys, known, shows }) => {
      const service = installFakeCalculatorService(known)
      const user = userEvent.setup()
      render(<App />)

      await press(user, keys)

      expect(display()).toHaveTextContent(new RegExp(`^${shows.replace('.', '\\.')}$`))
      expect(service.received).toEqual(known.map(([sent]) => sent))
    },
  )

  it('shows the percentage as the right Operand while the Pending Operation stays', async () => {
    installFakeCalculatorService([[operation('percentage', 10, 50), 5]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '50 + 10 %')

    expect(display()).toHaveTextContent(/^5$/)
    expect(pendingOperationLine()).toHaveTextContent('50 +')
  })

  it('resolves the Pending Operation when an Operator follows %', async () => {
    const service = installFakeCalculatorService([
      [operation('percentage', 10, 50), 5],
      [operation('add', 50, 5), 55],
    ])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '50 + 10 % ×')

    expect(display()).toHaveTextContent(/^55$/)
    expect(pendingOperationLine()).toHaveTextContent('55 ×')
    expect(service.received).toEqual([operation('percentage', 10, 50), operation('add', 50, 5)])
  })

  it('starts a new number when a digit follows %', async () => {
    installFakeCalculatorService([[operation('percentage', 10, 1), 0.1]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '10 % 7')

    expect(display()).toHaveTextContent(/^7$/)
  })

  it('ignores % while an error is shown', async () => {
    const divisionByZero: FakeFailure = { status: 422, code: 'DIVISION_BY_ZERO', message: 'Cannot divide by zero' }
    const service = installFakeCalculatorService([[operation('divide', 5, 0), divisionByZero]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '5 ÷ 0 = %')

    expect(display()).toHaveTextContent(/^Error$/)
    expect(service.received).toEqual([operation('divide', 5, 0)])
  })
})
