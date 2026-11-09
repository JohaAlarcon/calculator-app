import { useEffect, useState } from 'react'
import { listOperators } from '../api/client'
import type { Operator } from './operation'

/**
 * Drift check: asks the service once which Operators it supports.
 * Until (or unless) that answer arrives, every Operator counts as available,
 * so a failed check never blocks the calculator.
 */
export function useOperatorAvailability(): (operator: Operator) => boolean {
  const [supported, setSupported] = useState<ReadonlySet<string> | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    listOperators(controller.signal)
      .then((operators) => setSupported(new Set(operators.map((operator) => operator.name))))
      .catch(() => {
        // Unknown availability: keep every key enabled.
      })
    return () => controller.abort()
  }, [])

  return (operator) => supported === null || supported.has(operator)
}
