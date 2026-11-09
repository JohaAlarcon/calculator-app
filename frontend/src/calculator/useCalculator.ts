import { useReducer } from 'react'
import { calculate } from '../api/client'
import { chainReducer, initialChain, pendingOperation } from './chain'
import type { Operator } from './operation'

/** Connects the Chain to the calculator service. */
export function useCalculator() {
  const [state, dispatch] = useReducer(chainReducer, initialChain)

  async function pressEquals() {
    const operation = pendingOperation(state)
    if (!operation) return
    try {
      dispatch({ type: 'result', result: await calculate(operation) })
    } catch {
      // Error display and recovery are delivered by the Math Errors ticket (#6);
      // until then a failed Operation leaves the Chain unchanged.
    }
  }

  return {
    display: state.entry,
    pressDigit: (digit: string) => dispatch({ type: 'digit', digit }),
    pressOperator: (operator: Operator) => dispatch({ type: 'operator', operator }),
    pressEquals,
    pressClear: () => dispatch({ type: 'clear' }),
  }
}
