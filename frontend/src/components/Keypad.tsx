import type { Operator } from '../calculator/operation'

interface KeypadProps {
  isAvailable: (operator: Operator) => boolean
  onDigit: (digit: string) => void
  onOperator: (operator: Operator) => void
  onEquals: () => void
  onClear: () => void
}

const DIGITS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0']

export function Keypad({ isAvailable, onDigit, onOperator, onEquals, onClear }: KeypadProps) {
  return (
    <div className="keypad">
      <button type="button" className="key key--function key--wide" aria-label="clear" onClick={onClear}>
        C
      </button>
      <OperatorKey operator="add" label="+" isAvailable={isAvailable} onOperator={onOperator} />
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

interface OperatorKeyProps {
  operator: Operator
  label: string
  isAvailable: (operator: Operator) => boolean
  onOperator: (operator: Operator) => void
}

function OperatorKey({ operator, label, isAvailable, onOperator }: OperatorKeyProps) {
  const available = isAvailable(operator)
  return (
    <button
      type="button"
      className="key key--operator"
      aria-label={operator}
      disabled={!available}
      title={available ? undefined : 'Not supported by the calculator service'}
      onClick={() => onOperator(operator)}
    >
      {label}
    </button>
  )
}
