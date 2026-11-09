import { useEffect, useLayoutEffect, useReducer, useRef } from 'react'
import { keyCommand, type KeyCommand } from './keyboard'
import type { Operator } from './operation'
import type { useCalculator } from './useCalculator'

type Calculator = ReturnType<typeof useCalculator>

/** Keys typed during one in-flight Operation beyond this are dropped (no unbounded growth). */
const MAX_QUEUED_KEYS = 32

/**
 * Keyboard control: the same commands as the keypad and the same availability rule.
 * Keys typed while an Operation is in flight are queued and applied in order once its Result
 * arrives (fast typists outpace the service) — including Escape. If that Operation fails, the
 * queue is dropped so the error is seen rather than typed over.
 */
export function useKeyboard(calculator: Calculator, isAvailable: (operator: Operator) => boolean) {
  const queue = useRef<KeyCommand[]>([])
  // Re-renders once per replayed key, so replay continues even when a key changes nothing.
  const [, replayed] = useReducer((count: number) => count + 1, 0)

  function run(command: KeyCommand) {
    switch (command.type) {
      case 'digit':
        return calculator.pressDigit(command.digit)
      case 'decimalPoint':
        return calculator.pressDecimalPoint()
      case 'operator':
        if (isAvailable(command.operator)) void calculator.pressOperator(command.operator)
        return
      case 'percent':
        if (isAvailable('percentage')) void calculator.pressPercent()
        return
      case 'equals':
        return void calculator.pressEquals()
      case 'backspace':
        return calculator.pressBackspace()
      case 'clear':
        return calculator.pressClear()
    }
  }

  // The window listener is registered once; these refs give it the latest render's view.
  const runLatest = useRef(run)
  const awaitingResult = useRef(calculator.awaitingResult)
  useLayoutEffect(() => {
    runLatest.current = run
    awaitingResult.current = calculator.awaitingResult
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const command = keyCommand(event)
      if (!command) return
      // Handled here, so Enter doesn't also "click" a focused key and / doesn't open quick-find.
      event.preventDefault()
      if (awaitingResult.current || queue.current.length > 0) {
        if (queue.current.length < MAX_QUEUED_KEYS) queue.current.push(command)
      } else {
        runLatest.current(command)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Replay queued keys one at a time, each against the state the previous one produced.
  useEffect(() => {
    if (calculator.awaitingResult || queue.current.length === 0) return
    if (calculator.error !== null) {
      queue.current = []
      return
    }
    const next = queue.current.shift()
    if (next) {
      run(next)
      replayed()
    }
  })
}
