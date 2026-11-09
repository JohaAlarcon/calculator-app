import { OPERATOR_SYMBOLS, type Operation, type Operator } from './operation'

/** The Pending Operation's known half: its left Operand and Operator. */
export interface Pending {
  leftOperand: number
  operator: Operator
}

/**
 * The Chain the user is building (ADR-0001): the frontend owns it, the service is stateless.
 * Evaluation is strictly left to right with immediate execution (ADR-0003).
 */
export interface ChainState {
  /** The number on the display: being typed, or the last Result. */
  entry: string
  /** The Pending Operation, or null when none is pending. */
  pending: Pending | null
  /** True after an Operator or a Result: the next digit starts a new entry. */
  startNewEntry: boolean
}

export type ChainAction =
  | { type: 'digit'; digit: string }
  | { type: 'decimalPoint' }
  | { type: 'toggleSign' }
  | { type: 'backspace' }
  | { type: 'operator'; operator: Operator }
  /** The Pending Operation was resolved to `result`, which becomes the left Operand of `operator`. */
  | { type: 'continueChain'; result: number; operator: Operator }
  | { type: 'result'; result: number }
  | { type: 'clear' }

export const initialChain: ChainState = { entry: '0', pending: null, startNewEntry: false }

export function chainReducer(state: ChainState, action: ChainAction): ChainState {
  switch (action.type) {
    case 'digit': {
      if (state.startNewEntry || state.entry === '0') return { ...state, entry: action.digit, startNewEntry: false }
      if (state.entry === '-0') return { ...state, entry: `-${action.digit}` }
      return { ...state, entry: state.entry + action.digit }
    }
    case 'decimalPoint':
      if (state.startNewEntry) return { ...state, entry: '0.', startNewEntry: false }
      return state.entry.includes('.') ? state : { ...state, entry: `${state.entry}.` }
    case 'toggleSign':
      // Right after an Operator, ± starts a negative right Operand; otherwise it negates the shown number.
      if (state.startNewEntry && state.pending !== null) return { ...state, entry: '-0', startNewEntry: false }
      return { ...state, entry: state.entry.startsWith('-') ? state.entry.slice(1) : `-${state.entry}` }
    case 'backspace': {
      if (state.startNewEntry) return state // a Result or Operand already in the Chain is not editable
      const shorter = state.entry.slice(0, -1)
      return { ...state, entry: shorter === '' || shorter === '-' ? '0' : shorter }
    }
    case 'operator':
      // A second Operator before any right Operand replaces the pending one (no evaluation).
      if (state.pending !== null && state.startNewEntry) {
        return { ...state, pending: { ...state.pending, operator: action.operator } }
      }
      return { ...state, pending: { leftOperand: Number(state.entry), operator: action.operator }, startNewEntry: true }
    case 'continueChain':
      return {
        entry: String(action.result),
        pending: { leftOperand: action.result, operator: action.operator },
        startNewEntry: true,
      }
    case 'result':
      return { entry: String(action.result), pending: null, startNewEntry: true }
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
 * or null when there is nothing to resolve — including right after an Operator, when the
 * press only replaces the pending Operator.
 */
export function operationToResolveBeforeOperator(state: ChainState): Operation | null {
  return state.startNewEntry ? null : pendingOperation(state)
}

/** Text of the Pending Operation line, e.g. "12 ÷"; empty when nothing is pending. */
export function pendingOperationText(state: ChainState): string {
  if (state.pending === null) return ''
  return `${state.pending.leftOperand} ${OPERATOR_SYMBOLS[state.pending.operator]}`
}
