import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import type { Operation } from './calculator/operation'
import { operation } from './test/operations'
import { installFakeCalculatorService } from './test/fakeCalculatorService'
import { display, pendingOperationLine, press } from './test/keys'


describe('Chain: left-to-right immediate execution (ADR-0003)', () => {
  it.each([
    {
      keys: '12 ÷ 4 =',
      known: [[operation('divide', 12, 4), 3]],
      shows: '3',
    },
    {
      keys: '2 + 3 × 4 =',
      known: [[operation('add', 2, 3), 5], [operation('multiply', 5, 4), 20]],
      shows: '20',
    },
    {
      keys: '10 − 4 − 3 =',
      known: [[operation('subtract', 10, 4), 6], [operation('subtract', 6, 3), 3]],
      shows: '3',
    },
  ] as Array<{ keys: string; known: Array<[Operation, number]>; shows: string }>)(
    '$keys → $shows',
    async ({ keys, known, shows }) => {
      const service = installFakeCalculatorService(known)
      const user = userEvent.setup()
      render(<App />)

      await press(user, keys)

      expect(display()).toHaveTextContent(new RegExp(`^${shows}$`))
      expect(service.received).toEqual(known.map(([sent]) => sent))
    },
  )

  it('shows the running Result as soon as the next Operator is pressed', async () => {
    installFakeCalculatorService([[operation('add', 2, 3), 5]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '2 + 3 ×')

    expect(display()).toHaveTextContent(/^5$/)
    expect(pendingOperationLine()).toHaveTextContent('5 ×')
  })

  it('shows the Pending Operation above the right Operand being typed', async () => {
    installFakeCalculatorService([])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '12 ÷')
    expect(pendingOperationLine()).toHaveTextContent('12 ÷')
    await press(user, '4')
    expect(pendingOperationLine()).toHaveTextContent('12 ÷')
    expect(display()).toHaveTextContent(/^4$/)
  })

  it('replaces the pending Operator when a second Operator is pressed, without a request', async () => {
    const service = installFakeCalculatorService([[operation('multiply', 2, 3), 6]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '2 + ×')
    expect(pendingOperationLine()).toHaveTextContent('2 ×')
    await press(user, '3 =')

    expect(display()).toHaveTextContent(/^6$/)
    expect(service.received).toEqual([operation('multiply', 2, 3)])
  })

  it('clears the Pending Operation line after =', async () => {
    installFakeCalculatorService([[operation('add', 2, 3), 5]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '2 + 3 =')

    expect(pendingOperationLine()).toBeEmptyDOMElement()
    expect(screen.getByRole('status', { name: 'display' })).toHaveTextContent(/^5$/)
  })
})

describe('Entry keys: decimal point, toggle sign, backspace', () => {
  it('types a decimal Operand and sends it', async () => {
    const service = installFakeCalculatorService([[operation('add', 1.5, 2), 3.5]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '1 . 5')
    expect(display()).toHaveTextContent(/^1\.5$/)
    await press(user, '+ 2 =')

    expect(display()).toHaveTextContent(/^3\.5$/)
    expect(service.received).toEqual([operation('add', 1.5, 2)])
  })

  it('starts a decimal right Operand with a leading zero', async () => {
    installFakeCalculatorService([])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '4 × .')
    expect(display()).toHaveTextContent(/^0\.$/)
  })

  it('toggles the sign of the number being typed', async () => {
    const service = installFakeCalculatorService([[operation('add', -5, 3), -2]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '5 ±')
    expect(display()).toHaveTextContent(/^-5$/)
    await press(user, '± ±')
    expect(display()).toHaveTextContent(/^-5$/)
    await press(user, '+ 3 =')

    expect(display()).toHaveTextContent(/^-2$/)
    expect(service.received).toEqual([operation('add', -5, 3)])
  })

  it('toggles the sign of a right Operand typed after an Operator', async () => {
    const service = installFakeCalculatorService([[operation('multiply', 6, -2), -12]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '6 × 2 ± =')

    expect(service.received).toEqual([operation('multiply', 6, -2)])
    expect(display()).toHaveTextContent(/^-12$/)
  })

  it('deletes the last typed digit, down to 0', async () => {
    installFakeCalculatorService([])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '1 2 3 ⌫')
    expect(display()).toHaveTextContent(/^12$/)
    await press(user, '⌫ ⌫ ⌫')
    expect(display()).toHaveTextContent(/^0$/)
    await press(user, '7 ± ⌫')
    expect(display()).toHaveTextContent(/^0$/)
  })

  it('does not edit a Result with backspace', async () => {
    installFakeCalculatorService([[operation('add', 12, 3), 15]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '12 + 3 = ⌫')
    expect(display()).toHaveTextContent(/^15$/)
  })
})
