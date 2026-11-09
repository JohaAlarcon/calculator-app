import { useReducer } from 'react'
import { calculate } from '../api/client'
import { chainReducer, initialChain, operationToResolveBeforeOperator, pendingOperation, pendingOperationText } from './chain'
import type { Operation, Operator } from './operation'

/** Connects the Chain to the calculator service. */
export function useCalculator() {
  const [state, dispatch] = useReducer(chainReducer, initialChain)

  /** Evaluates an Operation on the service and hands its Result on. */
  async function resolve(operation: Operation, onResult: (result: number) => void) {
    try {
      onResult(await calculate(operation))
    } catch {
      // Error display and recovery are delivered by the Math Errors ticket (#6);
      // until then a failed Operation leaves the Chain unchanged.
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
    display: state.entry,
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
