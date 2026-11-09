import { act, render, screen, waitFor } from '@testing-library/react'
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

  describe('Operator availability (drift check)', () => {
    it('disables a key whose Operator the service does not list, with an explanatory tooltip', async () => {
      const service = installFakeCalculatorService([], { operators: [] })
      render(<App />)

      const add = screen.getByRole('button', { name: 'add' })
      await waitFor(() => expect(add).toBeDisabled())
      expect(add).toHaveAttribute('title', 'Not supported by the calculator service')
      expect(screen.getByRole('button', { name: '7' })).toBeEnabled()
      expect(service.operatorListRequests).toBe(1)
    })

    it('keeps every key enabled and usable when the Operator list cannot be fetched', async () => {
      const service = installFakeCalculatorService([[{ operation: 'add', operands: [2, 3] }, 5]], {
        operators: 'unavailable',
      })
      const user = userEvent.setup()
      render(<App />)

      await operatorListProcessed(service)
      const add = screen.getByRole('button', { name: 'add' })
      expect(add).toBeEnabled()
      expect(add).not.toHaveAttribute('title')

      await user.click(screen.getByRole('button', { name: '2' }))
      await user.click(add)
      await user.click(screen.getByRole('button', { name: '3' }))
      await user.click(screen.getByRole('button', { name: 'equals' }))
      expect(screen.getByRole('status', { name: 'display' })).toHaveTextContent('5')
    })

    it.each([
      { operators: 'unreachable', scenario: 'the service is unreachable' },
      { operators: 'malformed', scenario: 'the Operator list is malformed' },
    ] as const)('keeps every key enabled when $scenario', async ({ operators }) => {
      const service = installFakeCalculatorService([], { operators })
      render(<App />)

      await operatorListProcessed(service)
      expect(screen.getByRole('button', { name: 'add' })).toBeEnabled()
    })

    it('keeps listed Operators enabled', async () => {
      const service = installFakeCalculatorService([])
      render(<App />)

      await operatorListProcessed(service)
      expect(screen.getByRole('button', { name: 'add' })).toBeEnabled()
    })
  })
})

/**
 * Waits until the startup Operator list request was made *and* its outcome has been applied,
 * so "still enabled" assertions can actually fail if the outcome wrongly disabled keys.
 */
async function operatorListProcessed(service: { operatorListRequests: number }) {
  await waitFor(() => expect(service.operatorListRequests).toBe(1))
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
}
