import { isAdditive, OPERATOR_SYMBOLS, type BinaryOperator, type Operation } from './operation'

/** The Pending Operation's known half: its left Operand and Operator. */
export interface Pending {
  leftOperand: number
  operator: BinaryOperator
}

/**
 * - `typing`: the user is typing the entry; digits append to it.
 * - `awaitingRightOperand`: right after an Operator; the entry still shows the left Operand,
 *   the next digit starts the right Operand, and another Operator only replaces the pending one.
 * - `showingValue`: the entry is a computed value (a Result, a percentage) or a failed
 *   Operation's input; the next digit starts a new entry and ⌫ doesn't edit it.
 */
export type EntryPhase = 'typing' | 'awaitingRightOperand' | 'showingValue'

/**
 * The Chain the user is building (ADR-0001): the frontend owns it, the service is stateless.
 * Evaluation is strictly left to right with immediate execution (ADR-0003).
 */
export interface ChainState {
  /** The number on the display: being typed, or the last Result. */
  entry: string
  /** The Pending Operation, or null when none is pending. */
  pending: Pending | null
  /** What the entry is, which decides what the next key does with it. */
  entryPhase: EntryPhase
  /** True while an Operation is with the service; the keypad is locked meanwhile. */
  awaitingResult: boolean
  /** Message of the last failed Operation, shown until a digit, the decimal point, = or C. */
  error: string | null
}

export type ChainAction =
  | { type: 'digit'; digit: string }
  | { type: 'decimalPoint' }
  | { type: 'toggleSign' }
  | { type: 'backspace' }
  | { type: 'operator'; operator: BinaryOperator }
  /** The Pending Operation was resolved to `result`, which becomes the left Operand of `operator`. */
  | { type: 'continueChain'; result: number; operator: BinaryOperator }
  /** % was applied: `result` becomes the (right) Operand on the display. */
  | { type: 'percentApplied'; result: number }
  | { type: 'result'; result: number }
  | { type: 'requestStarted' }
  /** The Operation failed; the Chain before it is preserved. */
  | { type: 'failed'; message: string }
  | { type: 'clear' }

export const initialChain: ChainState = {
  entry: '0',
  pending: null,
  entryPhase: 'typing',
  awaitingResult: false,
  error: null,
}

/** While an error is shown, these keys do nothing (so no input is dropped silently). */
const IGNORED_WHILE_ERROR: ReadonlySet<ChainAction['type']> = new Set(['operator', 'toggleSign', 'backspace'])

export function chainReducer(current: ChainState, action: ChainAction): ChainState {
  if (current.error !== null && IGNORED_WHILE_ERROR.has(action.type)) return current
  // A digit, the decimal point, C or a retried = dismisses the error; the Chain underneath is intact.
  const state = current.error === null || action.type === 'failed' ? current : { ...current, error: null }
  switch (action.type) {
    case 'digit': {
      const typing = { ...state, entryPhase: 'typing' as const }
      if (state.entryPhase !== 'typing' || state.entry === '0') return { ...typing, entry: action.digit }
      if (state.entry === '-0') return { ...typing, entry: `-${action.digit}` }
      return { ...typing, entry: state.entry + action.digit }
    }
    case 'decimalPoint':
      if (state.entryPhase !== 'typing') return { ...state, entry: '0.', entryPhase: 'typing' }
      return state.entry.includes('.') ? state : { ...state, entry: `${state.entry}.` }
    case 'toggleSign':
      // Right after an Operator, ± starts a negative right Operand; otherwise it negates the shown number.
      if (state.entryPhase === 'awaitingRightOperand') return { ...state, entry: '-0', entryPhase: 'typing' }
      return { ...state, entry: state.entry.startsWith('-') ? state.entry.slice(1) : `-${state.entry}` }
    case 'backspace': {
      if (state.entryPhase !== 'typing') return state // only a number being typed is editable
      const shorter = state.entry.slice(0, -1)
      return { ...state, entry: shorter === '' || shorter === '-' ? '0' : shorter }
    }
    case 'operator':
      // A second Operator before any right Operand replaces the pending one (no evaluation).
      if (state.pending !== null && state.entryPhase === 'awaitingRightOperand') {
        return { ...state, pending: { ...state.pending, operator: action.operator } }
      }
      return {
        ...state,
        pending: { leftOperand: Number(state.entry), operator: action.operator },
        entryPhase: 'awaitingRightOperand',
      }
    case 'continueChain':
      return {
        ...state,
        entry: String(action.result),
        pending: { leftOperand: action.result, operator: action.operator },
        entryPhase: 'awaitingRightOperand',
        awaitingResult: false,
      }
    case 'percentApplied':
      return { ...state, entry: String(action.result), entryPhase: 'showingValue', awaitingResult: false }
    case 'result':
      return { ...state, entry: String(action.result), pending: null, entryPhase: 'showingValue', awaitingResult: false }
    case 'requestStarted':
      return { ...state, awaitingResult: true }
    case 'failed':
      return { ...state, error: action.message, entryPhase: 'showingValue', awaitingResult: false }
    case 'clear':
      return initialChain
  }
}

/** The Pending Operation with the current entry as its right Operand, or null if none is pending. */
export function pendingOperation(state: ChainState): Operation | null {
  if (state.pending === null) return null
  return { operation: state.pending.operator, operands: [state.pending.leftOperand, Number(state.entry)] }
}

/**
 * The Operation that pressing another Operator must resolve first (immediate execution),
 * or null when there is nothing to resolve: right after an Operator (the press only replaces
 * the pending Operator), or while an error is shown (Operators are ignored then).
 */
export function operationToResolveBeforeOperator(state: ChainState): Operation | null {
  if (state.error !== null || state.entryPhase === 'awaitingRightOperand') return null
  return pendingOperation(state)
}

/**
 * The Operation the % key sends (ADR-0002, phone-calculator convention): with + or − pending,
 * "entry percent of the left Operand" (50 + 10 % → 5); otherwise a plain ÷100, i.e.
 * "entry percent of 1" (50 × 10 % → 0.1). Null while an error is shown.
 */
export function percentageOperation(state: ChainState): Operation | null {
  if (state.error !== null) return null
  const { pending } = state
  const base = pending !== null && isAdditive(pending.operator) ? pending.leftOperand : 1
  return { operation: 'percentage', operands: [Number(state.entry), base] }
}

/** Text of the Pending Operation line, e.g. "12 ÷"; empty when nothing is pending. */
export function pendingOperationText(state: ChainState): string {
  if (state.pending === null) return ''
  return `${state.pending.leftOperand} ${OPERATOR_SYMBOLS[state.pending.operator]}`
}
