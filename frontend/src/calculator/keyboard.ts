import type { BinaryOperator } from './operation'

/** What a physical key does on the calculator. */
export type KeyCommand =
  | { type: 'digit'; digit: string }
  | { type: 'decimalPoint' }
  | { type: 'operator'; operator: BinaryOperator }
  | { type: 'percent' }
  | { type: 'equals' }
  | { type: 'backspace' }
  | { type: 'clear' }

const OPERATOR_KEYS: Record<string, BinaryOperator> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  x: 'multiply',
  X: 'multiply',
  '/': 'divide',
}

const FIXED_KEYS: Record<string, KeyCommand> = {
  '.': { type: 'decimalPoint' },
  ',': { type: 'decimalPoint' },
  '%': { type: 'percent' },
  Enter: { type: 'equals' },
  '=': { type: 'equals' },
  Backspace: { type: 'backspace' },
  Escape: { type: 'clear' },
  Delete: { type: 'clear' },
}

/**
 * Maps a key press to a calculator command, or null for keys the calculator doesn't use.
 * Presses with Ctrl, Cmd or Alt are left to the browser (shortcuts such as Cmd+R or Ctrl+1).
 */
export function keyCommand(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): KeyCommand | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  if (/^[0-9]$/.test(event.key)) return { type: 'digit', digit: event.key }
  const operator = OPERATOR_KEYS[event.key]
  if (operator) return { type: 'operator', operator }
  return FIXED_KEYS[event.key] ?? null
}
