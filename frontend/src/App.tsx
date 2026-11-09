import { Display } from './components/Display'
import { ErrorBanner } from './components/ErrorBanner'
import { Keypad } from './components/Keypad'
import { useCalculator } from './calculator/useCalculator'
import { useOperatorAvailability } from './calculator/useOperatorAvailability'
import './styles.css'

export default function App() {
  const calculator = useCalculator()
  const isAvailable = useOperatorAvailability()

  return (
    <main className="calculator" aria-label="Calculator">
      <Display pendingOperationText={calculator.pendingOperationText} value={calculator.display} />
      <ErrorBanner message={calculator.error} />
      <Keypad
        locked={calculator.awaitingResult}
        isAvailable={isAvailable}
        onDigit={calculator.pressDigit}
        onDecimalPoint={calculator.pressDecimalPoint}
        onToggleSign={calculator.pressToggleSign}
        onBackspace={calculator.pressBackspace}
        onOperator={calculator.pressOperator}
        onPercent={calculator.pressPercent}
        onEquals={calculator.pressEquals}
        onClear={calculator.pressClear}
      />
    </main>
  )
}
