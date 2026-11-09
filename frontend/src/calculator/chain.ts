import type { Operation, Operator } from './operation'

/**
 * The Chain the user is building (ADR-0001): the frontend owns it, the service is stateless.
 * `leftOperand` and `pendingOperator` together form the Pending Operation;
 * `entry` is the number currently being typed (or the last Result).
 */
export interface ChainState {
  entry: string
  leftOperand: number | null
  pendingOperator: Operator | null
}

export type ChainAction =
  | { type: 'digit'; digit: string }
  | { type: 'operator'; operator: Operator }
  | { type: 'result'; result: number }
  | { type: 'clear' }

export const initialChain: ChainState = { entry: '0', leftOperand: null, pendingOperator: null }

export function chainReducer(state: ChainState, action: ChainAction): ChainState {
  switch (action.type) {
    case 'digit':
      return { ...state, entry: state.entry === '0' ? action.digit : state.entry + action.digit }
    case 'operator':
      return { entry: '0', leftOperand: Number(state.entry), pendingOperator: action.operator }
    case 'result':
      return { entry: String(action.result), leftOperand: null, pendingOperator: null }
    case 'clear':
      return initialChain
  }
}

/** The Operation `=` would send to the service, or null if no Operation is pending. */
export function pendingOperation(state: ChainState): Operation | null {
  if (state.pendingOperator === null || state.leftOperand === null) return null
  return { operation: state.pendingOperator, operands: [state.leftOperand, Number(state.entry)] }
}
