import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { installFakeCalculatorService, type FakeFailure } from './test/fakeCalculatorService'
import { display, pendingOperationLine, press } from './test/keys'
import { exactly, operation } from './test/operations'

const KEY_NAMES = [
  'clear',
  'backspace',
  'percent',
  'divide',
  '7',
  '8',
  '9',
  'multiply',
  '4',
  '5',
  '6',
  'subtract',
  '1',
  '2',
  '3',
  'add',
  'toggle sign',
  '0',
  'decimal point',
  'equals',
]

describe('Accessibility', () => {
  it('gives every key an accessible name, inside a named keypad group', () => {
    installFakeCalculatorService([])
    render(<App />)

    const keypad = screen.getByRole('group', { name: 'Keypad' })
    const names = Array.from(keypad.querySelectorAll('button')).map((key) => key.getAttribute('aria-label') ?? key.textContent)
    expect(names).toEqual(KEY_NAMES)
    for (const name of KEY_NAMES) expect(screen.getByRole('button', { name })).toBeInTheDocument()
  })

  it('announces the display politely and errors assertively', async () => {
    const divisionByZero: FakeFailure = { status: 422, code: 'DIVISION_BY_ZERO', message: 'Cannot divide by zero' }
    installFakeCalculatorService([[operation('divide', 5, 0), divisionByZero]])
    const user = userEvent.setup()
    render(<App />)

    expect(display()).toHaveAttribute('aria-live', 'polite')
    await press(user, '5 ÷ 0 =')

    expect(screen.getByRole('alert')).toHaveTextContent('Cannot divide by zero')
  })

  it('keeps an unavailable key reachable with Tab and explains it, but pressing it does nothing', async () => {
    installFakeCalculatorService([], { operators: [{ name: 'add', arity: 2 }] })
    const user = userEvent.setup()
    render(<App />)
    const divide = screen.getByRole('button', { name: 'divide' })
    await waitFor(() => expect(divide).toHaveAttribute('aria-disabled', 'true'))

    await user.tab() // clear
    await user.tab() // backspace
    await user.tab() // percent (also unavailable)
    await user.tab()
    expect(divide).toHaveFocus()
    expect(divide).toHaveAccessibleDescription('Not supported by the calculator service')

    await press(user, '8 ÷')
    expect(pendingOperationLine()).toBeEmptyDOMElement()
    expect(display()).toHaveTextContent(exactly('8'))
  })

  it('can be operated from the keyboard alone: Tab to a key, Space to press it', async () => {
    const service = installFakeCalculatorService([[operation('add', 2, 3), 5]])
    const user = userEvent.setup()
    render(<App />)

    screen.getByRole('button', { name: '2' }).focus()
    await user.keyboard(' ')
    screen.getByRole('button', { name: 'add' }).focus()
    await user.keyboard(' ')
    screen.getByRole('button', { name: '3' }).focus()
    await user.keyboard(' ')
    screen.getByRole('button', { name: 'equals' }).focus()
    await user.keyboard(' ')

    await waitFor(() => expect(display()).toHaveTextContent(exactly('5')))
    expect(service.received).toEqual([operation('add', 2, 3)])
  })
})
