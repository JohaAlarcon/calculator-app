import { useReducer } from 'react'
import { calculate } from '../api/client'
import {
  chainReducer,
  entryText,
  equalsOperation,
  initialChain,
  operationToResolveBeforeOperator,
  pendingOperationText,
  percentageOperation,
} from './chain'
import type { BinaryOperator, Operation } from './operation'

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

  async function pressOperator(operator: BinaryOperator) {
    const operation = operationToResolveBeforeOperator(state)
    if (!operation) {
      dispatch({ type: 'operator', operator })
      return
    }
    await resolve(operation, (result) => dispatch({ type: 'continueChain', result, operator }))
  }

  async function pressPercent() {
    const operation = percentageOperation(state)
    if (!operation) return
    await resolve(operation, (result) => dispatch({ type: 'percentApplied', result }))
  }

  async function pressEquals() {
    const equals = equalsOperation(state)
    if (!equals) return
    await resolve(equals.operation, (result) =>
      dispatch({ type: 'result', result, lastOperation: equals.lastOperation }),
    )
  }

  return {
    display: state.error === null ? entryText(state) : ERROR_DISPLAY,
    error: state.error,
    awaitingResult: state.awaitingResult,
    pendingOperationText: pendingOperationText(state),
    pressDigit: (digit: string) => dispatch({ type: 'digit', digit }),
    pressDecimalPoint: () => dispatch({ type: 'decimalPoint' }),
    pressToggleSign: () => dispatch({ type: 'toggleSign' }),
    pressBackspace: () => dispatch({ type: 'backspace' }),
    pressOperator,
    pressPercent,
    pressEquals,
    pressClear: () => dispatch({ type: 'clear' }),
  }
}
