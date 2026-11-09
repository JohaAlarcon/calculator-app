import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import type { Operation } from './calculator/operation'
import { operation } from './test/operations'
import { installFakeCalculatorService } from './test/fakeCalculatorService'
import { display, pendingOperationLine, press } from './test/keys'


describe('Chain edge keys', () => {
  it.each([
    {
      scenario: 'the missing right Operand defaults to the left one',
      keys: '5 + =',
      known: [[operation('add', 5, 5), 10]],
      shows: '10',
    },
    {
      scenario: 'repeated = re-applies the Last Operation',
      keys: '2 + 3 = = =',
      known: [[operation('add', 2, 3), 5], [operation('add', 5, 3), 8], [operation('add', 8, 3), 11]],
      shows: '11',
    },
    {
      scenario: 'repeated = after a defaulted right Operand',
      keys: '5 + = =',
      known: [[operation('add', 5, 5), 10], [operation('add', 10, 5), 15]],
      shows: '15',
    },
    {
      scenario: 'repeated = keeps the Operand order for − and ÷',
      keys: '20 ÷ 2 = =',
      known: [[operation('divide', 20, 2), 10], [operation('divide', 10, 2), 5]],
      shows: '5',
    },
    {
      scenario: 'a digit after a Result starts a fresh Chain',
      keys: '2 + 3 = 7 + 1 =',
      known: [[operation('add', 2, 3), 5], [operation('add', 7, 1), 8]],
      shows: '8',
    },
    {
      scenario: 'an Operator after a Result continues from it',
      keys: '2 + 3 = + 1 =',
      known: [[operation('add', 2, 3), 5], [operation('add', 5, 1), 6]],
      shows: '6',
    },
  ] as Array<{ scenario: string; keys: string; known: Array<[Operation, number]>; shows: string }>)(
    '$scenario: $keys → $shows',
    async ({ keys, known, shows }) => {
      const service = installFakeCalculatorService(known)
      const user = userEvent.setup()
      render(<App />)

      await press(user, keys)

      expect(display()).toHaveTextContent(new RegExp(`^${shows}$`))
      expect(service.received).toEqual(known.map(([sent]) => sent))
    },
  )

  it('shows the typed digit, not the Result, when a fresh Chain starts', async () => {
    installFakeCalculatorService([[operation('add', 2, 3), 5]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '2 + 3 = 7')

    expect(display()).toHaveTextContent(/^7$/)
    expect(pendingOperationLine()).toBeEmptyDOMElement()
  })

  it('forgets the Last Operation once a fresh Chain starts', async () => {
    const service = installFakeCalculatorService([[operation('add', 2, 3), 5]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '2 + 3 = 7 =')

    expect(display()).toHaveTextContent(/^7$/)
    expect(service.received).toEqual([operation('add', 2, 3)])
  })

  it.each(['=', '4 =', '4 = ='])('= with no Pending Operation and no Last Operation does nothing (%s)', async (keys) => {
    const service = installFakeCalculatorService([])
    const user = userEvent.setup()
    render(<App />)

    await press(user, keys)

    expect(display()).toHaveTextContent(keys === '=' ? /^0$/ : /^4$/)
    expect(service.received).toEqual([])
  })

  it('C forgets the Last Operation', async () => {
    const service = installFakeCalculatorService([[operation('add', 2, 3), 5]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '2 + 3 = C =')

    expect(display()).toHaveTextContent(/^0$/)
    expect(service.received).toEqual([operation('add', 2, 3)])
  })
})
