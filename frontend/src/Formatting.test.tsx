import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { exactly, operation } from './test/operations'
import { installFakeCalculatorService } from './test/fakeCalculatorService'
import { display, pendingOperationLine, press } from './test/keys'



describe('Entry limits', () => {
  it.each([
    { scenario: 'caps an integer at 15 significant digits', keys: '1234567890123456789', shows: '123456789012345' },
    { scenario: 'counts digits after the decimal point', keys: '1 . 23456789012345678', shows: '1.23456789012345' },
    {
      scenario: 'does not count leading zeros as significant',
      keys: '0 . 000123456789012345678',
      shows: '0.000123456789012345',
    },
    { scenario: 'caps a negative number the same way', keys: '1234567890123456789 ±', shows: '-123456789012345' },
    { scenario: 'allows only one decimal point', keys: '1 . 2 . 3', shows: '1.23' },
    { scenario: 'shows a leading zero before the decimal point', keys: '. 5', shows: '0.5' },
    { scenario: 'normalises leading zeros', keys: '0 0 7', shows: '7' },
    {
      scenario: 'caps the length, as zeros after the point are not significant',
      keys: '0 . 0000000000000000000000000001',
      shows: '0.0000000000000000000',
    },
    { scenario: 'deletes back from the cap', keys: '1234567890123456789 ⌫', shows: '12345678901234' },
  ])('$scenario: $keys → $shows', async ({ keys, shows }) => {
    installFakeCalculatorService([])
    const user = userEvent.setup()
    render(<App />)

    await press(user, keys)

    expect(display()).toHaveTextContent(exactly(shows))
  })

  it('sends the capped number as the Operand', async () => {
    const service = installFakeCalculatorService([[operation('add', 123456789012345, 1), 123456789012346]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '1234567890123456789 + 1 =')

    expect(service.received).toEqual([operation('add', 123456789012345, 1)])
  })

  it('sends .5 as 0.5', async () => {
    const service = installFakeCalculatorService([[operation('add', 0.5, 1), 1.5]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '. 5 + 1 =')

    expect(service.received).toEqual([operation('add', 0.5, 1)])
  })
})

describe('Result formatting', () => {
  it.each([
    { scenario: 'hides floating-point noise', keys: '0 . 1 + 0 . 2 =', sent: operation('add', 0.1, 0.2), raw: 0.30000000000000004, shows: '0.3' },
    { scenario: 'rounds to 12 significant digits', keys: '2 ÷ 3 =', sent: operation('divide', 2, 3), raw: 0.6666666666666666, shows: '0.666666666667' },
    { scenario: 'shows 12-digit integers in full', keys: '123456789012 × 1 =', sent: operation('multiply', 123456789012, 1), raw: 123456789012, shows: '123456789012' },
    { scenario: 'switches huge Results to exponent notation', keys: '123456789 × 1000000 =', sent: operation('multiply', 123456789, 1000000), raw: 123456789000000, shows: '1.23456789e+14' },
    { scenario: 'rounds the mantissa too', keys: '123456789012345 × 1000000000 =', sent: operation('multiply', 123456789012345, 1000000000), raw: 1.23456789012345e23, shows: '1.23456789012e+23' },
    { scenario: 'switches tiny Results to exponent notation', keys: '1 ÷ 10000000 =', sent: operation('divide', 1, 10000000), raw: 1e-7, shows: '1e-7' },
    { scenario: 'keeps small Results down to a millionth in plain notation', keys: '1 ÷ 1000000 =', sent: operation('divide', 1, 1000000), raw: 0.000001, shows: '0.000001' },
    { scenario: 'never shows negative zero', keys: '0 × 5 ± =', sent: operation('multiply', 0, -5), raw: -0, shows: '0' },
  ])('$scenario: $keys → $shows', async ({ keys, sent, raw, shows }) => {
    installFakeCalculatorService([[sent, raw]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, keys)

    expect(display()).toHaveTextContent(exactly(shows))
  })

  it('formats the running Result and the Pending Operation line', async () => {
    installFakeCalculatorService([[operation('add', 0.1, 0.2), 0.30000000000000004]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '0 . 1 + 0 . 2 ×')

    expect(display()).toHaveTextContent(exactly('0.3'))
    expect(pendingOperationLine()).toHaveTextContent(exactly('0.3 ×'))
  })

  it('keeps calculating with the raw Result, not the rounded one shown', async () => {
    const service = installFakeCalculatorService([
      [operation('add', 0.1, 0.2), 0.30000000000000004],
      [operation('multiply', 0.30000000000000004, 10), 3.0000000000000004],
    ])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '0 . 1 + 0 . 2 = × 10 =')

    expect(service.received[1]).toEqual(operation('multiply', 0.30000000000000004, 10))
    expect(display()).toHaveTextContent(exactly('3'))
  })

  it('shows a typed number in full, even with more than 12 digits', async () => {
    installFakeCalculatorService([])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '123456789012345 +')

    expect(display()).toHaveTextContent(exactly('123456789012345'))
    expect(pendingOperationLine()).toHaveTextContent(exactly('123456789012345 +'))
  })

  it('rounds negative tiny Results too', async () => {
    installFakeCalculatorService([[operation('multiply', 2, -1), -1.2345678901234e-100]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '2 × 1 ± =')

    expect(display()).toHaveTextContent(exactly('-1.23456789012e-100'))
  })

  it('negates a rounded Result and keeps it rounded', async () => {
    installFakeCalculatorService([[operation('add', 0.1, 0.2), 0.30000000000000004]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '0 . 1 + 0 . 2 = ±')

    expect(display()).toHaveTextContent(exactly('-0.3'))
  })

  it.each([
    { keys: '5 . +', pending: '5 +' },
    { keys: '± +', pending: '0 +' },
    { keys: '0 . 50 +', pending: '0.5 +' },
  ])('normalises a typed left Operand in the Pending Operation line: $keys → $pending', async ({ keys, pending }) => {
    installFakeCalculatorService([])
    const user = userEvent.setup()
    render(<App />)

    await press(user, keys)

    expect(pendingOperationLine()).toHaveTextContent(exactly(pending))
  })
})
