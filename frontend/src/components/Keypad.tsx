import { OPERATOR_SYMBOLS, type Operator } from '../calculator/operation'

interface KeypadProps {
  isAvailable: (operator: Operator) => boolean
  onDigit: (digit: string) => void
  onDecimalPoint: () => void
  onToggleSign: () => void
  onBackspace: () => void
  onOperator: (operator: Operator) => void
  onEquals: () => void
  onClear: () => void
}

/** Static keypad (spec #1); rows of four, Operators down the right-hand column. */
export function Keypad(props: KeypadProps) {
  const { isAvailable, onDigit, onDecimalPoint, onToggleSign, onBackspace, onOperator, onEquals, onClear } = props
  const digit = (d: string, className = 'key key--digit') => (
    <button type="button" className={className} onClick={() => onDigit(d)}>
      {d}
    </button>
  )
  const operatorKey = (o: Operator) => <OperatorKey operator={o} isAvailable={isAvailable} onOperator={onOperator} />

  return (
    <div className="keypad">
      <button type="button" className="key key--function" aria-label="clear" onClick={onClear}>
        C
      </button>
      <button type="button" className="key key--function" aria-label="toggle sign" onClick={onToggleSign}>
        ±
      </button>
      <button type="button" className="key key--function" aria-label="backspace" onClick={onBackspace}>
        ⌫
      </button>
      {operatorKey('divide')}
      {digit('7')}
      {digit('8')}
      {digit('9')}
      {operatorKey('multiply')}
      {digit('4')}
      {digit('5')}
      {digit('6')}
      {operatorKey('subtract')}
      {digit('1')}
      {digit('2')}
      {digit('3')}
      {operatorKey('add')}
      {digit('0', 'key key--digit key--wide')}
      <button type="button" className="key key--digit" aria-label="decimal point" onClick={onDecimalPoint}>
        .
      </button>
      <button type="button" className="key key--equals" aria-label="equals" onClick={onEquals}>
        =
      </button>
    </div>
  )
}

interface OperatorKeyProps {
  operator: Operator
  isAvailable: (operator: Operator) => boolean
  onOperator: (operator: Operator) => void
}

function OperatorKey({ operator, isAvailable, onOperator }: OperatorKeyProps) {
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
      {OPERATOR_SYMBOLS[operator]}
    </button>
  )
}
