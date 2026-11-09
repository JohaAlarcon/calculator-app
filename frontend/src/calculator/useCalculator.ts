import { useReducer } from 'react'
import { calculate } from '../api/client'
import { chainReducer, initialChain, operationToResolveBeforeOperator, pendingOperation, pendingOperationText } from './chain'
import type { Operation, Operator } from './operation'

export const SERVICE_UNAVAILABLE = 'Calculator service unavailable'
/** What the display shows while an error is pending; the banner explains it. */
export const ERROR_DISPLAY = 'Error'

/** Connects the Chain to the calculator service. */
export function useCalculator() {
  const [state, dispatch] = useReducer(chainReducer, initialChain)

  /** Evaluates an Operation on the service and hands its Result on, or records the failure. */
  async function resolve(operation: Operation, onResult: (result: number) => void) {
    dispatch({ type: 'requestStarted' })
    const outcome = await calculate(operation)
    if (outcome.kind === 'result') {
      onResult(outcome.result)
    } else {
      dispatch({ type: 'failed', message: outcome.kind === 'rejected' ? outcome.message : SERVICE_UNAVAILABLE })
    }
  }

  async function pressOperator(operator: Operator) {
    const operation = operationToResolveBeforeOperator(state)
    if (!operation) {
      dispatch({ type: 'operator', operator })
      return
    }
    await resolve(operation, (result) => dispatch({ type: 'continueChain', result, operator }))
  }

  async function pressEquals() {
    const operation = pendingOperation(state)
    if (!operation) return
    await resolve(operation, (result) => dispatch({ type: 'result', result }))
  }

  return {
    display: state.error === null ? state.entry : ERROR_DISPLAY,
    error: state.error,
    awaitingResult: state.awaitingResult,
    pendingOperationText: pendingOperationText(state),
    pressDigit: (digit: string) => dispatch({ type: 'digit', digit }),
    pressDecimalPoint: () => dispatch({ type: 'decimalPoint' }),
    pressToggleSign: () => dispatch({ type: 'toggleSign' }),
    pressBackspace: () => dispatch({ type: 'backspace' }),
    pressOperator,
    pressEquals,
    pressClear: () => dispatch({ type: 'clear' }),
  }
}
