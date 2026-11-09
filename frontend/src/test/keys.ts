import { screen } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'

/** Accessible names of the non-digit keys, by the symbol shown on the key. */
const KEY_NAMES: Record<string, string> = {
  '+': 'add',
  '−': 'subtract',
  '×': 'multiply',
  '÷': 'divide',
  '=': 'equals',
  C: 'clear',
  '.': 'decimal point',
  '±': 'toggle sign',
  '⌫': 'backspace',
}

/** Presses a space-separated key sequence, e.g. `press(user, '12 ÷ 4 =')` (digits may be grouped). */
export async function press(user: UserEvent, sequence: string) {
  for (const token of sequence.split(' ').filter(Boolean)) {
    const keys = /^\d+$/.test(token) ? token.split('') : [token]
    for (const key of keys) {
      await user.click(screen.getByRole('button', { name: KEY_NAMES[key] ?? key }))
    }
  }
}

export const display = () => screen.getByRole('status', { name: 'display' })
export const pendingOperationLine = () => screen.getByLabelText('pending operation')
