import type { Operator } from '../calculator/operation'

interface KeypadProps {
  onDigit: (digit: string) => void
  onOperator: (operator: Operator) => void
  onEquals: () => void
  onClear: () => void
}

const DIGITS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0']

export function Keypad({ onDigit, onOperator, onEquals, onClear }: KeypadProps) {
  return (
    <div className="keypad">
      <button type="button" className="key key--function key--wide" aria-label="clear" onClick={onClear}>
        C
      </button>
      <button type="button" className="key key--operator" aria-label="add" onClick={() => onOperator('add')}>
        +
      </button>
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className={digit === '0' ? 'key key--digit key--wide' : 'key key--digit'}
          onClick={() => onDigit(digit)}
        >
          {digit}
        </button>
      ))}
      <button type="button" className="key key--equals" aria-label="equals" onClick={onEquals}>
        =
      </button>
    </div>
  )
}
