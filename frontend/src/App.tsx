import { Display } from './components/Display'
import { Keypad } from './components/Keypad'
import { useCalculator } from './calculator/useCalculator'
import './styles.css'

export default function App() {
  const calculator = useCalculator()

  return (
    <main className="calculator" aria-label="Calculator">
      <Display value={calculator.display} />
      <Keypad
        onDigit={calculator.pressDigit}
        onOperator={calculator.pressOperator}
        onEquals={calculator.pressEquals}
        onClear={calculator.pressClear}
      />
    </main>
  )
}
