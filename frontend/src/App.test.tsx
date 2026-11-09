import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { installFakeCalculatorService } from './test/fakeCalculatorService'

describe('Calculator', () => {
  it('evaluates an add Operation through the service and displays the Result', async () => {
    const service = installFakeCalculatorService([[{ operation: 'add', operands: [2, 3] }, 5]])
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: 'add' }))
    await user.click(screen.getByRole('button', { name: '3' }))
    await user.click(screen.getByRole('button', { name: 'equals' }))

    expect(await screen.findByRole('status', { name: 'display' })).toHaveTextContent('5')
    expect(service.received).toEqual([{ operation: 'add', operands: [2, 3] }])
  })

  it('shows 0 initially and clears back to 0', async () => {
    installFakeCalculatorService([])
    const user = userEvent.setup()
    render(<App />)

    const display = screen.getByRole('status', { name: 'display' })
    expect(display).toHaveTextContent('0')
    await user.click(screen.getByRole('button', { name: '7' }))
    expect(display).toHaveTextContent('7')
    await user.click(screen.getByRole('button', { name: 'clear' }))
    expect(display).toHaveTextContent('0')
  })
})
