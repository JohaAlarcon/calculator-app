import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import type { Operation } from './calculator/operation'
import { installFakeCalculatorService, type FakeFailure } from './test/fakeCalculatorService'
import { display, pendingOperationLine, press } from './test/keys'
import { exactly, operation } from './test/operations'

describe('Keyboard input', () => {
  it.each([
    { keys: '12/4{Enter}', known: [[operation('divide', 12, 4), 3]], shows: '3' },
    { keys: '2+3*4=', known: [[operation('add', 2, 3), 5], [operation('multiply', 5, 4), 20]], shows: '20' },
    { keys: '10-4-3{Enter}', known: [[operation('subtract', 10, 4), 6], [operation('subtract', 6, 3), 3]], shows: '3' },
    { keys: '1.5+2{Enter}', known: [[operation('add', 1.5, 2), 3.5]], shows: '3.5' },
    {
      keys: '50+10%{Enter}',
      known: [[operation('percentage', 10, 50), 5], [operation('add', 50, 5), 55]],
      shows: '55',
    },
    { keys: '123{Backspace}', known: [], shows: '12' },
  ] as Array<{ keys: string; known: Array<[Operation, number]>; shows: string }>)(
    'types $keys → $shows',
    async ({ keys, known, shows }) => {
      const service = installFakeCalculatorService(known)
      const user = userEvent.setup()
      render(<App />)

      await user.keyboard(keys)

      await waitFor(() => expect(display()).toHaveTextContent(exactly(shows)))
      expect(service.received).toEqual(known.map(([sent]) => sent))
    },
  )

  it('clears with Escape, including an error', async () => {
    const divisionByZero: FakeFailure = { status: 422, code: 'DIVISION_BY_ZERO', message: 'Cannot divide by zero' }
    installFakeCalculatorService([[operation('divide', 5, 0), divisionByZero]])
    const user = userEvent.setup()
    render(<App />)

    await user.keyboard('5/0{Enter}')
    await waitFor(() => expect(display()).toHaveTextContent(exactly('Error')))
    await user.keyboard('{Escape}')

    expect(display()).toHaveTextContent(exactly('0'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(pendingOperationLine()).toBeEmptyDOMElement()
  })

  it('treats Enter as = even while a key has focus (no extra digit)', async () => {
    const service = installFakeCalculatorService([[operation('add', 2, 3), 5]])
    const user = userEvent.setup()
    render(<App />)

    await press(user, '2 + 3') // the "3" key keeps focus
    await user.keyboard('{Enter}')

    await waitFor(() => expect(display()).toHaveTextContent(exactly('5')))
    expect(service.received).toEqual([operation('add', 2, 3)])
  })

  it('ignores keys pressed with Ctrl, Cmd or Alt (browser shortcuts)', async () => {
    installFakeCalculatorService([])
    const user = userEvent.setup()
    render(<App />)

    await user.keyboard('{Meta>}1{/Meta}{Control>}2{/Control}{Alt>}3{/Alt}')

    expect(display()).toHaveTextContent(exactly('0'))
  })

  it('applies keys typed while an Operation is in flight once its Result arrives, in order', async () => {
    const service = installFakeCalculatorService([
      [operation('add', 2, 3), 5],
      [operation('multiply', 5, 4), 20],
    ])
    const user = userEvent.setup()
    render(<App />)
    await user.keyboard('2+3')

    service.hold()
    await user.keyboard('*4{Enter}') // typed while 2 + 3 is still with the service
    expect(service.received).toEqual([operation('add', 2, 3)])
    service.release()

    await waitFor(() => expect(display()).toHaveTextContent(exactly('20')))
    expect(service.received).toEqual([operation('add', 2, 3), operation('multiply', 5, 4)])
  })

  it.each([
    { scenario: 'a key that changes nothing (a second decimal point)', during: '..5', shows: '0.5' },
    { scenario: 'an unsupported Operator', during: '/7', shows: '7' },
  ])('keeps replaying queued keys after $scenario', async ({ during, shows }) => {
    const service = installFakeCalculatorService([[operation('add', 1, 2), 3]], {
      operators: [
        { name: 'add', arity: 2 },
        { name: 'percentage', arity: 2 },
      ],
    })
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'divide' })).toHaveAttribute('aria-disabled', 'true'))
    await user.keyboard('1+2')

    service.hold()
    await user.keyboard(`{Enter}${during}`)
    service.release()

    await waitFor(() => expect(display()).toHaveTextContent(exactly(shows)))
  })

  it('drops keys queued behind an Operation that fails, so the error is seen', async () => {
    const divisionByZero: FakeFailure = { status: 422, code: 'DIVISION_BY_ZERO', message: 'Cannot divide by zero' }
    const service = installFakeCalculatorService([[operation('divide', 5, 0), divisionByZero]])
    const user = userEvent.setup()
    render(<App />)
    await user.keyboard('5/0')

    service.hold()
    await user.keyboard('{Enter}7')
    service.release()

    await waitFor(() => expect(display()).toHaveTextContent(exactly('Error')))
    expect(service.received).toEqual([operation('divide', 5, 0)])
  })

  it('ignores an Operator key the service does not support', async () => {
    installFakeCalculatorService([], { operators: [{ name: 'add', arity: 2 }] })
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'divide' })).toHaveAttribute('aria-disabled', 'true'))

    await user.keyboard('8/2')

    expect(display()).toHaveTextContent(exactly('82'))
    expect(pendingOperationLine()).toBeEmptyDOMElement()
  })
})
